// src/services/aiClient.js
// Frontend helper to talk to /api/ai-zeta with solid error handling.

const TIMEOUT_MS = 20000;     // 20s hard timeout
const RETRIES = 1;            // one retry on transient failures

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function postJson(url, payload, signal) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

/**
 * Send OpenAI-like chat messages to AI-Zeta.
 * messages = [{ role: "user"|"assistant"|"system", content: "..." }, ...]
 * Returns a string (always) so the UI never feels broken.
 */
export async function zetaSpeak(messages) {
  // Basic validation
  const msgs = (Array.isArray(messages) ? messages : [])
    .filter(m => m && typeof m.content === "string" && typeof m.role === "string")
    .map(m => ({ role: m.role, content: m.content }));

  // Add a minimal user message if none provided (prevents empty calls)
  const safeMessages = msgs.length ? msgs : [{ role: "user", content: "Status?" }];

  let lastErr = null;

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    try {
      const { ok, status, data } = await postJson("/api/ai-zeta", { messages: safeMessages }, ctrl.signal);
      clearTimeout(to);

      if (!ok || data?.error) {
        lastErr = new Error(data?.error || `HTTP ${status}`);
        // retry only on 5xx or aborted
        if (attempt < RETRIES && (status >= 500 || status === 0)) {
          await sleep(400 + Math.random() * 400);
          continue;
        }
        throw lastErr;
      }

      const text = (data?.text || "").trim();
      if (text) return text;
      throw new Error("Empty AI response");
    } catch (err) {
      clearTimeout(to);
      lastErr = err;
      // Retry once on abort/fetch issues
      if (attempt < RETRIES) {
        await sleep(300 + Math.random() * 300);
        continue;
      }
    }
  }

  console.error("AI-Zeta error:", lastErr);
  // Always return a line so the chat shows *something*
  return `AI-Zeta: [static] (${lastErr?.message || "unavailable"})`;
}
