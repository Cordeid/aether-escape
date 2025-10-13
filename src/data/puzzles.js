export const PUZZLES = [
  // 1) EASY — Reactor keypad (confidence builder)
  {
    id: "reactor-calibration",
    title: "Reactor Calibration",
    prompt:
      "AI-Zeta: Primary reactor cold-boot. Enter checksum: sum of [7, 5, 6, 4] (digits only).",
    answer: (txt) => txt.replace(/\D/g,"") === "22",
    hints: [
      "Add the numbers, no units.",
      "7+5+6+4 = ? Digits only.",
    ],
  },

  // 2) MEDIUM — Power routing (sequence)
  {
    id: "power-routing",
    title: "Power Routing",
    prompt:
      "AI-Zeta: Route power from BUS-A to LIFE-SUPPORT.\nRules: A→B, B→C, C→LS. Which sequence (letters only) restores power?",
    answer: (txt) => txt.trim().toUpperCase().replace(/[^A-Z]/g,"") === "ABCLS",
    accept: ["A B C LS","A->B->C->LS","A B C L S"],
    hints: [
      "Follow the chain: A to B, then B to C, then C to Life Support.",
      "Type the nodes in order with no arrows: ABCLS.",
    ],
  },

  // 3) HARD — Caesar-3
  {
    id: "comms-decrypt",
    title: "Comms Decryption",
    prompt:
      "AI-Zeta: Saboteur left a Caesar-3 shift on 'VHFUHW'. Decode to a plain English word.",
    answer: (txt) => txt.trim().toUpperCase() === "SECRET",
    hints: [
      "Shift letters **back** by 3.",
      "'V'→'S', 'H'→'E'… result is a common English word.",
    ],
  },

  // 4) BOSS — Logic exclusion
  {
    id: "who-sabotaged",
    title: "Identify the Saboteur",
    prompt:
`AI-Zeta: Three crew were near the reactor:
- Rae (Engineer), Marlow (Medic), Ishim (Navigator)
Clues:
1) The saboteur wore insulated gloves.
2) The Medic has a latex allergy and never wears gloves.
3) Rae was fixing a hangar breach (no time to change gear).
Who sabotaged? Type the name.`,
    answer: (txt) => txt.trim().toUpperCase() === "ISHIM",
    hints: [
      "Allergic medic didn't wear gloves → not Marlow.",
      "Rae had no time to change gear → not Rae. So…",
    ],
  }
];
