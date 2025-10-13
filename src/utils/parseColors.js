// src/utils/parseColors.js
const COLOR_ALIASES = {
  R: "RED", RED: "RED",
  B: "BLUE", BLUE: "BLUE",
  Y: "YELLOW", YEL: "YELLOW", YELLOW: "YELLOW",
  G: "GREEN", GRN: "GREEN", GREEN: "GREEN",
};

export function normalizeColorSequence(input = "") {
  const tokens = input
    .toUpperCase()
    .replace(/[^A-Z]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return tokens.map(t => COLOR_ALIASES[t]).filter(Boolean);
}

export function equalsSequence(a, b) {
  if (a.length !== b.length) return false;
  return a.every((c, i) => c === b[i]);
}
