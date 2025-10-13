import { useEffect, useMemo, useRef, useState } from "react";
import { joinRoom, makeId, randomColor } from "../services/realtime";

const MAX_PLAYERS = 12;

export default function LobbyScreen({ nickname, onReady }) {
  // re-use the current link (URL hash) as room id; generate one if missing
  const [roomId] = useState(() => (location.hash?.slice(1) || makeId(5)).toUpperCase());
  useEffect(() => { if (!location.hash) location.hash = "#" + roomId; }, [roomId]);

  const [log, setLog] = useState([]);
  const [members, setMembers] = useState([]);
  const [ready, setReady] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [chatInput, setChatInput] = useState("");

  // new: room-full guard
  const [isFull, setIsFull] = useState(false);

  const chanRef = useRef(null);

  const user = useMemo(() => ({
    id: crypto.randomUUID(),
    name: nickname,
    color: randomColor(),
    ts: Date.now(), // used to compute host (first joiner)
  }), [nickname]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ctx = await joinRoom(roomId, user);
      if (!mounted) return;
      chanRef.current = ctx;

      // presence updates
      ctx.on("lobby", (list) => {
        // sort by join time (first joiner = host)
        const sorted = [...list].sort((a, b) => a.ts - b.ts);
        setMembers(sorted);

        // capacity check: if I am beyond the 12th slot, leave the channel and show "room full"
        const myIndex = sorted.findIndex((m) => m.id === user.id);
        if (sorted.length > MAX_PLAYERS && myIndex >= MAX_PLAYERS) {
          setIsFull(true);
          // immediately leave lobby; no further events
          try { ctx.channel.unsubscribe(); } catch {}
          return;
        }

        setIsHost(sorted[0]?.id === user.id);
      });

      // broadcast listeners
      ctx.on("chat", (msg) => setLog((l) => [...l, msg]));
      ctx.on("start", (payload) => {
        setReady(true);
        onReady({ roomId, ...payload, isHost });
      });
    })();

    return () => { mounted = false; };
  }, [roomId, user, onReady, isHost]);

  function sendLobbyChat() {
    const text = chatInput.trim();
    if (!text || !chanRef.current) return;
    chanRef.current.send("chat", { from: user.name, color: user.color, text, at: Date.now(), scope: "lobby" });
    setChatInput("");
  }

  function startGame() {
    if (!chanRef.current || members.length === 0) return;
    if (!isHost) return;

    // extra safety: don’t start above capacity
    if (members.length > MAX_PLAYERS) {
      alert(`Room is above capacity (${members.length}/${MAX_PLAYERS}). Ask late joiners to create a new room.`);
      return;
    }

    const startAt = Date.now() + 1500; // small sync buffer
    chanRef.current.send("start", { startAt, players: members });
    setReady(true);
    onReady({ roomId, startAt, players: members, isHost: true });
  }

  // simple “Room full” screen for late joiners
  if (isFull) {
    return (
      <main className="hero">
        <section className="glass" style={{ maxWidth: 720 }}>
          <h1 className="hero-title">Room is full</h1>
          <p className="hero-sub">
            This lobby already has {MAX_PLAYERS} players. You can create a new room and invite your crew.
          </p>
          <div className="form-row" style={{ marginTop: 12 }}>
            <button
              className="btn"
              onClick={() => {
                const newId = makeId(5);
                location.hash = "#" + newId;
                location.reload(); // reload to join the new room
              }}
            >
              Create new room
            </button>
            <button
              className="btn"
              onClick={() => navigator.clipboard.writeText(location.href)}
            >
              Copy this link
            </button>
          </div>
          <p style={{ marginTop: 10, opacity: 0.85 }}>
            Current room: <strong>{roomId}</strong>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="hero">
      <section className="glass" style={{ maxWidth: 900 }}>
        <h1 className="hero-title">Aether Station — Lobby</h1>
        <p className="hero-sub">Share this room code so others can join:</p>
        <p style={{ fontFamily: "monospace", fontSize: 20, marginTop: -8 }}>
          Room: <strong>{roomId}</strong>
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <div>
            <h3 style={{ margin: "6px 0" }}>Players ({members.length}/{MAX_PLAYERS})</h3>
            <div style={{ padding: 10, border: "1px solid #234", borderRadius: 10, minHeight: 120, background: "#001316" }}>
              {members.map((m, i) => (
                <div key={m.id} style={{ color: m.color, margin: "4px 0" }}>
                  {i + 1}. {m.name} {members[0]?.id === m.id ? " • host" : ""}
                </div>
              ))}
              {!members.length && <div style={{ opacity: 0.7 }}>Waiting for players…</div>}
            </div>
          </div>

          <div>
            <h3 style={{ margin: "6px 0" }}>Lobby chat</h3>
            <div style={{ padding: 10, border: "1px solid #234", borderRadius: 10, minHeight: 120, maxHeight: 180, overflowY: "auto", background: "#001316" }}>
              {log.map((m, i) => (
                <div key={i}>
                  <strong style={{ color: m.color }}>{m.from}:</strong>{" "}
                  <span style={{ whiteSpace: "pre-wrap" }}>{m.text}</span>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); sendLobbyChat(); }}
              className="form-row"
              style={{ marginTop: 8 }}
            >
              <input
                className="input"
                placeholder="Say hi to your crew…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button className="btn" type="submit">Send</button>
            </form>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="btn" onClick={() => navigator.clipboard.writeText(location.href)}>Copy room link</button>
          <button className="btn" onClick={startGame} disabled={!isHost || ready}>
            {isHost ? "Start game for everyone" : "Waiting for host…"}
          </button>
        </div>
      </section>
    </main>
  );
}
