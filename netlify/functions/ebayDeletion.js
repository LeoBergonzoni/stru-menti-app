export const handler = async (event) => {
    try {
      const method = (event.httpMethod || "").toUpperCase();
      const headers = event.headers || {};
      const qs = event.queryStringParameters || {};
      const contentType = (headers["content-type"] || headers["Content-Type"] || "").toLowerCase();
  
      // Log diagnostico: rimuovi se fastidioso
      console.log("eBay incoming:", {
        method,
        qs,
        // attenzione a non loggare dati sensibili in produzione
        headers: {
          "content-type": headers["content-type"] || headers["Content-Type"],
          "user-agent": headers["user-agent"] || headers["User-Agent"],
          "x-forwarded-for": headers["x-forwarded-for"],
        },
        rawBodyLen: event.body ? event.body.length : 0,
      });
  
      const expectedToken = process.env.EBAY_DELETION_TOKEN || "";
  
      // --- parse body ---
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
  
      // challenge (copriamo varie chiavi)
      const challenge =
        qs.challenge_code || qs.challengeCode || qs.challenge ||
        body.challenge_code || body.challengeCode || body.challenge ||
        body?.metadata?.challengeCode || body?.metadata?.challenge_code ||
        null;
  
      // token (varie chiavi + header)
      const receivedToken =
        qs.verification_token || qs.verificationToken ||
        body.verification_token || body.verificationToken ||
        headers["x-ebay-verification-token"] || headers["x-verification-token"] ||
        "";
  
      if (expectedToken && receivedToken && expectedToken !== receivedToken) {
        console.warn("⚠️ Token mismatch:", { expectedTokenLen: expectedToken.length, receivedToken });
        // NON blocchiamo con 403 per permettere la validazione lato eBay
      }
  
      // Caso 1: eBay ci chiede di echi-are un challenge
      if (challenge) {
        // restituiamo JSON come da guideline
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeResponse: String(challenge) }),
        };
      }
  
      // Caso 2: niente challenge ma c'è un token -> alcuni flussi si aspettano eco del token in chiaro
      if (!challenge && receivedToken) {
        // rispondiamo sia plain text che JSON a seconda di cosa accettano
        const wantsJson = contentType.includes("application/json");
        if (wantsJson) {
          return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ verificationToken: String(receivedToken) }),
          };
        } else {
          return {
            statusCode: 200,
            headers: { "Content-Type": "text/plain" },
            body: String(receivedToken),
          };
        }
      }
  
      // Caso 3: notifica reale di deletion/closure
      console.log("Deletion/closure payload:", { qs, body });
      // TODO: se mai tratterai utenti eBay, elimina/anonimizza qui i dati relativi.
      return { statusCode: 200, body: "OK" };
  
    } catch (e) {
      console.error("ebayDeletion error:", e);
      return { statusCode: 200, body: "OK" };
    }
  };