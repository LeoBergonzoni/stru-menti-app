// checkPrice.js aggiornato
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.handler = async function (event, context) {
  try {
    const { product, price, location } = JSON.parse(event.body);

    const prompt = `
Analizza il prezzo di mercato di un prodotto e fornisci una valutazione standardizzata.
Dati:
- Prodotto: "${product}"
- Prezzo: ${price}€
- Luogo: ${location}

Rispondi SOLO nel formato:
Prezzo medio stimato: X€
Valutazione: [sotto la media | nella media | sopra la media | molto sopra la media]

Se non hai abbastanza dati, scrivi:
Prezzo medio stimato: non disponibile
Valutazione: non determinabile
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3, // meno variabilità
      max_tokens: 120,
    });

    const text = response.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Risposta vuota da OpenAI" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ result: text }),
    };
  } catch (error) {
    console.error("Errore nella funzione checkPrice:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Errore interno nella funzione" }),
    };
  }
};