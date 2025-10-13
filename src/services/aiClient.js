export async function zetaSpeak(lines){
  // Stub: echoes last request so UI works before real OpenAI proxy
  const last = lines?.at(-1)?.content ?? "";
  return `AI-Zeta: [simulated] ${last}`;
}
