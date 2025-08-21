// /.netlify/functions/stripeWebhook
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Inizializza Firebase Admin da ENV (niente file locale)
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'); // importante!

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}
const db = admin.firestore();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Header case-insensitive
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  let stripeEvent;
  try {
    // event.body è già raw string su Netlify (perfetto per Stripe)
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        const uid = session.metadata?.uid || null;
        const plan = session.metadata?.plan || null;
        const billing = session.metadata?.billing || null;
        if (uid && plan) await updateUserPlan(uid, plan, billing, sub);
        break;
      }

      // opzionali ma utili se più avanti gestisci cambi piano/stato
      case 'customer.subscription.updated': {
        const sub = stripeEvent.data.object;
        const uid = sub.metadata?.uid || null;
        if (uid) {
          const billing = sub.items?.data?.[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly';
          const plan = mapPriceToPlan(sub.items?.data?.[0]?.price?.id);
          await updateUserPlan(uid, plan, billing, sub);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object;
        const uid = sub.metadata?.uid || null;
        if (uid) {
          await db.collection('users').doc(uid).set({
            plan: 'free',
            billing: null,
            clicksPerTool: 40,
            status: 'canceled',
            currentPeriodStart: admin.firestore.FieldValue.serverTimestamp(),
            currentPeriodEnd: null,
          }, { merge: true });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        const subId = invoice.subscription;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const uid = sub.metadata?.uid || null;
          if (uid) {
            await db.collection('users').doc(uid).set({
              status: 'past_due'
            }, { merge: true });
          }
        }
        break;
      }

      default:
        // Ignora altri eventi
        break;
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('Webhook handler error:', err);
    return { statusCode: 500, body: 'Webhook handler error' };
  }
};

function mapPriceToPlan(priceId) {
  const map = {
    [process.env.PRICE_PREMIUM300_MONTHLY]: 'premium300',
    [process.env.PRICE_PREMIUM300_ANNUAL]: 'premium300',
    [process.env.PRICE_PREMIUM400_MONTHLY]: 'premium400',
    [process.env.PRICE_PREMIUM400_ANNUAL]: 'premium400',
    [process.env.PRICE_PREMIUMUNLIMITED_MONTHLY]: 'premiumUnlimited',
    [process.env.PRICE_PREMIUMUNLIMITED_ANNUAL]: 'premiumUnlimited',
  };
  return map[priceId] || 'premium300';
}

async function updateUserPlan(uid, plan, billing, sub) {
  const clicksMap = { premium300: 300, premium400: 400, premiumUnlimited: 999999999 };
  await db.collection('users').doc(uid).set({
    plan,
    billing,
    clicksPerTool: clicksMap[plan] || 300,
    status: sub.status || 'active',
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    stripe: {
      subscriptionId: sub.id,
      customer: sub.customer,
      priceId: sub.items?.data?.[0]?.price?.id,
    }
  }, { merge: true });
}