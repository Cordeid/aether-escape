// /api/ai-zeta.js
// Vercel Serverless Function (CommonJS)

const MAX_TOKENS = 250; // keep replies short

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      // health check
      return res.status(200).json({ ok: true, route: "ai-zeta" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const system = {
      role: "system",
      content:
        "You are AI-Zeta, a damaged but helpful space-station AI. Speak concisely, glitchy, immersive. Never reveal puzzle answers outright; provide gentle nudges only.",
    };

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY;

    if (!GEMINI_KEY && !OPENAI_KEY) {
      return res.status(500).json({
        error: "No model key configured. Set GEMINI_API_KEY or OPENAI_API_KEY in Vercel → Project → Settings → Environment Variables.",
      });
    }

    // ── Try Gemini first ───────────────────────────────────────────────────────
    if (GEMINI_KEY) {
      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
        encodeURIComponent(GEMINI_KEY);

      // Gemini expects "contents": [{role:'user'|'model', parts:[{text}]}]
      // We’ll merge the system into the first user message.
      const oai = [system, ...messages];
      const firstUserIndex = oai.findIndex((m) => m.role === "user");
      let merged = oai.slice();
      if (firstUserIndex >= 0) {
        merged[firstUserIndex] = {
          role: "user",
          content: `${system.content}\n\n${oai[firstUserIndex].content}`,
        };
        merged = merged.filter((m, i) => i !== 0); // drop original system at index 0
      }

      const contents = merged.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content || "") }],
      }));

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.6 },
        }),
      });

      const data = await r.json();
      if (!r.ok) {
        const msg = data?.error?.message || JSON.stringify(data);
        return res.status(r.status).json({ error: `Gemini error: ${msg}` });
      }

      const text =
        data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).join("") ||
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "";

      if (!text) return res.status(500).json({ error: "Gemini: empty response" });
      return res.status(200).json({ text });
    }

    // ── Fallback: OpenAI ───────────────────────────────────────────────────────
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        max_tokens: MAX_TOKENS,
        messages: [system, ...messages],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      return res.status(r.status).json({ error: `OpenAI error: ${msg}` });
    }

    const text = data?.choices?.[0]?.message?.content || "";
    if (!text) return res.status(500).json({ error: "OpenAI: empty response" });

    return res.status(200).json({ text });
  } catch (err) {
    console.error("ai-zeta server error:", err);
    return res.status(500).json({ error: err?.message || "Unknown server error" });
  }
};
