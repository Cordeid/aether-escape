import { useState } from "react";

export default function StartScreen({ onStart }) {
  const [name, setName] = useState("");
  return (
    <div style={{textAlign:"center", paddingTop:80}}>
      <h1>Escape from the Aether Station</h1>
      <p>10 minutes. 4 puzzles. AI-Zeta will guide you.</p>
      <form onSubmit={(e)=>{e.preventDefault(); if(name.trim()) onStart(name.trim());}}>
        <input
          value={name}
          onChange={(e)=>setName(e.target.value)}
          placeholder="Enter nickname"
          style={{padding:10, borderRadius:8, width:260}}
        />
        <button style={{marginLeft:8, padding:"10px 16px", borderRadius:8}}>Start</button>
      </form>
    </div>
  );
}
