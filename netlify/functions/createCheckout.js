// /.netlify/functions/createCheckout
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { plan, billing, uid, email } = JSON.parse(event.body || '{}');

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
    const cancelUrl = `${process.env.SITE_URL}/premium.html`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl,
      metadata: { plan, billing, uid: uid || '' },
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