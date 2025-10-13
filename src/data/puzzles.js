// src/data/puzzles.js
import { normalizeColorSequence, equalsSequence } from "../utils/parseColors";

// small helper for name normalization (used in puzzle 4)
function normName(s = "") {
  return s.trim().toUpperCase().replace(/[^A-Z]/g, "");
}

export const PUZZLES = [
  // 1) EASY — math warm-up (confidence builder)
  {
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
      "Enter the checksum: **the value of x** (digits only)."
    ].join("\n"),
    // 2x + 5 = 9  -> 2x = 4 -> x = 2
    answer: (txt) => txt.replace(/\D/g, "") === "2",
    hints: [
      "Rearrange: 2x + 5 = 9 → 2x = 9 − 5.",
      "Now divide by 2. Digits only."
    ],
  },

  // 2) MEDIUM — color routing (RBYG)
  {
    id: "color-override",
    title: "Color Override",
    prompt: [
      "AI-Zeta: To stabilize the energy core, insert the cells in the correct sequence.",
      "Available cells: **RED, BLUE, YELLOW, GREEN**.",
      "",
      "Recovered rule fragments:",
      "• “Blue feeds on Red’s heat.”",
      "• “Yellow only shines after Blue.”",
      "• “Green follows sunlight but precedes night.”",
      "",
      "Type the colors in order (letters or names). Examples:",
      "  R B Y G   |   RED BLUE YELLOW GREEN   |   RED->BLUE->YELLOW->GREEN"
    ].join("\n"),
    answer: (txt) => {
      const seq = normalizeColorSequence(txt);
      return equalsSequence(seq, ["RED", "BLUE", "YELLOW", "GREEN"]);
    },
    // accepted variants (optional, your checker already handles most via normalize)
    accept: ["RBYG","RED BLUE YELLOW GREEN","RED->BLUE->YELLOW->GREEN","R B Y G","RED,BLUE,YELLOW,GREEN"],
    hints: [
      "Blue needs Red first — Blue cannot start.",
      "Yellow comes only after Blue.",
      "If sunlight is Yellow, who follows it?",
      "Order: **RED → BLUE → YELLOW → GREEN**."
    ],
  },

  // 3) HARD — Caesar-3 decryption (SECRET)
  {
    id: "comms-decrypt",
    title: "Comms Decryption",
    prompt: [
      "AI-Zeta: A damaged transmission loop is repeating a ciphered word.",
      "On a flickering monitor you read: **VHFUHW**",
      "",
      "Log note (pre-fall): “If the comms fail, roll the dial back three clicks.”",
      "Decode the message (Caesar shift **back** by 3) and enter the plain English word."
    ].join("\n"),
    answer: (txt) => txt.trim().toUpperCase() === "SECRET",
    hints: [
      "Shift each letter **back** three positions (V→S, H→E...).",
      "After shifting all letters, you get a common English word used for confidential info."
    ],
  },

  // 4) BOSS — logic elimination (who corrupted the core?)
  {
    id: "data-core-corruption",
    title: "Data Core Corruption",
    prompt: [
      "AI-Zeta: Five crew accessed the mainframe before the corruption:",
      "- Ishim (Navigator)",
      "- Kora (Chef)",
      "- Lin (Mechanic)",
      "- Silva (Security)",
      "- Noor (Technician)",
      "",
      "Clues:",
      "5) Noor was wearing sterile gloves in the lab.",
      "4) Silva was guarding the airlock all shift.",
      "3) Lin wears anti-static gloves when near electronics.",
      "2) Kora had just finished cooking a meal.",
      "1) The corrupted logs were typed with **greasy fingerprints**.",
      "",
      "Who corrupted the data core? Type the name.",
      "",
      "💡 Tip: If you're stuck, type “hint” to ask **AI-Zeta** for help."
    ].join("\n"),
    solution: "KORA",
    answer: (txt) => normName(txt) === "KORA",
    accept: ["KORA", "Kora", "Chef Kora", "Kora (Chef)"],
    hints: [
      "Sterile gloves leave no grease — eliminate that crew member.",
      "Who was guarding the airlock all shift? Cross them out.",
      "Anti-static gloves prevent direct fingerprints — remove that name.",
      "Who likely had greasy hands from cooking?",
      "Greasy fingerprints after cooking — the culprit is **Kora**."
    ],
  }
];
