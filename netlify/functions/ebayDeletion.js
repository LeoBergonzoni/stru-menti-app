export const handler = async (event) => {
    try {
      const method = (event.httpMethod || "").toUpperCase();
      const headers = event.headers || {};
      const qs = event.queryStringParameters || {};
      const contentType = (headers["content-type"] || headers["Content-Type"] || "").toLowerCase();
  
      const expectedToken = process.env.EBAY_DELETION_TOKEN || "";
  
      // --- parse body per POST (JSON o form) ---
      let body = {};
      if (method === "POST" && event.body) {
        if (contentType.includes("application/json")) {
          try { body = JSON.parse(event.body); } catch {}
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          body = Object.fromEntries(new URLSearchParams(event.body));
        } else {
          try { body = JSON.parse(event.body); } catch {}
        }
      }
  
      // challenge in varie chiavi (GET/POST)
      const challenge =
        qs.challenge_code || qs.challengeCode || qs.challenge ||
        body.challenge_code || body.challengeCode || body.challenge ||
        body?.metadata?.challengeCode || body?.metadata?.challenge_code ||
        null;
  
      // token in varie chiavi / header
      const receivedToken =
        qs.verification_token || qs.verificationToken ||
        body.verification_token || body.verificationToken ||
        headers["x-ebay-verification-token"] || headers["x-verification-token"] ||
        "";
  
      // --- FASE DI VALIDAZIONE: eBay vuole l'eco del challenge in PLAIN TEXT ---
      if (challenge) {
        // Alcuni check leggono anche questi header; non fanno male:
        const respHeaders = {
          "Content-Type": "text/plain",
          "x-ebay-challenge-response": String(challenge),
        };
        if (expectedToken) {
          respHeaders["x-ebay-verification-token"] = expectedToken;
        }
        return {
          statusCode: 200,
          headers: respHeaders,
          body: String(challenge), // <<-- PLAIN TEXT identico
        };
      }
  
      // Se niente challenge ma arriva il token, echi-amo il token (plain text) per compatibilità
      if (!challenge && receivedToken) {
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "text/plain",
            "x-ebay-verification-token": receivedToken,
          },
          body: String(receivedToken),
        };
      }
  
      // Notifica reale di deletion/closure (qui solo 200)
      return { statusCode: 200, body: "OK" };
    } catch (e) {
      // eBay preferisce 200 per non ritentare all'infinito
      return { statusCode: 200, body: "OK" };
    }
  };