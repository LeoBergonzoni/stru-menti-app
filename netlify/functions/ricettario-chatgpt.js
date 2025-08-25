const fetch = require('node-fetch');

exports.handler = async function (event) {
  try {
    const { ingredients = [], location = "a casa", mode = "svuota" } = JSON.parse(event.body || '{}');

    const ingList = Array.isArray(ingredients) ? ingredients.filter(Boolean) : [];

    const promptSvuota = `Genera una ricetta semplice e veloce da preparare con ${ingList.join(", ")} da mangiare ${location}. Scarta pure alcuni ingredienti che ti ho detto se non sono consoni ad una ricetta. Dammi prima il titolo della ricetta in una singola riga, poi gli ingredienti necessari e infine i passaggi in maniera più semplice possibile. Usa uno stile semplice, come una ricetta da blog.`;

    const promptFantasia = `Sei uno chef creativo. Genera una ricetta più gustosa e appetitosa possibile in cui l’ingrediente o gli ingredienti principali sono ${ingList.join(", ")} da mangiare ${location}. Sentiti libero di aggiungere tutti gli ingredienti ulteriori come contorni, condimenti, spezie e salse che pensi possano servire a creare un’ottima ricetta quasi da ristorante stellato. \n\nRispondi in JSON **valido** con questa forma esatta: {"title": string, "instructions": string, "shopping_list": Array<(string | {"item": string, "qty"?: number|string, "unit"?: string})>} . \nNon aggiungere testo fuori dal JSON.`;

    const prompt = mode === 'fantasia' ? promptFantasia : promptSvuota;
    const temperature = mode === 'fantasia' ? 0.85 : 0.7;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature,
      }),
    });

    if(!response.ok){
      const errText = await response.text().catch(()=>"");
      return { statusCode: response.status, body: JSON.stringify({ error: "OpenAI error", details: errText }) };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Errore nella generazione della ricetta.";

    return { statusCode: 200, body: JSON.stringify({ message: content, mode }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Errore nella funzione o nella chiamata API.", details: String(err && err.message || err) }) };
  }
};
