// src/components/PuzzleCard.jsx
import React, { useState, useEffect } from "react";
import { zetaSpeak } from "../services/aiClient";

export default function PuzzleCard({ puzzle, onSolve }) {
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [zetaResponse, setZetaResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);

  // Reset state when puzzle changes
  useEffect(() => {
    setInput("");
    setFeedback("");
    setZetaResponse("");
    setHintsUsed(0);
  }, [puzzle?.id]);

  if (!puzzle) {
    return (
      <div className="p-4 bg-black/70 text-green-300 rounded-xl max-w-lg mx-auto text-center">
        <p>⚠️ No puzzle loaded.</p>
      </div>
    );
  }

  // Handle answer submission
  async function handleSubmit(e) {
    e.preventDefault();
    const answer = input.trim();
    if (!answer) return;

    try {
      setSubmitting(true);
      onSolve?.(answer); // Pass answer to parent (App) for check
    } catch (err) {
      console.error("Submit failed:", err);
      setFeedback("⚠️ Internal error.");
    } finally {
      setSubmitting(false);
    }
  }

  // Ask AI-Zeta for a hint or contextual help
  async function handleHint() {
    try {
      setHintsUsed((h) => h + 1);
      setZetaResponse("AI-Zeta: [static] ...connecting...");
      const prompt = `We are playing a puzzle game aboard Aether Station. Provide a subtle hint for puzzle "${puzzle.id}" without spoilers.`;
      const hint = await zetaSpeak([{ role: "user", content: prompt }]);
      setZetaResponse(hint);
    } catch (err) {
      console.error("Hint error:", err);
      setZetaResponse("AI-Zeta: [static] (Signal lost... try again)");
    }
  }

  return (
    <div className="p-6 bg-black/70 border border-green-600 rounded-2xl text-green-200 max-w-xl mx-auto font-mono shadow-xl">
      <h2 className="text-green-400 font-bold text-lg mb-2">
        {puzzle.title} {/* Use puzzle.title directly */}
      </h2>
      <pre className="whitespace-pre-wrap text-sm mb-3 text-green-100">
        {puzzle.prompt}
      </pre>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 items-stretch">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your answer..."
          className="flex-1 rounded-md px-3 py-2 bg-black/50 text-green-200 border border-green-700 focus:outline-none focus:ring-2 focus:ring-green-400"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-black font-bold rounded-md disabled:opacity-50"
        >
          {submitting ? "..." : "Submit"}
        </button>
      </form>

      {feedback && (
        <p className="mt-3 text-sm text-yellow-300 whitespace-pre-wrap">
          {feedback}
        </p>
      )}

      {zetaResponse && (
        <p className="mt-3 text-sm text-cyan-300 whitespace-pre-wrap">
          {zetaResponse}
        </p>
      )}

      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={handleHint}
          className="px-3 py-1 bg-cyan-700 hover:bg-cyan-800 rounded-md text-sm text-white"
        >
          Ask AI-Zeta for hint ({hintsUsed})
        </button>
        <span className="text-xs text-green-500 italic">
          Hints used: {hintsUsed}
        </span>
      </div>
    </div>
  );
}