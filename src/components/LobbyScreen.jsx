// src/components/LobbyScreen.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { joinRoom, makeId, randomColor } from "../services/realtime";

const ROOM_ID    = (import.meta.env.VITE_ROOM_ID || "MAIN").toUpperCase();
const MAX_PLAYERS = 12;

export default function LobbyScreen({ nickname, onReady }) {
  const chanRef    = useRef(null);
  const [members, setMembers]   = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [log, setLog]           = useState([]);
  const [isHost, setIsHost]     = useState(false);
  const [isFull, setIsFull]     = useState(false);

  const user = useMemo(() => ({
    id: crypto.randomUUID(),
    name: nickname || `player-${makeId(4)}`,
    color: randomColor(),
    ts: Date.now(),
  }), [nickname]);

  // 🔒 Never read/write location.hash; always join global room once
  useEffect(() => {
    let mounted = true;
    let ctx;

    (async () => {
      ctx = await joinRoom(ROOM_ID, user);
      if (!mounted) {
        try { await ctx?.channel?.unsubscribe(); } catch {}
        return;
      }
      chanRef.current = ctx;

      // Presence → UI
      ctx.on("lobby", (list) => {
        // oldest joined is host; enforce cap
        const sorted = [...list].sort((a, b) => a.ts - b.ts);
        setMembers(sorted.slice(0, MAX_PLAYERS));
        setIsHost(sorted[0]?.id === user.id);

        const meIdx = sorted.findIndex(m => m.id === user.id);
        if (sorted.length > MAX_PLAYERS && meIdx >= MAX_PLAYERS) {
          setIsFull(true);
          try { ctx.channel.unsubscribe(); } catch {}
        }
      });

      // Lobby chat
      ctx.on("chat", (msg) => setLog((old) => [...old, msg]));

      // Host starts the game
      ctx.on("start", (payload) => onReady({ roomId: ROOM_ID, ...payload, isHost }));
    })();

    return () => {
      mounted = false;
      try { ctx?.channel?.unsubscribe(); } catch {}
    };
    // ❗ Empty deps — ensures a single subscription (prevents join/leave loop)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function sendLobbyChat() {
    const text = chatInput.trim();
    if (!text || !chanRef.current) return;
    chanRef.current.send("chat", {
      from: user.name,
      color: user.color,
      text,
      at: Date.now(),
      scope: "lobby",
    });
    setChatInput("");
  }

  function startGame() {
    if (!isHost || !chanRef.current) return;
    if (members.length === 0 || members.length > MAX_PLAYERS) return;
    const startAt = Date.now() + 1500; // small sync buffer
    chanRef.current.send("start", { startAt, players: members });
    onReady({ roomId: ROOM_ID, startAt, players: members, isHost: true });
  }

  if (isFull) {
    return (
      <main className="hero">
        <section className="glass" style={{ maxWidth: 720 }}>
          <h1 className="hero-title">Room is full</h1>
          <p className="hero-sub">The global room <code>{ROOM_ID}</code> has reached {MAX_PLAYERS} players.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="hero">
      <section className="glass" style={{ maxWidth: 900 }}>
        <h1 className="hero-title">Aether Station — Lobby</h1>
        <p className="hero-sub">
          Everyone joins a single shared room: <code>{ROOM_ID}</code> (max {MAX_PLAYERS} players)
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
          {/* Players */}
          <div>
            <h3 style={{ margin: "6px 0" }}>Players ({members.length}/{MAX_PLAYERS})</h3>
            <div style={{ padding: 10, border: "1px solid #234", borderRadius: 10, minHeight: 140, background: "#001316" }}>
              {members.length === 0 && <div style={{ opacity: 0.7 }}>Waiting for players…</div>}
              {members.map((m, i) => (
                <div key={m.id} style={{ color: m.color, margin: "4px 0" }}>
                  {i + 1}. {m.name}{i === 0 ? " • host" : ""}
                </div>
              ))}
            </div>
          </div>

          {/* Lobby chat */}
          <div>
            <h3 style={{ margin: "6px 0" }}>Lobby chat</h3>
            <div style={{ padding: 10, border: "1px solid #234", borderRadius: 10, minHeight: 140, maxHeight: 200, overflowY: "auto", background: "#001316" }}>
              {log.map((m, i) => (
                <div key={i}>
                  <strong style={{ color: m.color }}>{m.from}:</strong>{" "}
                  <span style={{ whiteSpace: "pre-wrap" }}>{m.text}</span>
                </div>
              ))}
            </div>

            <form className="form-row" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); sendLobbyChat(); }}>
              <input className="input" placeholder="Say hi to your crew…" value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
              <button className="btn" type="submit">Send</button>
            </form>

            <p style={{ marginTop: 8, opacity: 0.8 }}>
              Tip: anyone can talk to <strong>AI-Zeta</strong> during the mission. Start your message with <code>/z</code>, <code>@zeta</code> or <code>zeta:</code>.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="btn" onClick={startGame} disabled={!isHost}>
            {isHost ? "Start game (10:00)" : "Waiting for host…"}
          </button>
        </div>
      </section>
    </main>
  );
}
