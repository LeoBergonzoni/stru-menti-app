// /.netlify/functions/stripeWebhook
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const saJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(saJson)),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}
const db = admin.firestore();

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        const uid = session.metadata?.uid;
        const plan = session.metadata?.plan;
        const billing = session.metadata?.billing;
        if (uid && plan) await updateUserPlan(uid, plan, billing, sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object;
        const uid = sub.metadata?.uid;
        if (uid) {
          await db.collection('users').doc(uid).set({
            plan: 'free',
            billing: null,
            clicksPerTool: 40,
            status: 'canceled',
          }, { merge: true });
        }
        break;
      }
    }
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Webhook handler error' };
  }
};

async function updateUserPlan(uid, plan, billing, sub) {
  const clicksMap = { premium300: 300, premium400: 400, premiumUnlimited: 999999999 };
  await db.collection('users').doc(uid).set({
    plan,
    billing,
    clicksPerTool: clicksMap[plan] || 300,
    status: sub.status,
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
  }, { merge: true });
}