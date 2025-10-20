// src/data/puzzles.js
//
// Four-step escape room sequence for "Escape from the Aether Station".
// Each puzzle object exposes:
// - id:            stable string id
// - title:         short title
// - prompt:        multi-line in-world text shown to the player
// - answer(txt):   returns true/false (never throws)
// - hints:         optional array of strings (light → stronger)
//
// ------------------------ Helpers ------------------------
function onlyDigits(s = "") {
  return String(s).replace(/\D+/g, "");
}
function normalizeName(s = "") {
  return String(s).trim().toUpperCase().replace(/[^A-Z]/g, "");
}
function normalizeText(s = "") {
  return String(s).trim().toUpperCase();
}

// Colors helper for Puzzle 2
const COLOR_ALIASES = {
  R: "RED", RED: "RED",
  B: "BLUE", BLUE: "BLUE",
  Y: "YELLOW", YEL: "YELLOW", YELLOW: "YELLOW",
  G: "GREEN", GRN: "GREEN", GREEN: "GREEN",
};
function normalizeColorSequence(input = "") {
  const tokens = String(input)
    .toUpperCase()
    .replace(/[^A-Z]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const colors = tokens
    .map(t => COLOR_ALIASES[t])
    .filter(Boolean);
  return colors;
}
function equalsSequence(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ------------------------ Puzzles ------------------------

// 1) Reactor calibration (very easy – warm-up)
//    Equation note on the reactor shell: 2x + 5 = 9  → x = 2
const reactorCalibration = {
  id: "reactor-calibration",
  title: "Reactor Calibration",
  prompt: [
    "AI-Zeta: Primary reactor cold-boot sequence stalled.",
    "You spot a grease-stained note taped to the reactor housing:",
    "“The solution is in the value of x.”",
    "",
    "Equation on the note:",
    "  2x + 5 = 9",
    "",
    "Enter the checksum: **the value of x** (digits only).",
  ].join("\n"),
  answer: (txt) => {
    try {
      return onlyDigits(txt) === "2";
    } catch {
      return false;
    }
  },
  hints: [
    "Solve for x: subtract 5 from both sides, then divide by 2.",
    "x = (9 - 5) / 2 = 2. Enter just the number.",
  ],
};

// 2) Color override sequence (pattern matching)
//    Correct sequence: RED BLUE GREEN YELLOW
const colorOverride = {
  id: "color-override",
  title: "Color Override",
  prompt: [
    "AI-Zeta: Insert energy cells in the correct order to stabilize the core.",
    "Available cells: YELLOW, BLUE, RED, GREEN.",
    "",
    "Recovered rule fragments:",
    "• “Blue feeds on Red’s heat.”",
    "• “Yellow only shines after Blue.”",
    "• “Green follows sunlight but precedes night.”",
    "",
    "Type the colors in order (letters or names). Examples:",
    "  Y G B R   |   RED BLUE YELLOW GREEN   |   RED->BLUE->YELLOW->GREEN",
  ].join("\n"),
  answer: (txt) => {
    try {
      return equalsSequence(normalizeColorSequence(txt), ["RED", "BLUE", "GREEN", "YELLOW"]);
    } catch {
      return false;
    }
  },
  hints: [
    "“Blue feeds on Red’s heat” ⇒ Red must come before Blue.",
    "“Yellow only shines after Blue” ⇒ Blue before Yellow.",
    "If sunlight is Yellow, who follows it? (Green.)",
    "Final order: RED → BLUE → YELLOW → GREEN.",
  ],
};

// 3) Comms decrypt (Caesar cipher, shift back by 3)
//    Encrypted: Vhfuhw → shift back 3 → Secret
const commsDecrypt = {
  id: "comms-decrypt",
  title: "Comms Decrypt",
  prompt: [
    "AI-Zeta: Incoming transmission garbled. Caesar shift detected.",
    "",
    "Encrypted message: VHFUHW",
    "",
    "Directive: “Shift all the dial back three clicks.”",
    "Decode the message (Caesar shift **back** by 3) and enter the plain English word.",
  ].join("\n"),
  answer: (txt) => {
    try {
      return normalizeText(txt) === "SECRET";
    } catch {
      return false;
    }
  },
  hints: [
    "Shift each letter **back** three positions (V→S, H→E, F→C...).",
    "After shifting all letters, you get a common English word used for confidential info.",
  ],
};

// 4) Data core corruption (logic elimination) — culprit: KORA
const dataCoreCorruption = {
  id: "data-core-corruption",
  title: "Data Core Corruption",
  prompt: [
    "AI-Zeta: Five crew accessed the mainframe before the data corruption:",
    "• Ishim (Navigator)",
    "• Kora (Chef)",
    "• Lin (Mechanic)",
    "• Silva (Security)",
    "• Noor (Technician)",
    "",
    "Clues:",
    "5) Noor was wearing sterile gloves in the lab.",
    "4) Silva was guarding the airlock all shift.",
    "3) Lin wears anti-static gloves when near electronics.",
    "2) Kora had just finished cooking a meal.",
    "1) The corrupted logs were typed with greasy fingerprints.",
    "",
    "Who corrupted the data core? Type the **name**.",
    "💡 Tip: if you’re stuck, ask AI-Zeta for a hint.",
  ].join("\n"),
  answer: (txt) => {
    try {
      return normalizeName(txt) === "KORA";
    } catch {
      return false;
    }
  },
  hints: [
    "Sterile gloves leave no grease — likely not Noor.",
    "Who was on guard duty all shift? Cross them out.",
    "Anti-static gloves prevent direct fingerprints — remove that person.",
    "Who likely had greasy hands from cooking?",
    "Greasy fingerprints after cooking ⇒ **Kora**.",
  ],
};

// Export in order (easy → hard). App can decorate with [index/total] at render time.
export const PUZZLES = [
  reactorCalibration,
  colorOverride,
  commsDecrypt,
  dataCoreCorruption,
];