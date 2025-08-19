export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Metodo non consentito' };
    }

    const { prompt, mode, dialect } = JSON.parse(event.body || '{}');

    if (!prompt || !mode) {
      return { statusCode: 400, body: 'prompt o mode mancante' };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: 'OPENAI_API_KEY non configurata' };
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    let systemPrompt = 'Sei un esperto di dialetti italiani. Rispondi sempre in italiano.';

    if (mode === 'it_to_dia') {
      systemPrompt += ` Traduci la frase da italiano a dialetto${dialect ? ` ${dialect}` : ''} e spiega brevemente il significato di eventuali termini dialettali usati.`;
    } else if (mode === 'dia_to_it') {
      systemPrompt += ` Traduci la frase da dialetto a italiano e spiega brevemente i termini usati.`;
    } else {
      return { statusCode: 400, body: 'mode non valido' };
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
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
      body: JSON.stringify({ result: output })
    };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}