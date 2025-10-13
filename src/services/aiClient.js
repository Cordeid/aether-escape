// src/services/aiClient.js
export async function zetaSpeak(messages) {
  try {
    const response = await fetch("/api/ai-zeta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      console.error("AI-Zeta API error:", response.status);
      return "AI-Zeta: [static interference detected]";
    }

    const data = await response.json();
    return data.text || "AI-Zeta: [no signal]";
  } catch (err) {
    console.error("Error contacting AI-Zeta:", err);
    return "AI-Zeta: [communication failure]";
  }
}
