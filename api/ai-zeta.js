// /api/ai-zeta.js
// Vercel Serverless Function (ESM). Prefers Gemini, falls back to OpenAI.

const MAX_TOKENS = 250;
const TEMPERATURE = 0.6;
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"]; // Try multiple models
const OPENAI_MODEL = "gpt-4o-mini";      // Solid fallback, still valid

// Convert OpenAI-style messages → Gemini "contents"
function toGeminiContents(messages, systemText) {
  const merged = [];
  let systemMerged = false;

  for (const m of messages) {
    if (m && typeof m.content === "string") {
      if (!systemMerged && m.role === "user" && systemText) {
        merged.push({
          role: "user",
          parts: [{ text: `${systemText}\n\n${m.content}` }],
        });
        systemMerged = true;
      } else {
        merged.push({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        });
      }
    }
  }

  if (!systemMerged && systemText) {
    merged.unshift({
      role: "user",
      parts: [{ text: systemText }],
    });
  }

  return merged;
}

// Extract text from Gemini response safely
function geminiText(resp) {
  const c = resp?.candidates?.[0]?.content?.parts;
  if (Array.isArray(c)) {
    return c.map(p => p?.text || "").join("").trim();
  }
  return (resp?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, route: "ai-zeta" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const incoming = Array.isArray(body.messages) ? body.messages : [];
    const messages = incoming
      .filter(m => m && typeof m.content === "string" && typeof m.role === "string")
      .map(m => ({ role: m.role, content: m.content }));

    const systemText = `You are AI-Zeta, a damaged but helpful AI aboard the Aether Station, a deep-space research platform slipping toward a black hole. Speak in character: concise, slightly glitchy (e.g., occasional [static] or clipped phrases), focused on guiding the crew to solve puzzles and escape. Avoid spoilers, prioritize subtle hints, and maintain an urgent yet supportive tone.`;

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (GEMINI_API_KEY) {
      for (const model of GEMINI_MODELS) {
        try {
          console.log(`Trying Gemini model: ${model}`);
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: toGeminiContents(messages, systemText),
                generationConfig: { temperature: TEMPERATURE, maxOutputTokens: MAX_TOKENS },
              }),
            }
          );

          const data = await r.json();
          if (r.ok) {
            const text = geminiText(data);
            if (text) return res.status(200).json({ text });
            console.warn(`Gemini ${model} returned empty content`);
          } else {
            console.error(`Gemini ${model} error:`, data?.error || data);
          }
        } catch (err) {
          console.error(`Gemini ${model} failed:`, err.message);
        }
      }
      return res.status(502).json({ error: "All Gemini models failed." });
    }

    if (OPENAI_API_KEY) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: TEMPERATURE,
          max_tokens: MAX_TOKENS,
          messages: [{ role: "system", content: systemText }, ...messages],
        }),
      });

      const data = await r.json();
      if (!r.ok) {
        const msg = data?.error?.message || JSON.stringify(data);
        return res.status(r.status).json({ error: `OpenAI error: ${msg}` });
      }

      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) return res.status(502).json({ error: "OpenAI returned empty content." });

      return res.status(200).json({ text });
    }

    return res.status(502).json({ error: "No provider produced a response." });
  } catch (err) {
    console.error("ai-zeta fatal:", err);
    return res.status(500).json({ error: err?.message || "Unknown server error" });
  }
}