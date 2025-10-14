import React, { useEffect, useRef, useState } from "react";

// ✅ Global styles (loads the background image + base layout)
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
import { isTimeUp, TOTAL_SECONDS, advance } from "./lib/engine";

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

  // Realtime channel for the GAME (separate from lobby channel)
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
      // join game channel
      chanRef.current = await joinRoom(roomId, { id: crypto.randomUUID(), name: nickname });
      console.log("Channel initialized:", !!chanRef.current);

      // --- NEW: subscribe to game-phase events ---
      chanRef.current.on("ai", ({ text }) => {
        setChat((c) => [...c, { role: "assistant", content: text }]);
      });
      chanRef.current.on("chat", ({ from, text }) => {
        // Render as a user message; you could tag with from if you prefer
        setChat((c) => [...c, { role: "user", content: `${from}: ${text}` }]);
      });
      chanRef.current.on("try", ({ nick, answer }) => {
        // Optional feed of attempts
        setChat((c) => [...c, { role: "user", content: `${nick} tried: ${answer}` }]);
      });

      // Initial AI welcome
      const welcome = await zetaSpeak([{ role: "user", content: "Introduce the game as AI-Zeta." }]);
      setChat((c) => [...c, { role: "assistant", content: welcome }]); // functional update (prevents stale state)
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
        if (chanRef.current) chanRef.current.send("state", { lose: true });
      }
    }, 1000);
  }

  function stopTicker() {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
  }

  async function handleSubmit(answer) {
    console.log("Handling submit with answer:", answer, "current:", current?.id);
    if (!answer.trim()) return;

    try {
      if (!current?.answer) throw new Error("Puzzle answer function missing");
      const correct = current.answer(answer);
      console.log("Answer correct:", correct);
      if (chanRef.current) chanRef.current.send("try", { answer, nick: nickname });

      if (correct) {
        console.log("Advancing from idx:", idx, "to", idx + 1, "PUZZLES.length:", PUZZLES.length);
        advance(chanRef.current, setIdx, idx, setPhase, stopTicker, setChat);
        // Force re-render check
        console.log("After advance, idx should be:", idx + 1);
      } else {
        // Ask AI-Zeta for a subtle nudge; append locally AND broadcast
        const nudge = await zetaSpeak([
          {
            role: "user",
            content: `Wrong attempt for puzzle "${current.id}": "${answer}". Provide a subtle nudge (no spoilers) in one short line, in character.`,
          },
        ]);
        setChat((c) => [...c, { role: "assistant", content: nudge }]);
        if (chanRef.current) chanRef.current.send("ai", { text: nudge });
      }
    } catch (err) {
      console.error("Submit failed:", err.message, err.stack);
      setChat((c) => [...c, { role: "assistant", content: `AI-Zeta: [static] Internal fault: ${err.message || "Unknown"}` }]);
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
    console.log('Current puzzle:', current, 'idx:', idx);
  }, [idx, phase]);

  useEffect(() => {
    console.log('Idx updated to:', idx);
  }, [idx]);

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 12 }}>
      {phase === "start" && <StartScreen onStart={begin} />}
      {phase === "lobby" && <LobbyScreen nickname={nickname} onReady={onLobbyReady} />}
      {phase === "game" && (
        <>
          <HUDTimer secondsLeft={secondsLeft} />
          <Chat
            messages={chat}
            onSend={(text) => {
              // local echo + broadcast to crew
              setChat((c) => [...c, { role: "user", content: text }]);
              chanRef.current?.send("chat", {
                from: nickname,
                text,
                at: Date.now(),
                scope: "game",
              });
            }}
          />
          {current && <PuzzleCard key={current.id} puzzle={current} onSolve={handleSubmit} />}
        </>
      )}
      {phase === "win" && <VictoryScreen nickname={nickname} secondsLeft={secondsLeft} onRestart={restart} />}
      {phase === "lose" && <GameOverScreen onRestart={restart} />}
    </div>
  );
}
