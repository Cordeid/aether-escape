// /api/ai-zeta.js
// Vercel Serverless Function (ESM). Prefers Gemini, falls back to OpenAI.

const MAX_TOKENS = 250;
const TEMPERATURE = 0.6;
const GEMINI_MODEL = "gemini-2.5-flash"; // Updated to supported model
const OPENAI_MODEL = "gpt-4o-mini";      // Solid fallback, still valid

// Convert OpenAI-style messages → Gemini "contents"
function toGeminiContents(messages, systemText) {
  // Merge the system prompt into the first user message (Gemini has no system role)
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

  // If there was no user message at all, seed with system prompt
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
      // Health check
      return res.status(200).json({ ok: true, route: "ai-zeta" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Parse body (string or object)
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const incoming = Array.isArray(body.messages) ? body.messages : [];

    // Normalize messages to minimal OpenAI-like structure
    const messages = incoming
      .filter(m => m && typeof m.content === "string" && typeof m.role === "string")
      .map(m => ({ role: m.role, content: m.content }));

    const systemText = `You are AI-Zeta, a damaged but helpful AI aboard the Aether Station, a deep-space research platform slipping toward a black hole. Speak in character: concise, slightly glitchy (e.g., occasional [static] or clipped phrases), focused on guiding the crew to solve puzzles and escape. Avoid spoilers, prioritize subtle hints, and maintain an urgent yet supportive tone.`;

    // ─────────────────────────────────────────────────────────────
    // 1) Try Gemini first (if key exists)
    // ─────────────────────────────────────────────────────────────
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (GEMINI_API_KEY) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: toGeminiContents(messages, systemText),
              generationConfig: {
                temperature: TEMPERATURE,
                maxOutputTokens: MAX_TOKENS,
              },
            }),
          }
        );

        const data = await r.json();
        if (!r.ok) {
          // If we have OpenAI, fall through to OpenAI
          if (OPENAI_API_KEY) {
            console.warn("Gemini failed, falling back to OpenAI:", data?.error || data);
          } else {
            const msg = data?.error?.message || JSON.stringify(data);
            return res.status(r.status).json({ error: `Gemini error: ${msg}` });
          }
        } else {
          const text = geminiText(data);
          if (text) return res.status(200).json({ text });
          // Empty text → try OpenAI if available
          if (!OPENAI_API_KEY) {
            return res.status(502).json({ error: "Gemini returned empty content." });
          }
        }
      } catch (err) {
        // Network/parse error; try OpenAI if available
        if (!OPENAI_API_KEY) {
          return res.status(502).json({ error: `Gemini error: ${err.message}` });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2) Fallback: OpenAI (if key exists)
    // ─────────────────────────────────────────────────────────────
    if (OPENAI_API_KEY) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
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

    // If we got here, no provider succeeded
    return res.status(502).json({ error: "No provider produced a response." });
  } catch (err) {
    console.error("ai-zeta fatal:", err);
    return res.status(500).json({ error: err?.message || "Unknown server error" });
  }
}