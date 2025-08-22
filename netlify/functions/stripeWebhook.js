// /.netlify/functions/stripeWebhook
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// ---- Firebase Admin init (da ENV) ----
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
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
  } catch {
    return null;
  }
}

function clicksFor(plan) {
  if (plan === 'premium300') return 300;
  if (plan === 'premium400') return 400;
  if (plan === 'premiumUnlimited') return 999999999;
  return 40;
}

function subToPayload(plan, billing, sub, statusOverride) {
  return {
    plan,
    billing,
    clicksPerTool: clicksFor(plan),
    status: statusOverride || (sub?.status || 'active'),
    currentPeriodStart: sub?.current_period_start ? new Date(sub.current_period_start * 1000) : admin.firestore.FieldValue.serverTimestamp(),
    currentPeriodEnd: sub?.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    stripe: {
      subscriptionId: sub?.id || null,
      customer: sub?.customer || null,
      priceId: sub?.items?.data?.[0]?.price?.id || null,
    }
  };
}

async function upsertUser(uid, data) {
  await db.collection('users').doc(uid).set(data, { merge: true });
  console.log('[webhook] upsert', { uid, plan: data.plan, status: data.status });
}

// ---- Handler ----
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  let evt;
  try {
    evt = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] bad signature:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    switch (evt.type) {
      // 1) Checkout completato → imposta sub e stato iniziale
      case 'checkout.session.completed': {
        const session = evt.data.object;
        const sub = session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription)
          : null;

        // uid / plan / billing
        let uid = session.metadata?.uid || sub?.metadata?.uid || null;
        let billing = session.metadata?.billing || sub?.metadata?.billing || null;

        // Deriva il piano dai metadata o dal priceId
        const priceId = sub?.items?.data?.[0]?.price?.id || null;
        let plan = session.metadata?.plan || sub?.metadata?.plan || mapPriceToPlan(priceId);

        if (!uid) {
          const email = session.customer_details?.email || session.customer_email || null;
          uid = await getUidFromEmail(email);
        }

        if (uid && plan && sub) {
          const payload = subToPayload(plan, billing, sub);
          await upsertUser(uid, payload);
        } else {
          console.warn('[webhook] checkout.session.completed: dati insufficienti', { uid, plan, hasSub: !!sub });
        }
        break;
      }

      // 2) Subscription creata/aggiornata → allinea e AUTORIPARA
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = evt.data.object;

        // uid
        let uid = sub.metadata?.uid || null;
        if (!uid && sub.customer) {
          const customer = await stripe.customers.retrieve(sub.customer);
          uid = await getUidFromEmail(customer?.email || null);
        }

        // billing & plan (autoripara dal priceId se mancano/sono incoerenti)
        const priceId = sub.items?.data?.[0]?.price?.id || null;
        const planFromPrice = mapPriceToPlan(priceId);
        const plan = sub.metadata?.plan || planFromPrice;
        const billing = sub.metadata?.billing ||
          (sub.items?.data?.[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly');

        const cancelAtPeriodEnd = !!sub.cancel_at_period_end;

        if (uid && plan) {
          const statusOverride = cancelAtPeriodEnd ? 'canceled_at_period_end' : undefined;

          // (facoltativo) leggi lo stato attuale e correggi incoerenze (autoripara)
          try {
            const ref = db.collection('users').doc(uid);
            const snap = await ref.get();
            const current = snap.exists ? snap.data() : {};

            // Se il DB dice "free/free-logged" ma la sub è attiva, sovrascrivi coi dati premium
            // Se la sub è 'past_due', 'unpaid', ecc., lo status di Stripe prevale
            const payload = subToPayload(plan, billing, sub, statusOverride || sub.status);
            await upsertUser(uid, payload);
          } catch (e) {
            console.error('[webhook] autoripara errore:', e?.message || e);
            const payload = subToPayload(plan, billing, sub, statusOverride || sub.status);
            await upsertUser(uid, payload);
          }
        } else {
          console.warn('[webhook] subscription.upsert: manca uid/plan', { uid, plan, priceId });
        }
        break;
      }

      // 3) Subscription cancellata → downgrade a free SOLO qui
      case 'customer.subscription.deleted': {
        const sub = evt.data.object;
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
        } else {
          console.warn('[webhook] subscription.deleted: uid mancante');
        }
        break;
      }

      // 4) Pagamento fallito → past_due
      case 'invoice.payment_failed': {
        const invoice = evt.data.object;
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
          }
        }
        break;
      }

      default:
        // altri eventi ignorati
        break;
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('[webhook] handler error:', err);
    return { statusCode: 500, body: 'Webhook handler error' };
  }
};