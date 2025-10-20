import { useEffect, useMemo, useRef, useState } from "react";
import { joinRoom, makeId, randomColor } from "../services/realtime";

// Everyone joins the same room
const ROOM_ID = (import.meta.env.VITE_ROOM_ID || "MAIN").toUpperCase();
const MAX_PLAYERS = 12;

export default function LobbyScreen({ nickname, onReady }) {
  // ✅ Single shared room
  const [roomId] = useState(ROOM_ID);

  const chanRef = useRef(null);
  const [members, setMembers] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [log, setLog] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [isFull, setIsFull] = useState(false);

  const user = useMemo(
    () => ({
      id: crypto.randomUUID(),
      name: nickname || `player-${makeId(4)}`,
      color: randomColor(),
      ts: Date.now(),
    }),
    [nickname]
  );

  useEffect(() => {
    console.log("[Lobby] Using single shared room:", roomId);
    let mounted = true;

    (async () => {
      const ctx = await joinRoom(roomId, user);
      if (!mounted) return;
      chanRef.current = ctx;

      // Presence updates
      ctx.on("lobby", (list) => {
        console.log("[Lobby] Received presence update:", list);
        const sorted = [...list].sort((a, b) => a.ts - b.ts);
        setMembers(sorted.slice(0, MAX_PLAYERS));
        setIsHost(sorted[0]?.id === user.id);

        // Enforce player limit
        const myIndex = sorted.findIndex((m) => m.id === user.id);
        if (sorted.length > MAX_PLAYERS && myIndex >= MAX_PLAYERS) {
          setIsFull(true);
          try {
            ctx.channel.unsubscribe();
            console.log("[Lobby] Unsubscribed due to full room");
          } catch (err) {
            console.error("[Lobby] Unsubscribe error:", err);
          }
        }
      });

      // Lobby chat
      ctx.on("chat", (msg) => {
        console.log("[Lobby] Received chat:", msg);
        setLog((old) => [...old, msg]);
      });

      // Host starts the game
      ctx.on("start", (payload) => {
        console.log("[Lobby] Game start received:", payload);
        onReady({ roomId, ...payload, isHost });
      });
    })();

    return () => {
      mounted = false;
      if (chanRef.current) {
        chanRef.current.channel.unsubscribe();
        console.log("[Lobby] Cleanup: Unsubscribed from room:", roomId);
      }
    };
  }, [roomId, user, isHost, onReady]);

  // --- send chat ---
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
    console.log("[Lobby] Sent chat:", text);
  }

  // --- start game ---
  function startGame() {
    if (!isHost || !chanRef.current) return;
    if (members.length === 0 || members.length > MAX_PLAYERS) return;
    const startAt = Date.now() + 1500; // sync delay
    chanRef.current.send("start", { startAt, players: members });
    onReady({ roomId, startAt, players: members, isHost: true });
    console.log("[Lobby] Game started by host, players:", members.length);
  }

  // --- UI rendering ---
  if (isFull) {
    return (
      <main className="hero">
        <section className="glass" style={{ maxWidth: 720 }}>
          <h1 className="hero-title">Room is full</h1>
          <p className="hero-sub">
            The global room <code>{roomId}</code> has reached {MAX_PLAYERS} players.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="hero">
      <section className="glass" style={{ maxWidth: 900 }}>
        <h1 className="hero-title">Aether Station — Lobby</h1>
        <p className="hero-sub">
          Everyone joins a single shared room: <code>{roomId}</code> (max {MAX_PLAYERS} players)
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginTop: 14,
          }}
        >
          {/* Players */}
          <div>
            <h3 style={{ margin: "6px 0" }}>
              Players ({members.length}/{MAX_PLAYERS})
            </h3>
            <div
              style={{
                padding: 10,
                border: "1px solid #234",
                borderRadius: 10,
                minHeight: 140,
                background: "#001316",
              }}
            >
              {members.length === 0 && (
                <div style={{ opacity: 0.7 }}>Waiting for players…</div>
              )}
              {members.map((m, i) => (
                <div key={m.id} style={{ color: m.color, margin: "4px 0" }}>
                  {i + 1}. {m.name}
                  {i === 0 ? " • host" : ""}
                </div>
              ))}
            </div>
          </div>

          {/* Lobby chat */}
          <div>
            <h3 style={{ margin: "6px 0" }}>Lobby chat</h3>
            <div
              style={{
                padding: 10,
                border: "1px solid #234",
                borderRadius: 10,
                minHeight: 140,
                maxHeight: 200,
                overflowY: "auto",
                background: "#001316",
              }}
            >
              {log.map((m, i) => (
                <div key={i}>
                  <strong style={{ color: m.color }}>{m.from}:</strong>{" "}
                  <span style={{ whiteSpace: "pre-wrap" }}>{m.text}</span>
                </div>
              ))}
            </div>

            <form
              className="form-row"
              style={{ marginTop: 8 }}
              onSubmit={(e) => {
                e.preventDefault();
                sendLobbyChat();
              }}
            >
              <input
                className="input"
                placeholder="Say hi to your crew…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button className="btn" type="submit">
                Send
              </button>
            </form>

            <p style={{ marginTop: 8, opacity: 0.8 }}>
              Tip: anyone can talk to <strong>AI-Zeta</strong> during the mission.
              Start your message with <code>/z</code>, <code>@zeta</code> or{" "}
              <code>zeta:</code>.
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