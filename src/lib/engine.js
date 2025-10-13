export const TOTAL_SECONDS = 600; // 10 minutes

export function nextHintIndex(elapsedInPuzzleSec) {
  if (elapsedInPuzzleSec >= 150) return 1; // big hint after 2:30
  if (elapsedInPuzzleSec >= 90) return 0;  // small hint after 1:30
  return -1;
}

export function isTimeUp(globalSecondsLeft) {
  return globalSecondsLeft <= 0;
}

export function advance(puzzleIndex, solved) {
  return solved ? puzzleIndex + 1 : puzzleIndex;
}
