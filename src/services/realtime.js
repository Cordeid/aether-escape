// src/services/realtime.js
import { createClient } from "@supabase/supabase-js";

/* ---------- ENV (frontend-safe) ---------- */
const URL  = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error("[Realtime] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}
export const supabase = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
});

/* ---------- small utils (kept) ---------- */
export function makeId(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[(Math.random() * chars.length) | 0]).join("");
}
const COLORS = ["#9ef","#ffb4a2","#ffd166","#b9fbc0","#bdb2ff","#f1c0e8","#90dbf4","#f4a261","#e9ff70","#a0c4ff","#caffbf","#ffc6ff"];
export function randomColor(){ return COLORS[(Math.random() * COLORS.length) | 0]; }

/* ---------- one global room ---------- */
const GLOBAL_ROOM  = (import.meta.env.VITE_ROOM_ID || "MAIN").toUpperCase();
const CHANNEL_NAME = `room:${GLOBAL_ROOM}`;

/* ---------- module-level SINGLETON state ---------- */
let channel = null;              // the one and only channel per tab
let tracked = false;             // ensure track() only once
const listeners = {              // global fan-out lists
  lobby: new Set(),
  chat:  new Set(),
  ai:    new Set(),
  start: new Set(),
  state: new Set(),
  try:   new Set(),
  dbg:   new Set(),
};
let lastPresenceList = [];       // cache the computed presence list

// emit presence to all lobby handlers
function emitPresenceToAll() {
  const state = channel?.presenceState?.() || {};
  const people = Object.values(state).map(arr => arr[0]); // 1 meta per user
  lastPresenceList = people;
  for (const fn of listeners.lobby) fn(people);
}

// wire the channel only once
async function ensureChannel(user) {
  if (channel) return channel;

  channel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: user.id }, broadcast: { ack: true } },
  });

  if (typeof window !== "undefined") {
    window.__rt = window.__rt || {};
    window.__rt.supabaseUrl  = URL;
    window.__rt.roomId       = GLOBAL_ROOM;
    window.__rt.channelName  = CHANNEL_NAME;
    window.__rt.channels     = () => supabase.getChannels?.() || [];
    window.__rt.presence     = () => channel.presenceState();
    window.__rt.send         = (event, payload) =>
      channel.send({ type: "broadcast", event, payload });
    console.log("[Realtime] Singleton channel:", CHANNEL_NAME, "presence key:", user.id);
  }

  // Presence hooks (stable)
  channel.on("presence", { event: "sync"  }, emitPresenceToAll);
  channel.on("presence", { event: "join"  }, () => {/* optional log */});
  channel.on("presence", { event: "leave" }, () => {/* optional log */});

  // Broadcast hooks → fan out to all registered listeners of that type
  for (const ev of ["chat","ai","start","state","try","dbg"]) {
    channel.on("broadcast", { event: ev }, pkt => {
      if (ev === "dbg") console.log("[Realtime] (dbg)", pkt.payload);
      for (const fn of (listeners[ev] || [])) fn(pkt.payload);
    });
  }

  // Subscribe with callback, then track ONCE
  await channel.subscribe(async (status) => {
    // SUBSCRIBED fires once; reconnects would also call it again,
    // but our 'tracked' flag prevents re-tracking (no join/leave loop).
    if (status === "SUBSCRIBED" && !tracked) {
      tracked = true;
      try {
        await channel.track({
          id: user.id,
          name: user.name,
          color: user.color || randomColor(),
          ts: user.ts || Date.now(),
        });
        // Immediately emit so UI never sits at 0
        emitPresenceToAll();
      } catch (err) {
        console.error("[Realtime] track() failed:", err);
      }
    }
  });

  return channel;
}

/**
 * Public API used by components.
 * Ensures:
 *  - only one channel is ever created per tab
 *  - track() runs once per tab
 *  - handlers are registered into global Sets and cleaned up on unmount
 */
export async function joinRoom(_ignored, user) {
  await ensureChannel(user);

  // per-caller facade
  function on(type, fn) {
    if (!listeners[type]) listeners[type] = new Set();
    listeners[type].add(fn);

    // if they ask for lobby right after mount, give them the latest snapshot
    if (type === "lobby" && lastPresenceList.length) {
      try { fn(lastPresenceList); } catch {}
    }

    // return a disposer so caller can detach on unmount if desired
    return () => listeners[type]?.delete(fn);
  }

  function send(type, payload) {
    return channel.send({ type: "broadcast", event: type, payload });
  }

  return { channel, on, send, presence: { list: lastPresenceList, me: user } };
}
