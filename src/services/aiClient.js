// src/services/aiClient.js
export async function zetaSpeak(messages) {
  try {
    const r = await fetch("/api/ai-zeta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error || data?.message || `HTTP ${r.status}`;
      throw new Error(msg);
    }
    if (!data?.text) throw new Error("Empty AI response");
    return data.text;
  } catch (err) {
    console.error("AI-Zeta error:", err);
    return `AI-Zeta: [static] (${err.message})`;
  }
}
