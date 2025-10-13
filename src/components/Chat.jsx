import { useEffect, useRef } from "react";

export default function Chat({ messages }) {
  const ref = useRef(null);
  useEffect(()=>ref.current?.scrollIntoView({behavior:"smooth"}), [messages]);
  return (
    <div style={{maxHeight:"46vh", overflowY:"auto", padding:12, background:"#000", color:"#8f8"}}>
      {messages.map((m,i)=>(
        <div key={i} style={{margin:"6px 0"}}>
          <strong>{m.role === "assistant" ? "AI-Zeta" : "You"}:</strong>{" "}
          <span style={{whiteSpace:"pre-wrap"}}>{m.content}</span>
        </div>
      ))}
      <div ref={ref} />
    </div>
  );
}
