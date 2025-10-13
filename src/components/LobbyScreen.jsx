import { useEffect, useMemo, useRef, useState } from "react";
import { joinRoom, makeId, randomColor } from "../services/realtime";

const MAX_PLAYERS = 12;

export default function LobbyScreen({ nickname, onReady }) {
  // keep using the hash as the room id; if none, make one (but we don't display it)
  const [roomId] = useState(() => (location.hash?.slice(1) || makeId(5)).toUpperCase());
  useEffect(() => { if (!location.hash) location.hash = "#" + roomId; }, [roomId]);

  const chanRef = useRef(null);

  const [members, setMembers] = useState([]);
  const [log, setLog] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [isFull, setIsFull] = useState(false);

  const user = useMemo(() => ({
    id: crypto.randomUUID(),
    name: nickname,
    color: randomColor(),
    ts: Date.now(), // used to determine host (first joiner)
  }), [nickname]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ctx = await joinRoom(roomId, user);
      if (!mounted) return;
      chanRef.current = ctx;

      // presence list
      ctx.on("lobby", (list) => {
        const sorted = [...list].sort((a, b) => a.ts - b.ts);
        setMembers(sorted);

        // enforce capacity: if I'm beyond the first 12, leave and show "full"
        const myIndex = sorted.findIndex((m) => m.id === user.id);
        if (sorted.length > MAX_PLAYERS && myIndex >= MAX_PLAYERS) {
          setIsFull(true);
          try { ctx.channel.unsubscribe(); } catch {}
          return;
        }
        setIsHost(sorted[0]?.id === user.id);
      });

      // lobby chat
      ctx.on("chat", (msg) => setLog((l) => [...l, msg]));

      // start from host
      ctx.on("start", (payload) => onReady({ roomId, ...payload, isHost }));

    })();
    return () => { mounted = false; };
  }, [roomId, user, isHost, onReady]);

  function sendLobbyChat() {
    const text = chatInput.trim();
    if (!text || !chanRef.current) return;
    chanRef.current.send("chat", { from: user.name, color: user.color, text, at: Date.now(), scope: "lobby" });
    setChatInput("");
  }

  function startGame() {
    if (!isHost || !chanRef.current) return;
    if (members.length === 0) return;
    if (members.length > MAX_PLAYERS) return;

    // small sync buffer so all clients align
    const startAt = Date.now() + 1500;
    chanRef.current.send("start", { startAt, players: members });
    onReady({ roomId, startAt, players: members, isHost: true });
  }

  if (isFull) {
    return (
      <main className="hero">
        <section className="glass" style={{ maxWidth: 720 }}>
          <h1 className="hero-title">Room is full</h1>
          <p className="hero-sub">This lobby already has {MAX_PLAYERS} players.</p>
          <div className="form-row" style={{ marginTop: 10 }}>
            <button
              className="btn"
              onClick={() => { location.hash = "#" + makeId(5); location.reload(); }}
            >
              Create a new lobby
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="hero">
      <section className="glass" style={{ maxWidth: 900 }}>
        <h1 className="hero-title">Aether Station — Lobby</h1>
        <p className="hero-sub">Gather your crew. The host can start the mission.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
          {/* Players box */}
          <div>
            <h3 style={{ margin: "6px 0" }}>Players ({Math.min(members.length, MAX_PLAYERS)}/{MAX_PLAYERS})</h3>
            <div style={{ padding: 10, border: "1px solid #234", borderRadius: 10, minHeight: 140, background: "#001316" }}>
              {members.length === 0 && <div style={{ opacity: 0.7 }}>Waiting for players…</div>}
              {members.slice(0, MAX_PLAYERS).map((m, i) => (
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

            {/* In the lobby, everyone can chat */}
            <form
              className="form-row"
              style={{ marginTop: 8 }}
              onSubmit={(e) => { e.preventDefault(); sendLobbyChat(); }}
            >
              <input
                className="input"
                placeholder="Say hi to your crew…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button className="btn" type="submit">Send</button>
            </form>

            {/* Host label */}
            <p style={{ marginTop: 8, opacity: 0.8 }}>
              Host: <strong>{members[0]?.name || "—"}</strong> (only the host will be able to talk to AI-Zeta during the mission)
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
