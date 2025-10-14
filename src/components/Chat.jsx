import { useEffect, useRef, useState } from "react";

export default function Chat({ messages, onSend }) {
  const ref = useRef(null);
  const [text, setText] = useState("");

  useEffect(() => ref.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !onSend) return;
    onSend(t);
    setText("");
  }

  return (
    <div style={{ maxHeight: "46vh", overflowY: "auto", padding: 12, background: "#000", color: "#8f8" }}>
      {messages.map((m, i) => (
        <div key={i} style={{ margin: "6px 0" }}>
          <strong>{m.role === "assistant" ? "AI-Zeta" : "You"}:</strong>{" "}
          <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
        </div>
      ))}
      <div ref={ref} />
      {onSend && (
        <form onSubmit={submit} style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Type a message… (tip: "/z your question" talks to AI-Zeta)'
            style={{
              flex: 1,
              background: "#030",
              color: "#8f8",
              border: "1px solid #083",
              borderRadius: 6,
              padding: "6px 8px",
            }}
          />
          <button style={{ padding: "6px 10px" }}>Send</button>
        </form>
      )}
    </div>
  );
}
