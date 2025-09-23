// netlify/functions/ebayDeletion.js
export const handler = async (event) => {
    try {
      const method = (event.httpMethod || "").toUpperCase();
      const qs = event.queryStringParameters || {};
      const headers = {
        // nessun body: solo header
        "Content-Type": "text/plain",
      };
  
      const expectedToken = process.env.EBAY_DELETION_TOKEN || "";
      if (expectedToken) headers["x-ebay-verification-token"] = expectedToken;
  
      // challenge in GET/POST (qui leggiamo solo GET per essere extra-semplici)
      const challenge =
        qs.challenge_code || qs.challengeCode || qs.challenge || null;
  
      if (challenge) {
        headers["x-ebay-challenge-response"] = String(challenge);
        return {
          statusCode: 200,
          headers,
          body: "", // <-- body vuoto
        };
      }
  
      // fallback: 200 liscio
      return { statusCode: 200, headers, body: "" };
    } catch {
      return { statusCode: 200, body: "" };
    }
  };