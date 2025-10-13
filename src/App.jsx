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

  // Called by LobbyScreen when the host starts (or when we receive a Start)
  // payload: { roomId, startAt, players, isHost }
  async function onLobbyReady(payload) {
    setLobby(payload);

    // Join a dedicated "game" channel to broadcast AI/chat/state
    const user = { id: crypto.randomUUID(), name: nickname, color: "#9ef", ts: Date.now() };
    const ctx = await joinRoom(payload.roomId + ":game", user);
    chanRef.current = ctx;

    // Everyone listens to game chat (players’ messages), AI replies, and state updates
    ctx.on("chat", (m) => {
      setChat((c) => [...c, { role: m.role || "user", content: m.text }]);
    });

    ctx.on("ai", (m) => {
      setChat((c) => [...c, { role: "assistant", content: m.text }]);
    });

    ctx.on("state", (s) => {
      if (typeof s.idx === "number") setIdx(s.idx);

      if (typeof s.startAt === "number") {
        startAtRef.current = s.startAt;
        startTicker(); // sync timer from shared anchor
      }

      if (s.win) {
        stopTicker();
        setPhase("win");
      }

      if (s.gameOver) {
        stopTicker();
        setPhase("lose");
      }
    });

    // If we already received a startAt from the lobby, enter game now
    if (payload.startAt) {
      startAtRef.current = payload.startAt;
      setPhase("game");
      startTicker();

      // Host sends the intro & initial state once
      if (payload.isHost) {
        const intro = await zetaSpeak([
          {
            role: "user",
            content: `Multiplayer run started for room ${payload.roomId}.
Greet the crew briefly, remind them of the 10-minute limit, and introduce the first puzzle in <=2 lines.`,
          },
        ]);
        ctx.send("ai", { text: intro });
        ctx.send("state", { idx: 0, startAt: payload.startAt });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Timer (shared via startAt)
  // ─────────────────────────────────────────────────────────────
  function startTicker() {
    stopTicker();
    tickerRef.current = setInterval(() => {
      const startAt = startAtRef.current;
      if (!startAt) return;

      const elapsed = Math.floor((Date.now() - startAt) / 1000);
      const left = Math.max(0, TOTAL_SECONDS - elapsed);
      setSecondsLeft(left);

      if (left <= 0) {
        stopTicker();

        // Host announces game over to everyone; clients also flip as fallback.
        try {
          if (lobby?.isHost && chanRef.current) {
            chanRef.current.send("ai", { text: "AI-Zeta: [static]… the horizon takes us." });
            chanRef.current.send("state", { gameOver: true });
          }
        } finally {
          setPhase("lose"); // local fallback if host disconnects
        }
      }
    }, 1000);
  }

  function stopTicker() {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Chat + Answers
  // ─────────────────────────────────────────────────────────────
  function sendSharedChat(from, text) {
    chanRef.current?.send("chat", { from, text, role: "user", at: Date.now() });
    setChat((c) => [...c, { role: "user", content: text }]); // optimistic echo
  }

  const handleSubmit = async (answer) => {
    if (!current || isTimeUp(secondsLeft)) return;

    sendSharedChat(nickname, answer);

    if (!lobby?.isHost) return; // Non-hosts stop here (host controls AI/state)

    const correct = current.answer(answer);

    if (correct) {
      const yay = await zetaSpeak([
        {
          role: "user",
          content: `Team solved "${current.id}". Congratulate briefly and set up the next step in one short line.`,
        },
      ]);
      chanRef.current.send("ai", { text: yay });

      const nextIndex = advance(idx, true);
      if (nextIndex < PUZZLES.length) {
        chanRef.current.send("state", { idx: nextIndex });
        const nextIntro = await zetaSpeak([
          {
            role: "user",
            content: `Introduce the puzzle "${PUZZLES[nextIndex].title}" in <=2 lines. No spoilers.`,
          },
        ]);
        chanRef.current.send("ai", { text: nextIntro });
      } else {
        chanRef.current.send("ai", { text: "AI-Zeta: Escape vector locked. Hold on…" });
        chanRef.current.send("state", { win: true });
        stopTicker();
        setPhase("win");
      }
    } else {
      const nudge = await zetaSpeak([
        {
          role: "user",
          content: `Wrong attempt for puzzle "${current.id}": "${answer}". Provide a subtle nudge (no spoilers) in one short line, in character.`,
        },
      ]);
      chanRef.current.send("ai", { text: nudge });
    }
  };

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
          <HUDTimer secondsLeft={secondsLeft} onTick={() => {}} />
          <Chat messages={chat} />
          {current && (
            <PuzzleCard
              key={current.id}
              title={`[${idx + 1}/${PUZZLES.length}] ${current.title}`}
              prompt={current.prompt}
              disabled={isTimeUp(secondsLeft)}
              onSubmit={handleSubmit}
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
