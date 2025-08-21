// /.netlify/functions/createCheckout
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Se implementi verifica ID token Firebase:
    // const idToken = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
    // if (!idToken) return { statusCode: 401, body: 'Login required' };
    // const admin = require('firebase-admin');
    // if (!admin.apps.length) {
    //   const projectId = process.env.FIREBASE_PROJECT_ID;
    //   const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    //   let privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim().replace(/^"|"$/g, '');
    //   if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
    //   admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }), projectId });
    // }
    // const decoded = await admin.auth().verifyIdToken(idToken);
    // const uid = decoded.uid;

    const { plan, billing, uid, email } = JSON.parse(event.body || '{}');

    // Guardia server: obbliga login (minimo)
    if (!uid) {
      return { statusCode: 401, body: 'Login required' };
    }

    const priceMap = {
      monthly: {
        premium300: process.env.PRICE_PREMIUM300_MONTHLY,
        premium400: process.env.PRICE_PREMIUM400_MONTHLY,
        premiumUnlimited: process.env.PRICE_PREMIUMUNLIMITED_MONTHLY,
      },
      annual: {
        premium300: process.env.PRICE_PREMIUM300_ANNUAL,
        premium400: process.env.PRICE_PREMIUM400_ANNUAL,
        premiumUnlimited: process.env.PRICE_PREMIUMUNLIMITED_ANNUAL,
      }
    };

    const price = priceMap?.[billing]?.[plan];
    if (!price) return { statusCode: 400, body: 'Invalid plan/billing' };

    const successUrl = `${process.env.SITE_URL}/premium-success.html`;
    const cancelUrl  = `${process.env.SITE_URL}/premium.html`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl,

      // utile in Dashboard
      client_reference_id: uid,

      // metadata per il webhook (sia su sessione che su subscription)
      metadata: { plan, billing, uid },
      subscription_data: { metadata: { plan, billing, uid } },

      // opzionale, fallback email (non usata per l'autorizzazione)
      customer_email: email || undefined,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Server error' };
  }
};