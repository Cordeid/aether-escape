import { useState } from "react";

export default function StartScreen({ onStart }) {
  const [name, setName] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const nick = name.trim();
    if (nick) onStart(nick);
  };

  return (
    <main className="hero">
      <section className="glass" role="region" aria-label="Game introduction">
        <h1 className="hero-title">Escape from the Aether Station</h1>
        <p className="hero-sub">10 minutes. 4 puzzles. AI-Zeta will guide you.</p>

        <p className="hero-story">
          The deep-space research platform <em>Aether Station</em> has slipped out of orbit and is
          being dragged toward a newborn black hole. Systems are failing. The only companion left
          is <strong>AI-Zeta</strong>—damaged, glitchy, but trying to help you reach the escape pod
          before the station crosses the event horizon.
        </p>

        <ul className="hero-howto">
          <li>💡 Puzzles escalate from easy to hard. Ask AI-Zeta for hints if you stall.</li>
          <li>⏱️ A global 10-minute timer—use your time wisely.</li>
          <li>🧪 Answers are short (numbers, words, or names). No spoilers from AI-Zeta.</li>
        </ul>

        <form onSubmit={submit} className="form-row" aria-label="Enter nickname to start">
          <label htmlFor="nick" className="sr-only">Nickname</label>
          <input
            id="nick"
            className="input"
            placeholder="Enter nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
          <button className="btn" type="submit" disabled={!name.trim()}>
            Start
          </button>
        </form>
      </section>
    </main>
  );
}
