// /api/ai-zeta.js
// Vercel Serverless Function (ESM). Prefers Gemini, falls back to OpenAI.

const MAX_TOKENS = 250;
const TEMPERATURE = 0.6;
const GEMINI_MODEL = "gemini-1.5-flash"; // fast, cheap, great for hints
const OPENAI_MODEL = "gpt-4o-mini";      // solid fallback

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

    const systemText =
      "You are **AI-Zeta**, Aether Station’s damaged but helpful onboard AI. " +
      "Speak briefly, glitchy, immersive. Nudge players; never reveal full answers. " +
      "Stay in-character. Keep replies to 1–3 short lines.";

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
    const OPENAI_API_KEY =
      process.env.OPENAI_API_KEY?.trim() || process.env.OPENAI_APIKEY?.trim();

    if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ error: "No AI key configured. Set GEMINI_API_KEY or OPENAI_API_KEY in Vercel." });
    }

    // ─────────────────────────────────────────────────────────────
    // 1) Try Gemini first (if key is present)
    // ─────────────────────────────────────────────────────────────
    if (GEMINI_API_KEY) {
      try {
        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` +
          `?key=${encodeURIComponent(GEMINI_API_KEY)}`;

        const contents = toGeminiContents(messages, systemText);

        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: {
              maxOutputTokens: MAX_TOKENS,
              temperature: TEMPERATURE,
            },
          }),
        });

        const data = await r.json();
        if (!r.ok) {
          // If Gemini fails but we have OpenAI, fall through to OpenAI
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
