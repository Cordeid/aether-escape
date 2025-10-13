// /api/gemini-diagnose.js
export default async function handler(req, res) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }
    const url = "https://generativelanguage.googleapis.com/v1beta/models";
    const r = await fetch(`${url}?key=${process.env.GEMINI_API_KEY}`);
    const data = await r.json();
    return res.status(r.ok ? 200 : 500).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
