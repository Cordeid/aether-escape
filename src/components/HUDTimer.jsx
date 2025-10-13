import { useEffect } from "react";

export default function HUDTimer({ secondsLeft, onTick }) {
  useEffect(() => { const id = setInterval(() => onTick(), 1000); return () => clearInterval(id); }, [onTick]);
  const m = String(Math.floor(secondsLeft/60)).padStart(2,"0");
  const s = String(secondsLeft%60).padStart(2,"0");
  const danger = secondsLeft <= 60;
  return (
    <div style={{
      position:"fixed", top:12, right:16, padding:"6px 10px", borderRadius:8,
      background: danger ? "#320" : "#012", color: danger ? "#f66" : "#7ef",
      fontFamily:"monospace", fontWeight:700
    }}>
      ⏱ {m}:{s}
    </div>
  );
}
