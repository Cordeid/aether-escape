export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { messages } = req.body || {};
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  const system = {
    role: "system",
    content:
`You are AI-Zeta, a damaged but helpful station AI.
Style: concise, glitchy, urgent, never reveal answers, only nudge.
If asked for the answer directly, refuse politely and offer a subtle hint.
Use short lines; occasional [signal lost] under pressure.`
  };

  const payload = {
    model: "gpt-4o-mini",
    messages: [system, ...(messages || [])],
    temperature: 0.7,
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content ?? "…[static]…";
  return res.status(200).json({ text });
}
