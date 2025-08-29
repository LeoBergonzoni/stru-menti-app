const OpenAI = require("openai");

exports.handler = async (event) => {
  try {
    const { prompt } = JSON.parse(event.body);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // <-- da "gpt-3.5-turbo"
      messages: [
        { role: "system", content: "Riformula frasi in modo gentile, professionale, corretto e chiaro." },
        { role: "user", content: prompt },
      ],
      temperature: 0.5 // leggermente più bassa per toni costanti
    });

    console.log("Risposta da OpenAI:", JSON.stringify(completion, null, 2));

    const response = completion.choices[0].message.content.trim();

    return {
      statusCode: 200,
      body: JSON.stringify({ result: response }),
    };
  } catch (error) {
    console.error("Errore OpenAI:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Errore durante la generazione." }),
    };
  }
};