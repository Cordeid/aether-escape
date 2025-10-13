import React from "react";

function mmss(totalSec) {
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function VictoryScreen({ nickname, secondsLeft, onRestart }) {
  const timeUsed = 600 - secondsLeft; // TOTAL_SECONDS is 600 in your engine
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background:
          `radial-gradient(1400px 800px at 50% 30%, rgba(0,10,20,0.20), rgba(0,0,0,0.60)),` +
          `linear-gradient(180deg, rgba(0,0,0,0.20), rgba(0,0,0,0.55)),` +
          `url("/victory-bg.jpg") center/cover fixed no-repeat`,
        color: "#eaffff",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 860,
          padding: 28,
          borderRadius: 16,
          background: "rgba(1, 20, 22, 0.62)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          backdropFilter: "blur(6px)",
        }}
        role="region"
        aria-label="Escape complete"
      >
        <h1 style={{margin: "0 0 8px", fontSize: "clamp(28px, 4.6vw, 44px)", color:"#b2ffe8"}}>
          🎉 Congratulations, {nickname}! You escaped the Aether Station.
        </h1>

        <p style={{margin: "0 0 14px", color:"#cfe"}}>
          <strong>Time used:</strong> {mmss(timeUsed)} &nbsp;|&nbsp; 
          <strong>Time remaining:</strong> {mmss(secondsLeft)}
        </p>

        <p style={{lineHeight: 1.6, marginBottom: 12}}>
          The escape pod thrums awake and tears free of the docking clamps. Through the viewport,
          the <em>Aether Station</em> limps and twists, its hull shedding sparks like a meteor
          storm as the black hole’s gravity drags it toward the abyss. Your final commands cascade
          through the consoles—locks released, trajectory plotted, thrust aligned. The pod punches
          hard, engines screaming, carving a bright arc away from the event horizon’s hungry ring.
        </p>

        <p style={{lineHeight: 1.6, marginBottom: 12}}>
          Behind you, AI-Zeta’s voice stabilizes for a moment—no static, only warmth. 
          <em>“Crewmember {nickname}, escape vector confirmed. Thank you for keeping them safe.”</em>
          The channel crackles and fades. Stars bloom ahead. The pod coasts into quiet, and for the
          first time since the alarms began, you breathe.
        </p>

        <p style={{lineHeight: 1.6, marginBottom: 18}}>
          The station vanishes in a final ripple of light. You survived the fall—and the story of
          Aether Station survives with you.
        </p>

        <div style={{display:"flex", gap:12, flexWrap:"wrap"}}>
          <button
            onClick={onRestart}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #2e6a5c",
              background: "#0a2c27",
              color: "#bafee6",
              cursor: "pointer",
            }}
          >
            Play again
          </button>
        </div>
      </section>
    </main>
  );
}
