// src/services/realtime.js
import { createClient } from "@supabase/supabase-js";

/**
 * FRONTEND env (Vercel → Project → Settings → Environment Variables)
 * VITE_SUPABASE_URL=https://<project>.supabase.co
 * VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
 * (Use the anon key, NOT sb_secret_...)
 */
const URL  = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  console.error("[Realtime] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
});

/* Utilities (unchanged) */
export function makeId(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[(Math.random() * chars.length) | 0]).join("");
}
const COLORS = ["#9ef","#ffb4a2","#ffd166","#b9fbc0","#bdb2ff","#f1c0e8","#90dbf4","#f4a261","#e9ff70","#a0c4ff","#caffbf","#ffc6ff"];
export function randomColor(){ return COLORS[(Math.random() * COLORS.length) | 0]; }

/* Single global room */
const GLOBAL_ROOM  = (import.meta.env.VITE_ROOM_ID || "MAIN").toUpperCase();
const CHANNEL_NAME = `room:${GLOBAL_ROOM}`;

/**
 * Join the global room.
 * Returns { channel, presence, on, send }.
 * Defenses against “join/leave loop”:
 *  - Close duplicate channels before creating a new one
 *  - Subscribe via callback and track() exactly once
 *  - Emit presence immediately after track so UI updates
 */
export async function joinRoom(_ignored, user) {
  // 🔒 close any duplicate pre-existing channel with same topic
  for (const c of supabase.getChannels?.() || []) {
    if ((c.topic || c.params?.channel) === CHANNEL_NAME) {
      console.log("[Realtime] Closing duplicate channel:", CHANNEL_NAME);
      try { await c.unsubscribe(); } catch {}
    }
  }

  const channel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: user.id }, broadcast: { ack: true } },
  });

  // small debug surface
  if (typeof window !== "undefined") {
    window.__rt = window.__rt || {};
    window.__rt.supabaseUrl  = URL;
    window.__rt.roomId       = GLOBAL_ROOM;
    window.__rt.channelName  = CHANNEL_NAME;
    window.__rt.channels     = () => supabase.getChannels?.() || [];
    window.__rt.presence     = () => channel.presenceState();
    window.__rt.send         = (event, payload) => channel.send({ type: "broadcast", event, payload });
    console.log("[Realtime] Creating channel:", CHANNEL_NAME, "presence key:", user.id);
  }

  const presence = { me: user, list: [] };
  const listeners = { chat: [], ai: [], start: [], state: [], lobby: [], try: [], dbg: [] };

  function emitPresence() {
    const state = channel.presenceState();            // { key: [meta, ...] }
    const people = Object.values(state).map(a => a[0]); // one meta per user
    presence.list = people;
    (listeners.lobby || []).forEach(fn => fn(people));
  }

  // Presence visibility (optional logs)
  channel.on("presence", { event: "sync"  }, () => { emitPresence(); });
  channel.on("presence", { event: "join"  }, () => { /* optional log */ });
  channel.on("presence", { event: "leave" }, () => { /* optional log */ });

  // Broadcast handlers
  for (const ev of ["chat","ai","start","state","try","dbg"]) {
    channel.on("broadcast", { event: ev }, pkt => {
      if (ev === "dbg") console.log("[Realtime] (dbg)", pkt.payload);
      (listeners[ev] || []).forEach(fn => fn(pkt.payload));
    });
  }

  // Subscribe via callback, then track ONCE
  let tracked = false;
  await channel.subscribe(async (status) => {
    // status is one of: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR"
    if (status === "SUBSCRIBED" && !tracked) {
      tracked = true;
      try {
        const res = await channel.track({
          id: user.id,
          name: user.name,
          color: user.color || randomColor(),
          ts: user.ts || Date.now(),
        });
        // ensure UI updates even if sync diff already happened
        emitPresence();
      } catch (err) {
        console.error("[Realtime] track() failed:", err);
      }
    }
  });

  function on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }
  function send(type, payload) { channel.send({ type: "broadcast", event: type, payload }); }

  return { channel, presence, on, send };
}
