// netlify/functions/ebayDeletion.js
export const handler = async (event) => {
    try {
      // eBay invia POST JSON; in “verification/ping” include un codice di challenge.
      const body = event.body ? JSON.parse(event.body) : {};
      const headers = event.headers || {};
  
      // (opzionale) Confronta un token che imposti tu su eBay console con quello che ricevi.
      // Alcune integrazioni lo mandano nel payload o in header personalizzati: gestiamo genericamente.
      const expected = process.env.EBAY_DELETION_TOKEN || "";
      const received =
        body.verificationToken ||
        headers["x-ebay-verification-token"] ||
        headers["x-verification-token"] ||
        "";
  
      if (expected && received && expected !== received) {
        return { statusCode: 403, body: "Invalid verification token" };
      }
  
      // 1) Verifica: eBay può mandare una challenge (nome campo può variare: gestiamo generico)
      const challenge =
        body?.challengeCode || body?.challenge || body?.metadata?.challengeCode;
  
      if (challenge) {
        // Rispondi col codice di challenge per confermare la presa in carico dell’endpoint.
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeResponse: challenge }),
        };
      }
  
      // 2) Notifica reale di “account deletion / closure”
      // Qui NON c’è nulla da fare, a meno che tu non conservi dati di utenti eBay.
      // Log utile e risposta 200.
      console.log("eBay deletion/closure notification:", JSON.stringify(body));
      // TODO: se mai collegassi utenti eBay, cancella/anonimizza qui i loro dati.
  
      return { statusCode: 200, body: "OK" };
    } catch (e) {
      console.error("ebayDeletion error:", e);
      return { statusCode: 200, body: "OK" }; // eBay vuole 200, non 5xx
    }
  };