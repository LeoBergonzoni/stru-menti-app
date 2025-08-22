// /.netlify/functions/createPortal.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { customerId } = JSON.parse(event.body || "{}");

    if (!process.env.STRIPE_SECRET_KEY) {
      return jserr(500, "Missing STRIPE_SECRET_KEY");
    }
    if (!process.env.SITE_URL) {
      console.warn("[createPortal] SITE_URL non impostata, uso fallback https://stru-menti.com");
    }
    if (!customerId) {
      return jserr(400, "Missing customerId");
    }

    const returnUrl = `${process.env.SITE_URL || "https://stru-menti.com"}/manage.html`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error("[createPortal] Portal error:", err?.message || err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Portal error",
        message: err?.message || String(err),
      }),
    };
  }
};

function jserr(code, message) {
  return {
    statusCode: code,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: message }),
  };
}