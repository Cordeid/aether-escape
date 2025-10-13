// src/App.jsx
import React, { useState } from "react";
import StartScreen from "./components/StartScreen";
import Chat from "./components/Chat";
import PuzzleCard from "./components/PuzzleCard";
import HUDTimer from "./components/HUDTimer";
import VictoryScreen from "./components/VictoryScreen"; // ✅ new
import { PUZZLES } from "./data/puzzles";
import { zetaSpeak } from "./services/aiClient";
import { isTimeUp, TOTAL_SECONDS, advance } from "./lib/engine";

export default function App() {
  const [nickname, setNickname] = useState("");
  const [started, setStarted] = useState(false);
  const [won, setWon] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [chat, setChat] = useState([]);
  const [idx, setIdx] = useState(0);
  const [puzzleStart, setPuzzleStart] = useState(null);

  const current = PUZZLES[idx];

  // 🕒 timer tick handler
  const onTick = (remaining) => setSecondsLeft(remaining);

  // 🟢 Start game
  const begin = async (name) => {
    setNickname(name);
    setStarted(true);
    setWon(false);
    setSecondsLeft(TOTAL_SECONDS);
    setIdx(0);
    setPuzzleStart(Date.now());

    const intro = await zetaSpeak([
      {
        role: "user",
        content: `Player ${name} initiated the Aether Station escape sequence. 
Greet them, explain the 10-minute time limit, and briefly introduce the first puzzle. 
Keep tone urgent but encouraging.`,
      },
    ]);

    setChat([{ role: "assistant", content: intro }]);
  };

  // 🧩 Submit answer
  const handleSubmit = async (answer) => {
    if (!current || isTimeUp(secondsLeft)) return;

    setChat((c) => [...c, { role: "user", content: answer }]);
    const correct = current.answer(answer);

    if (correct) {
      // ✅ correct answer
      const yay = await zetaSpeak([
        {
          role: "user",
          content: `Player solved "${current.id}". Congratulate briefly, 
then set up transition to next puzzle in 1 line.`,
        },
      ]);
      setChat((c) => [...c, { role: "assistant", content: yay }]);

      const nextIndex = advance(idx, true);

      if (nextIndex < PUZZLES.length) {
        // move to next puzzle
        setIdx(nextIndex);
        setPuzzleStart(Date.now());
        const nextMsg = await zetaSpeak([
          {
            role: "user",
            content: `Introduce the puzzle "${PUZZLES[nextIndex].title}" 
in <=2 lines. Keep AI-Zeta in character, do not reveal solution.`,
          },
        ]);
        setChat((c) => [...c, { role: "assistant", content: nextMsg }]);
      } else {
        // 🏁 all puzzles complete
        setWon(true);
        const finale = await zetaSpeak([
          {
            role: "user",
            content: `All puzzles complete. Send one short farewell message in AI-Zeta style before communication fades.`,
          },
        ]);
        setChat((c) => [...c, { role: "assistant", content: finale }]);
      }
    } else {
      // ❌ wrong answer
      const nudge = await zetaSpeak([
        {
          role: "user",
          content: `User answered "${answer}" for puzzle "${current.id}" but it's wrong. 
Give a subtle, non-spoiler hint in one short line, staying in character.`,
        },
      ]);
      setChat((c) => [...c, { role: "assistant", content: nudge }]);
    }
  };

  // 🔁 Restart
  function restart() {
    setStarted(false);
    setWon(false);
    setChat([]);
    setIdx(0);
    setSecondsLeft(TOTAL_SECONDS);
    setPuzzleStart(null);
  }

  // 🧠 Render
  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 12 }}>
      {!started ? (
        <StartScreen onStart={begin} />
      ) : won ? (
        <VictoryScreen
          nickname={nickname}
          secondsLeft={secondsLeft}
          onRestart={restart}
        />
      ) : (
        <>
          <HUDTimer secondsLeft={secondsLeft} onTick={onTick} />
          <Chat messages={chat} />
          {current && idx < PUZZLES.length && (
            <PuzzleCard
              key={current.id}
              title={`[${idx + 1}/${PUZZLES.length}] ${current.title}`}
              prompt={current.prompt}
              disabled={
                !started || isTimeUp(secondsLeft) || idx >= PUZZLES.length
              }
              onSubmit={handleSubmit}
            />
          )}
        </>
      )}
    </div>
  );
}
