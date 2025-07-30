const fetch = require('node-fetch');

exports.handler = async function (event) {
  const { ingredients, location } = JSON.parse(event.body);

  const prompt = `Genera una ricetta semplice e veloce da preparare con ${ingredients.join(", ")} da mangiare ${location}. Scarta pure alcuni ingredienti che ti ho detto se non sono consoni ad una ricetta. Dammi prima il titolo della ricetta in una singola riga, poi gli ingredienti necessari e infine i passaggi in maniera più semplice possibile. Usa uno stile semplice, come una ricetta da blog.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Errore nella generazione della ricetta.";

    return {
      statusCode: 200,
      body: JSON.stringify({ message: content }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Errore nella funzione o nella chiamata API." }),
    };
  }
};