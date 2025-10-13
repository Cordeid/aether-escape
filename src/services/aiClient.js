// api/ai-zeta.js
export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, message: "ai-zeta alive" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { messages = [] } = req.body || {};
    const system = {
      role: "system",
      content:
        "You are AI-Zeta, a damaged but helpful station AI. Speak concisely in character. Give nudges, never full answers. Stay immersive.",
    };

    // Prefer Gemini if present; otherwise use OpenAI
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY; // just in case

    if (!GEMINI_KEY && !OPENAI_KEY) {
      return res.status(500).json({ error: "No AI key set. Add GEMINI_API_KEY or OPENAI_API_KEY in Vercel." });
    }

    // --- Gemini path ---------------------------------------------------------
    if (GEMINI_KEY) {
      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
        encodeURIComponent(GEMINI_KEY);

      // Convert OpenAI-style messages to Gemini "contents"
      const contents = [system, ...messages].map((m) => ({
        role: m.role === "system" ? "user" : m.role, // Gemini roles: user/model; system merged into first user
        parts: [{ text: m.content }],
      }));

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      });

      const data = await r.json();
      if (!r.ok) {
        const msg = data?.error?.message || JSON.stringify(data);
        return res.status(r.status).json({ error: `Gemini error: ${msg}` });
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!text) return res.status(500).json({ error: "Gemini: empty response" });

      return res.status(200).json({ text });
    }

    // --- OpenAI path ---------------------------------------------------------
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
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
    return res.status(500).json({ error: err.message || "Unknown server error" });
  }
}
