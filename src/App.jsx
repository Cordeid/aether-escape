import React, { useEffect, useRef, useState } from "react";

// ✅ Global styles
import "./styles/global.css";

// Screens / UI
import StartScreen from "./components/StartScreen";
import LobbyScreen from "./components/LobbyScreen";
import Chat from "./components/Chat";
import PuzzleCard from "./components/PuzzleCard";
import HUDTimer from "./components/HUDTimer";
import VictoryScreen from "./components/VictoryScreen";
import GameOverScreen from "./components/GameOverScreen";

// Game data / logic
import { PUZZLES } from "./data/puzzles";
import { TOTAL_SECONDS } from "./lib/engine"; // we won't rely on advance() anymore

// AI (AI-Zeta)
import { zetaSpeak } from "./services/aiClient";

// Realtime (Supabase)
import { joinRoom } from "./services/realtime";

export default function App() {
  const [phase, setPhase] = useState("start");
  const [nickname, setNickname] = useState("");

  // Lobby/game context
  const [lobby, setLobby] = useState(null); // { roomId, startAt, players, isHost }
  const [idx, setIdx] = useState(0);        // current puzzle index
  const current = PUZZLES[idx];

  // Chat + timer
  const [chat, setChat] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);

  // Realtime channel for the GAME
  const chanRef = useRef(null);

  // Shared start anchor: Date.now() when host pressed Start (broadcast)
  const startAtRef = useRef(null);
  const tickerRef = useRef(null);

  async function begin(name) {
    setNickname(name);
    setPhase("lobby");
  }

  async function onLobbyReady({ roomId, startAt, players, isHost }) {
    setLobby({ roomId, startAt, players, isHost });
    setPhase("game");
    startAtRef.current = startAt;
    startTicker();

    try {
      // Join the game channel for everyone
      chanRef.current = await joinRoom(roomId, { id: crypto.randomUUID(), name: nickname });
      console.log("Channel initialized:", !!chanRef.current);

      // --- GAME-PHASE LISTENERS (everyone receives updates) ---
      chanRef.current.on("ai", ({ text }) => {
        setChat((c) => [...c, { role: "assistant", content: text }]);
      });

      chanRef.current.on("chat", ({ from, text }) => {
        setChat((c) => [...c, { role: "user", content: `${from}: ${text}` }]);
      });

      chanRef.current.on("try", ({ nick, answer }) => {
        setChat((c) => [...c, { role: "user", content: `${nick} tried: ${answer}` }]);
      });

      chanRef.current.on("state", (payload) => {
        // Optional: keep idx/phase in sync if another client drives it
        if (typeof payload?.nextIdx === "number") setIdx(payload.nextIdx);
        if (payload?.win) {
          stopTicker();
          setPhase("win");
        }
        if (payload?.lose) {
          stopTicker();
          setPhase("lose");
        }
      });

      // Initial AI welcome for all
      const welcome = await zetaSpeak([{ role: "user", content: "Introduce the game as AI-Zeta." }]);
      setChat((c) => [...c, { role: "assistant", content: welcome }]);
      chanRef.current.send("ai", { text: welcome });
    } catch (err) {
      console.error("Lobby ready failed:", err.message, err.stack);
      setChat((c) => [...c, { role: "assistant", content: "AI-Zeta: [static] Link degraded… (try again)" }]);
    }
  }

  function startTicker() {
    tickerRef.current = setInterval(() => {
      const secs = Math.max(0, TOTAL_SECONDS - Math.floor((Date.now() - startAtRef.current) / 1000));
      setSecondsLeft(secs);
      if (secs <= 0) {
        stopTicker();
        setPhase("lose");
        chanRef.current?.send("state", { lose: true });
      }
    }, 1000);
  }

  function stopTicker() {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
  }

  // Everyone can submit answers; correct ⇒ next puzzle; after last ⇒ win
  async function handleSubmit(answer) {
    console.log("Handling submit with answer:", answer, "current:", current?.id);
    if (!answer.trim()) return;

    try {
      if (!current?.answer) throw new Error("Puzzle answer function missing");
      const correct = current.answer(answer);
      console.log("Answer correct:", correct);

      chanRef.current?.send("try", { answer, nick: nickname });

      if (correct) {
        const next = idx + 1;
        // Broadcast state so all clients advance in lockstep
        chanRef.current?.send("state", { solved: current.id, nextIdx: next });

        if (next < PUZZLES.length) {
          setIdx(next);
          setChat((c) => [
            ...c,
            { role: "assistant", content: "AI-Zeta: [static] …Seal released. Next protocol loaded." },
          ]);
        } else {
          // All puzzles solved → Victory
          stopTicker();
          setPhase("win");
          chanRef.current?.send("state", { win: true });
        }
      } else {
        // Subtle nudge for anyone's wrong attempt (local + broadcast)
        const nudge = await zetaSpeak([
          {
            role: "user",
            content: `Wrong attempt for puzzle "${current.id}": "${answer}". Provide a subtle nudge (no spoilers) in one short line, in character.`,
          },
        ]);
        setChat((c) => [...c, { role: "assistant", content: nudge }]);
        chanRef.current?.send("ai", { text: nudge });
      }
    } catch (err) {
      console.error("Submit failed:", err.message, err.stack);
      setChat((c) => [...c, { role: "assistant", content: `AI-Zeta: [static] Internal fault: ${err.message || "Unknown"}` }]);
    }
  }

  // Everyone can talk to AI-Zeta via chat:
  // Prefix triggers: `/z ...`, `@zeta ...`, or `zeta: ...`
  async function handleChatSend(text) {
    const raw = text.trim();

    // Broadcast the user's message first (local echo too)
    setChat((c) => [...c, { role: "user", content: raw }]);
    chanRef.current?.send("chat", { from: nickname, text: raw, at: Date.now(), scope: "game" });

    // Check if it's addressed to Zeta
    const toZeta = [/^\/z\s+/i, /^@zeta\s+/i, /^zeta[:\s]/i].some((re) => re.test(raw));
    if (!toZeta) return;

    // Extract user question (strip the prefix)
    const question = raw.replace(/^\/z\s+|^@zeta\s+|^zeta[:\s]*/i, "").trim() || raw;

    // Ask Zeta with lightweight context (puzzle id)
    try {
      const prompt = current
        ? `We are playing a puzzle game aboard Aether Station. Current puzzle id: "${current.id}". Respond in-character as AI-Zeta. User said: ${question}`
        : `Respond in-character as AI-Zeta. User said: ${question}`;

      const reply = await zetaSpeak([{ role: "user", content: prompt }]);
      setChat((c) => [...c, { role: "assistant", content: reply }]);
      chanRef.current?.send("ai", { text: reply });
    } catch (err) {
      const fail = "AI-Zeta: [static] …Interface degraded. Retry.";
      setChat((c) => [...c, { role: "assistant", content: fail }]);
      chanRef.current?.send("ai", { text: fail });
    }
  }

  function restart() {
    stopTicker();
    setPhase("start");
    setNickname("");
    setLobby(null);
    setIdx(0);
    setChat([]);
    setSecondsLeft(TOTAL_SECONDS);
    startAtRef.current = null;
    try {
      chanRef.current?.channel?.unsubscribe?.();
    } catch {}
    chanRef.current = null;
  }

  useEffect(() => {
    console.log("Current puzzle:", current, "idx:", idx);
  }, [idx, phase]);

  useEffect(() => {
    console.log("Idx updated to:", idx);
  }, [idx]);

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 12 }}>
      {phase === "start" && <StartScreen onStart={begin} />}
      {phase === "lobby" && <LobbyScreen nickname={nickname} onReady={onLobbyReady} />}
      {phase === "game" && (
        <>
          <HUDTimer secondsLeft={secondsLeft} />
          <Chat messages={chat} onSend={handleChatSend} />
          {current && <PuzzleCard key={current.id} puzzle={current} onSolve={handleSubmit} />}
        </>
      )}
      {phase === "win" && <VictoryScreen nickname={nickname} secondsLeft={secondsLeft} onRestart={restart} />}
      {phase === "lose" && <GameOverScreen onRestart={restart} />}
    </div>
  );
}
