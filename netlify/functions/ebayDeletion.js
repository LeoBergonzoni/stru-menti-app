// netlify/functions/ebayDeletion.js
export const handler = async (event) => {
    try {
      const method = (event.httpMethod || "").toUpperCase();
      const headers = event.headers || {};
      const qs = event.queryStringParameters || {};
      const contentType = (headers["content-type"] || headers["Content-Type"] || "").toLowerCase();
  
      const expectedToken = process.env.EBAY_DELETION_TOKEN || "";
  
      // --- Estrai payload da POST (JSON o x-www-form-urlencoded) ---
      let body = {};
      if (method === "POST" && event.body) {
        if (contentType.includes("application/json")) {
          try { body = JSON.parse(event.body); } catch { body = {}; }
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          body = Object.fromEntries(new URLSearchParams(event.body));
        } else {
          // prova comunque JSON
          try { body = JSON.parse(event.body); } catch { body = {}; }
        }
      }
  
      // --- eBay può mandare challenge & token in vari campi (GET o POST) ---
      const challenge =
        qs.challenge_code || qs.challengeCode || qs.challenge ||
        body.challenge_code || body.challengeCode || body.challenge ||
        body?.metadata?.challengeCode || body?.metadata?.challenge_code ||
        null;
  
      // eBay mette il token che hai configurato in console qui (nome campo può variare)
      const receivedToken =
        qs.verification_token || qs.verificationToken ||
        body.verification_token || body.verificationToken ||
        headers["x-ebay-verification-token"] || headers["x-verification-token"] ||
        "";
  
      // Se hai impostato un token, deve combaciare
      if (expectedToken && receivedToken && expectedToken !== receivedToken) {
        // Per sicurezza logghiamo
        console.warn("Invalid verification token:", { receivedToken });
        return { statusCode: 403, body: "Invalid verification token" };
      }
  
      // --- Fase di VALIDAZIONE: bisogna ECHIARE il challenge ---
      if (challenge) {
        // Alcune integrazioni vogliono JSON { "challengeResponse": "<code>" }
        // Altre accettano plain text. Usiamo JSON ufficiale.
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeResponse: String(challenge) }),
        };
      }
  
      // --- Notifica reale di account deletion/closure ---
      console.log("eBay deletion/closure notification:", {
        method, qs, headers, body,
      });
  
      // TODO: se mai gestirai utenti eBay, cancella/anonimizza qui i loro dati.
      return { statusCode: 200, body: "OK" };
    } catch (e) {
      console.error("ebayDeletion error:", e);
      // eBay preferisce 200 per non riprovare in loop
      return { statusCode: 200, body: "OK" };
    }
  };