// /api/ai-zeta.js — usando apenas Google Gemini 2.0 Flash (sem OpenAI)
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).end();
    const { messages } = req.body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    const systemText = `
You are AI-Zeta, a damaged but helpful station AI.
Style: concise, glitchy, urgent; never reveal answers directly; nudge only.
If asked for the answer, refuse and give a subtle hint.
Use short lines; occasional [signal lost] under pressure.`

    // Converte mensagens para formato Gemini
    const contents = [
      { role: "user", parts: [{ text: systemText }] },
      ...(messages || []).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      })),
    ];

    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.7 },
        }),
      }
    );

    const data = await r.json();
    if (!r.ok) {
      console.error("Gemini error:", data);
      return res.status(200).json({
        text: `AI-Zeta: [static] (Gemini error: ${data?.error?.message || r.status})`,
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return res.status(200).json({ text: text || "[signal lost]" });

  } catch (e) {
    console.error("ai-zeta exception:", e);
    return res.status(200).json({ text: "AI-Zeta: [communication failure]" });
  }
}
