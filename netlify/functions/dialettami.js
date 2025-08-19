// netlify/functions/dialettami.js
// Funzione serverless che chiama l'API di OpenAI senza esporre la tua API key
// Imposta OPENAI_API_KEY (e opzionalmente OPENAI_MODEL) nelle Environment Variables di Netlify.

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Metodo non consentito' };
    }

    const { prompt } = JSON.parse(event.body || '{}');
    if (!prompt) {
      return { statusCode: 400, body: 'prompt mancante' };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: 'OPENAI_API_KEY non configurata' };
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Sei un esperto di dialetti italiani. Rispondi sempre in italiano. Rispetta rigorosamente il formato richiesto.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: resp.status, body: t };
    }

    const json = await resp.json();
    const output = json.choices?.[0]?.message?.content || '';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ output })
    };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}
