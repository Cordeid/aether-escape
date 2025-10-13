import React from "react";

export default function GameOverScreen({ onRestart }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background:
          // You can swap the gradients for an image later, e.g. url("/gameover-bg.jpg")
          `radial-gradient(1400px 800px at 50% 30%, rgba(10,0,0,0.25), rgba(0,0,0,0.7)),` +
          `linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.7))`,
        color: "#ffefef",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 860,
          padding: 28,
          borderRadius: 16,
          background: "rgba(20, 0, 0, 0.55)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.65)",
          backdropFilter: "blur(6px)",
          textAlign: "center",
        }}
        role="region"
        aria-label="Game over"
      >
        <h1 style={{ margin: 0, fontSize: "clamp(40px, 8vw, 72px)", letterSpacing: 1 }}>
          Game Over
        </h1>

        <p style={{ margin: "14px 0 10px", opacity: 0.9 }}>
          The pod shudders and the hull sings—metal groans to a single note as the
          <em> Aether Station</em> tumbles beyond the last safe orbit. The black hole’s
          horizon swallows the stars, stretching light into a red, silent scream.
          Consoles flicker, alarms flatten to static, and AI-Zeta’s voice dissolves
          into a final burst of snow.
        </p>

        <p style={{ margin: "0 0 22px", opacity: 0.9 }}>
          For a heartbeat, time smears. Then: nothing. The station is gone—only the
          echo of what could have been… and another chance to try.
        </p>

        <button
          onClick={onRestart}
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            border: "1px solid #5a2e2e",
            background: "#2b0d0d",
            color: "#ffd8d8",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </section>
    </main>
  );
}
