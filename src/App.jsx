import { useCallback, useEffect, useMemo, useState } from "react";
import "./styles/global.css";
import StartScreen from "./components/StartScreen";
import Chat from "./components/Chat";
import HUDTimer from "./components/HUDTimer";
import PuzzleCard from "./components/PuzzleCard";
import { PUZZLES } from "./data/puzzles";
import { TOTAL_SECONDS, isTimeUp, nextHintIndex, advance } from "./lib/engine";
import { zetaSpeak } from "./services/aiClient";

export default function App() {
  const [started, setStarted] = useState(false);
  const [nickname, setNickname] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [idx, setIdx] = useState(0);
  const [puzzleStart, setPuzzleStart] = useState(null);
  const [chat, setChat] = useState([]);
  const current = PUZZLES[idx];

  // Start game
  const begin = async (name) => {
    setNickname(name);
    setStarted(true);
    setSecondsLeft(TOTAL_SECONDS);
    setIdx(0);
    setPuzzleStart(Date.now());
    const intro = await zetaSpeak([
      {
        role: "user",
        content: `Player ${name} initiated escape protocol. Greet and explain 10-minute limit and present first puzzle very briefly.`,
      },
    ]);
    setChat([{ role: "assistant", content: intro }]);
  };

  // Global timer
  const onTick = useCallback(() => setSecondsLeft((s) => Math.max(0, s - 1)), []);

  // Automatic hint logic
  useEffect(() => {
    if (!started || !current || !puzzleStart) return;
    const elapsed = Math.floor((Date.now() - puzzleStart) / 1000);
    const hintIx = nextHintIndex(elapsed);
    if (
      hintIx >= 0 &&
      current.hints &&
      !chat.some((m) => m.meta === `hint-${current.id}-${hintIx}`)
    ) {
      setChat((c) => [
        ...c,
        {
          role: "assistant",
          content: `AI-Zeta [hint]: ${current.hints[hintIx]}`,
          meta: `hint-${current.id}-${hintIx}`,
        },
      ]);
    }
  }, [started, current, puzzleStart, chat]);

  // Time up condition
  useEffect(() => {
    if (started && isTimeUp(secondsLeft)) {
      setChat((c) => [
        ...c,
        {
          role: "assistant",
          content: "AI-Zeta: …time depleted. Emergency seals engaged. **Escape failed.**",
        },
      ]);
    }
  }, [secondsLeft, started]);

  // Handle answers
  const handleSubmit = async (answer) => {
    if (!current || isTimeUp(secondsLeft)) return;
    setChat((c) => [...c, { role: "user", content: answer }]);
    const correct = current.answer(answer);
    if (correct) {
      const yay = await zetaSpeak([
        { role: "user", content: `Player solved "${current.id}". Congratulate briefly and set up the next step.` },
      ]);
      setChat((c) => [...c, { role: "assistant", content: yay }]);
      const nextIndex = advance(idx, true);
      if (nextIndex < PUZZLES.length) {
        setIdx(nextIndex);
        setPuzzleStart(Date.now());
        const nextMsg = await zetaSpeak([
          { role: "user", content: `Introduce puzzle "${PUZZLES[nextIndex].title}" in <=2 lines. No spoilers.` },
        ]);
        setChat((c) => [...c, { role: "assistant", content: nextMsg }]);
      } else {
        const finale = await zetaSpeak([
          { role: "user", content: `All puzzles solved. Deliver triumphant escape ending in 2-3 lines.` },
        ]);
        setChat((c) => [...c, { role: "assistant", content: finale }]);
      }
    } else {
      const nudge = await zetaSpeak([
        { role: "user", content: `User answered "${answer}" for "${current.id}" but it's wrong. Provide a subtle, non-spoiler nudge in 1 line.` },
      ]);
      setChat((c) => [...c, { role: "assistant", content: nudge }]);
    }
  };

  const disabled = useMemo(
    () => !started || isTimeUp(secondsLeft) || idx >= PUZZLES.length,
    [started, secondsLeft, idx]
  );

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 12 }}>
      {!started ? (
        <StartScreen onStart={begin} />
      ) : (
        <>
          <HUDTimer secondsLeft={secondsLeft} onTick={onTick} />
          <Chat messages={chat} />
          {current && idx < PUZZLES.length && (
            <PuzzleCard
              key={current.id}
              title={`[${idx + 1}/4] ${current.title}`}
              prompt={current.prompt}
              disabled={disabled}
              onSubmit={handleSubmit}
            />
          )}
        </>
      )}
    </div>
  );
}
