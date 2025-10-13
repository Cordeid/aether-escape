import { useState } from "react";

export default function PuzzleCard({ title, prompt, disabled, onSubmit }) {
  const [v,setV] = useState("");
  return (
    <div style={{padding:12, border:"1px solid #244", borderRadius:12, background:"#021"}}>
      <h2 style={{color:"#9ef", margin:"0 0 6px"}}>{title}</h2>
      <pre style={{whiteSpace:"pre-wrap", color:"#bdf", margin:0}}>{prompt}</pre>
      <form onSubmit={(e)=>{e.preventDefault(); if(v.trim()) onSubmit(v); setV("");}}>
        <input
          disabled={disabled}
          value={v}
          onChange={(e)=>setV(e.target.value)}
          placeholder="Type your answer…"
          style={{marginTop:8, width:"70%", padding:8, borderRadius:8, border:"1px solid #355", background:"#013", color:"#cfe"}}
        />
        <button disabled={disabled} style={{marginLeft:8, padding:"8px 12px", borderRadius:8}}>Submit</button>
      </form>
    </div>
  );
}
