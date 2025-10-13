// /api/ai-zeta.js  — versão para Gemini
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).end();
    const { messages } = req.body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ text: "AI-Zeta: [missing GEMINI_API_KEY]" });
    }

    // Define a personalidade do AI-Zeta
    const systemPrompt = `
      You are AI-Zeta, a damaged but helpful AI aboard the Aether Station.
      Style: glitchy, urgent, concise, uses ellipses and [static] sounds occasionally.
      Never reveal answers directly; instead, guide the player with cryptic hints.
    `;

    // Converte mensagens no formato do Gemini API
    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      ...(messages || []).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }))
    ];

    // Requisição à API do Gemini
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({ contents, generationConfig: { temperature: 0.7 } })
      }
    );

    const data = await r.json();

    if (!r.ok) {
      console.error("Gemini API error:", data);
      return res.status(200).json({ text: `AI-Zeta: [static] (${data.error?.message || r.status})` });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "AI-Zeta: [signal lost]";

    res.status(200).json({ text });
  } catch (err) {
    console.error("AI-Zeta error:", err);
    res.status(200).json({ text: "AI-Zeta: [communication failure]" });
  }
}
