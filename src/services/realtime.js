import { createClient } from "@supabase/supabase-js";

/**
 * FRONTEND env (Vercel ➜ Project ➜ Settings ➜ Environment Variables)
 * VITE_SUPABASE_URL=https://<project>.supabase.co
 * VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
 * (Do NOT use sb_secret_... here)
 */
const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  console.error("[Realtime] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
});

// small utils you already use
export function makeId(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[(Math.random() * chars.length) | 0]).join("");
}
const COLORS = ["#9ef","#ffb4a2","#ffd166","#b9fbc0","#bdb2ff","#f1c0e8","#90dbf4","#f4a261","#e9ff70","#a0c4ff","#caffbf","#ffc6ff"];
export function randomColor(){ return COLORS[(Math.random() * COLORS.length) | 0]; }

// 🔒 Single global room
const GLOBAL_ROOM = (import.meta.env.VITE_ROOM_ID || "MAIN").toUpperCase();
const CHANNEL_NAME = `room:${GLOBAL_ROOM}`;

/**
 * Join the global room.
 * Returns { channel, presence, on, send }.
 *
 * Key guarantees:
 *  - subscribe via callback, not async return value (avoids race)
 *  - track() runs only after we see SUBSCRIBED
 *  - emits presence immediately after track so UI updates right away
 *  - very loud logs + window.__rt helpers for live debugging
 */
export async function joinRoom(_ignored, user) {
  // every browser gets its own channel instance; presence key is the user id
  const channel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: user.id }, broadcast: { ack: true } },
  });

  // ---------- debug helpers ----------
  if (typeof window !== "undefined") {
    window.__rt = window.__rt || {};
    window.__rt.supabaseUrl = URL;
    window.__rt.roomId = GLOBAL_ROOM;
    window.__rt.channelName = CHANNEL_NAME;
    window.__rt.channels = () => supabase.getChannels?.() || [];
    window.__rt.presence = () => channel.presenceState();
    window.__rt.send = (event, payload) => channel.send({ type: "broadcast", event, payload });
    console.log("[Realtime] Using Supabase URL:", URL);
    console.log("[Realtime] Creating channel:", CHANNEL_NAME, "presence key:", user.id);
  }

  const presence = { me: user, list: [] };
  const listeners = { chat: [], ai: [], start: [], state: [], lobby: [], try: [], dbg: [] };

  function emitPresence() {
    const state = channel.presenceState();     // { <key>: [ {id,name,...}, ... ] }
    const people = Object.values(state).map((arr) => arr[0]); // first meta per key
    presence.list = people;
    listeners.lobby.forEach((fn) => fn(people));
  }

  // Presence events (for visibility while debugging)
  channel.on("presence", { event: "sync" }, () => {
    console.log("[Realtime] presence SYNC", CHANNEL_NAME, channel.presenceState());
    emitPresence();
  });
  channel.on("presence", { event: "join" }, (d) => console.log("[Realtime] presence JOIN", d));
  channel.on("presence", { event: "leave" }, (d) => console.log("[Realtime] presence LEAVE", d));

  // Broadcast handlers
  for (const ev of ["chat", "ai", "start", "state", "try", "dbg"]) {
    channel.on("broadcast", { event: ev }, (pkt) => {
      if (ev === "dbg") console.log("[Realtime] (dbg)", pkt.payload);
      (listeners[ev] || []).forEach((fn) => fn(pkt.payload));
    });
  }

  // ----- subscribe with callback, then track -----
  let tracked = false;
  await channel.subscribe(async (status) => {
    console.log("[Realtime] Status:", status, "on", CHANNEL_NAME);
    if (status === "SUBSCRIBED" && !tracked) {
      tracked = true;
      try {
        const res = await channel.track({
          id: user.id,
          name: user.name,
          color: user.color || randomColor(),
          ts: user.ts || Date.now(),
        });
        console.log("[Realtime] track() =>", res);
        emitPresence(); // immediate update; UI won’t sit at 0
      } catch (err) {
        console.error("[Realtime] track() failed:", err);
      }
    }
  });

  function on(type, fn) {
    (listeners[type] = listeners[type] || []).push(fn);
  }
  function send(type, payload) {
    channel.send({ type: "broadcast", event: type, payload });
  }

  return { channel, presence, on, send };
}
