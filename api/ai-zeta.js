// /api/ai-zeta.js
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const { messages } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ text: "AI-Zeta: [server missing OPENAI_API_KEY]" });
    }

    // Prefer a widely available model; adjust if your account supports others
    const MODEL_PRIMARY = "gpt-4o-mini";
    const MODEL_FALLBACK = "gpt-3.5-turbo";

    const system = {
      role: "system",
      content:
`You are AI-Zeta, a damaged but helpful station AI.
Style: concise, glitchy, urgent; never reveal answers directly; only nudge.
If asked for the answer, refuse and give a subtle hint.
Short lines; occasional [signal lost] under pressure.`,
    };

    async function callOpenAI(model) {
      const payload = { model, messages: [system, ...(messages || [])], temperature: 0.7 };
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      return { ok: r.ok, status: r.status, data };
    }

    // Try primary model
    let { ok, status, data } = await callOpenAI(MODEL_PRIMARY);

    // If model not found/forbidden, try fallback
    if (!ok && (status === 404 || status === 400 || status === 403)) {
      const alt = await callOpenAI(MODEL_FALLBACK);
      ok = alt.ok; status = alt.status; data = alt.data;
    }

    if (!ok) {
      const errMsg = data?.error?.message || `OpenAI error status ${status}`;
      console.error("ai-zeta error:", errMsg);
      return res.status(200).json({ text: `AI-Zeta: [static] (${errMsg})` });
    }

    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      console.error("ai-zeta: empty response", data);
      return res.status(200).json({ text: "AI-Zeta: [static]" });
    }
    return res.status(200).json({ text });
  } catch (e) {
    console.error("ai-zeta exception:", e);
    return res.status(200).json({ text: "AI-Zeta: [communication failure]" });
  }
}
