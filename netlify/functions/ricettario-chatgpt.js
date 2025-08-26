const fetch = require('node-fetch');

exports.handler = async function (event) {
  try {
    const {
      ingredients = [],
      location = "a casa",
      mode = "svuota",
      variant = ""
    } = JSON.parse(event.body || '{}');

    const ingList = Array.isArray(ingredients) ? ingredients.filter(Boolean) : [];

    // Clausole per le varianti
    const variantClause = {
      "": "",
      "light": " Rendi la ricetta leggera (pochi grassi, cotture leggere, porzioni equilibrate).",
      "vegetariana": " Rendi la ricetta rigorosamente vegetariana, senza carne né pesce.",
      "veloce": " Ottimizza per velocità: massimo 20 minuti e pochi passaggi, ingredienti facilmente reperibili."
    }[variant] || "";

    // 🔸 "Svuota frigo": ora chiediamo JSON con shopping_list
    const promptSvuota =
      `Genera una ricetta semplice e veloce da preparare con ${ingList.join(", ")} da mangiare ${location}. ` +
      `Scarta pure alcuni ingredienti che ti ho detto se non sono consoni ad una ricetta.` +
      variantClause +
      `\n\nRispondi in JSON valido con questa forma esatta: ` +
      `{"title": string, "instructions": string, "shopping_list": Array<(string | {"item": string, "qty"?: number|string, "unit"?: string})>}. ` +
      `Non aggiungere testo fuori dal JSON.`;

    // 🔸 "Fantasia": stesso schema JSON
    const promptFantasia =
      `Sei uno chef creativo. Genera una ricetta più gustosa e appetitosa possibile in cui l’ingrediente o gli ingredienti principali sono ${ingList.join(", ")} da mangiare ${location}. ` +
      `Sentiti libero di aggiungere tutti gli ingredienti ulteriori come contorni, condimenti, spezie e salse che pensi possano servire a creare un’ottima ricetta quasi da ristorante stellato.` +
      variantClause +
      `\n\nRispondi in JSON valido con questa forma esatta: ` +
      `{"title": string, "instructions": string, "shopping_list": Array<(string | {"item": string, "qty"?: number|string, "unit"?: string})>}. ` +
      `Non aggiungere testo fuori dal JSON.`;

    const prompt = mode === 'fantasia' ? promptFantasia : promptSvuota;

    const body = {
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: mode === 'fantasia' ? 0.6 : 0.5,
      // ✅ forziamo JSON per entrambe le modalità
      response_format: { type: "json_object" }
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return { statusCode: response.status, body: JSON.stringify({ error: "OpenAI error", details: errText }) };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Errore nella generazione della ricetta.";

    return { statusCode: 200, body: JSON.stringify({ message: content, mode, variant }) };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Errore nella funzione o nella chiamata API.", details: String((err && err.message) || err) })
    };
  }
};