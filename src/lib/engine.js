// src/lib/engine.js
export const TOTAL_SECONDS = 600; // 10 minutes

export function nextHintIndex(elapsedInPuzzleSec) {
  if (elapsedInPuzzleSec >= 150) return 1; // big hint after 2:30
  if (elapsedInPuzzleSec >= 90) return 0;  // small hint after 1:30
  return -1;
}

export function isTimeUp(globalSecondsLeft) {
  return globalSecondsLeft <= 0;
}

export function advance(chan, setIdx, idx, setPhase, stopTicker, setChat) {
  console.log('Executing advance function');
  if (idx + 1 >= PUZZLES.length) {
    console.log('Win condition met');
    setPhase("win");
    stopTicker();
    setChat(prev => [...prev, { role: "assistant", content: "AI-Zeta: Escape vector locked. Hold on…" }]);
    if (chan) chan.send("state", { win: true });
  } else {
    console.log('Advancing to next puzzle');
    setIdx(prev => prev + 1);
    if (chan) chan.send("state", { idx: idx + 1 });
  }
}