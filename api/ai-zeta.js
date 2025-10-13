// /api/ai-zeta.js — Hybrid: OpenAI first, Gemini fallback
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).end();
    const { messages } = req.body || {};

    const systemText =
`You are AI-Zeta, a damaged but helpful station AI.
Style: concise, glitchy, urgent; never reveal answers directly; nudge only.
If asked for the answer, refuse and give a subtle hint.
Use short lines; occasional [signal lost] under pressure.`;

    // ---------- helpers ----------
    const toOpenAiMessages = () => [
      { role: "system", content: systemText },
      ...(messages || []),
    ];

    const toGeminiContents = () => [
      { role: "user", parts: [{ text: systemText }] },
      ...(messages || []).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      })),
    ];

    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    async function callOpenAI() {
      if (!openaiKey) {
        return { ok: false, why: "no-openai-key" };
      }
      const payload = {
        model: "gpt-3.5-turbo",
        messages: toOpenAiMessages(),
        temperature: 0.7
      };
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
          // Optionally set org: "OpenAI-Organization": "org_xxx",
        },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) {
        const msg = data?.error?.message || `OpenAI status ${r.status}`;
        return { ok: false, why: msg };
      }
      const text = data?.choices?.[0]?.message?.content;
      if (!text) return { ok: false, why: "openai-empty" };
      return { ok: true, text };
    }

    async function callGemini() {
      if (!geminiKey) {
        return { ok: false, why: "no-gemini-key" };
      }
      const payload = {
        contents: toGeminiContents(),
        generationConfig: { temperature: 0.7 }
      };
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await r.json();
      if (!r.ok) {
        const msg = data?.error?.message || `Gemini status ${r.status}`;
        return { ok: false, why: msg };
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { ok: false, why: "gemini-empty" };
      return { ok: true, text };
    }

    // ---------- try OpenAI, then fallback to Gemini ----------
    const oai = await callOpenAI();
    if (oai.ok) {
      return res.status(200).json({ text: oai.text });
    }

    // If OpenAI failed due to quota/forbidden/etc, try Gemini
    const fallbackEligible = String(oai.why || "").match(/quota|forbidden|not found|no-openai-key|openai-empty/i);
    if (fallbackEligible) {
      const gem = await callGemini();
      if (gem.ok) return res.status(200).json({ text: gem.text });
      console.error("Gemini also failed:", gem.why);
      return res.status(200).json({ text: `AI-Zeta: [static] (Gemini error: ${gem.why})` });
    }

    // OpenAI failed but reason wasn’t a typical fallback trigger
    console.error("OpenAI error:", oai.why);
    return res.status(200).json({ text: `AI-Zeta: [static] (${oai.why})` });
  } catch (e) {
    console.error("ai-zeta exception:", e);
    return res.status(200).json({ text: "AI-Zeta: [communication failure]" });
  }
}
