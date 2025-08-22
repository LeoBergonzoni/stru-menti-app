// /.netlify/functions/stripeWebhook
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// ---- Firebase Admin init (da ENV, senza file locale) ----
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';

  // rimuovi eventuali virgolette esterne e converti \n
  privateKey = privateKey.trim().replace(/^"|"$/g, '');
  if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}
const db = admin.firestore();

// ---- Helpers ----
function mapPriceToPlan(priceId) {
  const map = {
    [process.env.PRICE_PREMIUM300_MONTHLY]: 'premium300',
    [process.env.PRICE_PREMIUM300_ANNUAL]: 'premium300',
    [process.env.PRICE_PREMIUM400_MONTHLY]: 'premium400',
    [process.env.PRICE_PREMIUM400_ANNUAL]: 'premium400',
    [process.env.PRICE_PREMIUMUNLIMITED_MONTHLY]: 'premiumUnlimited',
    [process.env.PRICE_PREMIUMUNLIMITED_ANNUAL]: 'premiumUnlimited',
  };
  return map[priceId] || null;
}

async function getUidFromEmail(email) {
  if (!email) return null;
  try {
    const user = await admin.auth().getUserByEmail(email);
    return user.uid || null;
  } catch (e) {
    console.warn('[webhook] getUidFromEmail: nessun utente per', email);
    return null;
  }
}

function clicksFor(plan) {
  if (plan === 'premium300') return 300;
  if (plan === 'premium400') return 400;
  if (plan === 'premiumUnlimited') return 999999999;
  return 40;
}

function subToPayload(plan, billing, sub, overrides = {}) {
  return {
    plan,
    billing,
    clicksPerTool: clicksFor(plan),
    status: overrides.status || (sub?.status || 'active'),
    currentPeriodStart: sub?.current_period_start ? new Date(sub.current_period_start * 1000) : admin.firestore.FieldValue.serverTimestamp(),
    currentPeriodEnd: sub?.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    stripe: {
      subscriptionId: sub?.id || null,
      customer: sub?.customer || null,
      priceId: sub?.items?.data?.[0]?.price?.id || null,
    },
    ...overrides.extra, // per eventuali campi aggiuntivi
  };
}

async function upsertUser(uid, data) {
  await db.collection('users').doc(uid).set(data, { merge: true });
  console.log('[webhook] Firestore aggiornato', { uid, plan: data.plan, status: data.status });
}

// ---- Handler ----
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    switch (stripeEvent.type) {
      // ---- Session completata: attiva piano ----
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;

        // recupera la subscription per leggere current_period_* e price
        const sub = session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription)
          : null;

        // prova a leggere da session.metadata, altrimenti da sub.metadata
        let uid = session.metadata?.uid || sub?.metadata?.uid || null;
        let plan = session.metadata?.plan || sub?.metadata?.plan || null;
        let billing = session.metadata?.billing || sub?.metadata?.billing || null;

        // fallback via email se manca uid
        if (!uid) {
          const email = session.customer_details?.email || session.customer_email || null;
          uid = await getUidFromEmail(email);
        }

        console.log('[webhook] checkout.session.completed', {
          uid, plan, billing, subId: sub?.id || null
        });

        if (uid && plan && sub) {
          const payload = subToPayload(plan, billing, sub);
          await upsertUser(uid, payload);
        } else {
          console.warn('[webhook] skip update (manca uid/plan/sub)', { uid, plan, hasSub: !!sub });
        }
        break;
      }

      // ---- Subscription creata/aggiornata: allinea dati piano ----
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = stripeEvent.data.object;

        // uid dai metadata della subscription (grazie a subscription_data.metadata)
        let uid = sub.metadata?.uid || null;

        // fallback via email del customer se manca uid
        if (!uid && sub.customer) {
          const customer = await stripe.customers.retrieve(sub.customer);
          uid = await getUidFromEmail(customer?.email || null);
        }

        // deduci billing e plan dal price id (se non erano nei metadata)
        const priceId = sub.items?.data?.[0]?.price?.id || null;
        const plan = sub.metadata?.plan || mapPriceToPlan(priceId);
        const billing = sub.metadata?.billing ||
                        (sub.items?.data?.[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly');

        const cancelAtPeriodEnd = !!sub.cancel_at_period_end;

        console.log('[webhook] subscription.upsert', {
          type: stripeEvent.type, uid, plan, billing, priceId, subId: sub.id, cancelAtPeriodEnd
        });

        if (uid && plan) {
          // Se l'utente ha scelto "annulla a fine periodo",
          // NON declassiamo ora: manteniamo i benefici fino a current_period_end.
          const overrides = cancelAtPeriodEnd
            ? { status: 'canceled_at_period_end' }
            : {};

          const payload = subToPayload(plan, billing, sub, { status: overrides.status });
          await upsertUser(uid, payload);
        } else {
          console.warn('[webhook] skip update (manca uid/plan)', { uid, plan });
        }
        break;
      }

      // ---- Subscription cancellata: downgrade a free (solo qui) ----
      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object;
        let uid = sub.metadata?.uid || null;

        if (!uid && sub.customer) {
          const customer = await stripe.customers.retrieve(sub.customer);
          uid = await getUidFromEmail(customer?.email || null);
        }

        if (uid) {
          await upsertUser(uid, {
            plan: 'free',
            billing: null,
            clicksPerTool: clicksFor('free'),
            status: 'canceled',
            currentPeriodStart: admin.firestore.FieldValue.serverTimestamp(),
            currentPeriodEnd: null,
            stripe: {
              subscriptionId: sub.id,
              customer: sub.customer,
              priceId: sub.items?.data?.[0]?.price?.id || null,
            }
          });
          console.log('[webhook] subscription.deleted -> free', { uid, subId: sub.id });
        } else {
          console.warn('[webhook] subscription.deleted: uid mancante, nessun update');
        }
        break;
      }

      // ---- Pagamento ricorrente fallito: marca past_due ----
      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        const subId = invoice.subscription;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          let uid = sub.metadata?.uid || null;
          if (!uid && sub.customer) {
            const customer = await stripe.customers.retrieve(sub.customer);
            uid = await getUidFromEmail(customer?.email || null);
          }
          if (uid) {
            await upsertUser(uid, { status: 'past_due' });
            console.log('[webhook] invoice.payment_failed -> past_due', { uid, subId });
          }
        }
        break;
      }

      default:
        // altri eventi non gestiti
        break;
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('[webhook] handler error:', err);
    return { statusCode: 500, body: 'Webhook handler error' };
  }
};