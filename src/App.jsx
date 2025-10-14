// src/App.jsx
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

/**
 * Phases:
 *  - "start" : nickname entry (StartScreen)
 *  - "lobby" : players gather & chat, host starts the run (LobbyScreen)
 *  - "game"  : shared chat + puzzles + synced 10:00 timer
 *  - "win"   : victory screen
 *  - "lose"  : game over (timer reached zero)
 */
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

  // ─────────────────────────────────────────────────────────────
  // Start → Lobby
  // ─────────────────────────────────────────────────────────────
  async function begin(name) {
    setNickname(name);
    setPhase("lobby");
  }

  // Called by LobbyScreen when the host starts (or when "start" broadcast received)
  async function onLobbyReady({ roomId, startAt, players, isHost }) {
    setLobby({ roomId, startAt, players, isHost });
    setPhase("game");
    startAtRef.current = startAt;
    startTicker();
    chanRef.current = await joinRoom(roomId, { id: crypto.randomUUID(), name: nickname }); // Example, adjust based on full code
    // Initial AI welcome
    const welcome = await zetaSpeak([{ role: "user", content: "Introduce the game as AI-Zeta." }]);
    setChat([...chat, { role: "assistant", content: welcome }]);
    chanRef.current.send("ai", { text: welcome });
  }

  // Timer logic
  function startTicker() {
    tickerRef.current = setInterval(() => {
      const secs = Math.max(0, TOTAL_SECONDS - Math.floor((Date.now() - startAtRef.current) / 1000));
      setSecondsLeft(secs);
      if (secs <= 0) {
        stopTicker();
        setPhase("lose");
        chanRef.current.send("state", { lose: true });
      }
    }, 1000);
  }

  function stopTicker() {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
  }

  // ─────────────────────────────────────────────────────────────
  // Puzzle submit (from PuzzleCard)
  // ─────────────────────────────────────────────────────────────
  async function handleSubmit(answer) {
    if (!answer.trim()) return;

    const correct = current.answer(answer);
    chanRef.current.send("try", { answer, nick: nickname });

    if (correct) {
      advance(chanRef.current, setIdx, idx, setPhase, stopTicker, setChat);
    } else {
      const nudge = await zetaSpeak([
        {
          role: "user",
          content: `Wrong attempt for puzzle "${current.id}": "${answer}". Provide a subtle nudge (no spoilers) in one short line, in character.`,
        },
      ]);
      chanRef.current.send("ai", { text: nudge });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Restart (back to start screen)
  // ─────────────────────────────────────────────────────────────
  function restart() {
    stopTicker();
    setPhase("start");
    setNickname("");
    setLobby(null);
    setIdx(0);
    setChat([]);
    setSecondsLeft(TOTAL_SECONDS);
    startAtRef.current = null;
  }

  // Debug logging (remove in production)
  useEffect(() => {
    console.log('Current puzzle:', current);
  }, [idx, phase]);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 12 }}>
      {phase === "start" && <StartScreen onStart={begin} />}

      {phase === "lobby" && (
        <LobbyScreen nickname={nickname} onReady={onLobbyReady} />
      )}

      {phase === "game" && (
        <>
          <HUDTimer secondsLeft={secondsLeft} />
          <Chat messages={chat} />
          {current && (
            <PuzzleCard
              key={current.id}
              puzzle={current}
              onSolve={handleSubmit}
            />
          )}
        </>
      )}

      {phase === "win" && (
        <VictoryScreen
          nickname={nickname}
          secondsLeft={secondsLeft}
          onRestart={restart}
        />
      )}

      {phase === "lose" && (
        <GameOverScreen onRestart={restart} />
      )}
    </div>
  );
}