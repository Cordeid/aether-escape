import { createClient } from "@supabase/supabase-js";

// Public keys (safe for client) – set in Vercel as VITE_* and redeploy
const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  console.error("[Realtime] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
});

export function makeId(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[(Math.random() * chars.length) | 0]).join("");
}
const COLORS = ["#9ef","#ffb4a2","#ffd166","#b9fbc0","#bdb2ff","#f1c0e8","#90dbf4","#f4a261","#e9ff70","#a0c4ff","#caffbf","#ffc6ff"];
export function randomColor(){ return COLORS[(Math.random() * COLORS.length) | 0]; }

// 🔒 Single global room (configurable)
const GLOBAL_ROOM = (import.meta.env.VITE_ROOM_ID || "MAIN").toUpperCase();
const CHANNEL_NAME = `room:${GLOBAL_ROOM}`;

// Keep a single channel instance
let channel;

/**
 * Join the global realtime room (ignores the roomId argument on purpose).
 * Returns: { channel, presence, on, send }
 */
export async function joinRoom(_ignoredRoomId, user) {
  if (!channel) {
    channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: user.id }, broadcast: { ack: true } },
    });

    // Debug helpers
    if (typeof window !== "undefined") {
      window.__rt = window.__rt || {};
      window.__rt.supabaseUrl = URL;
      window.__rt.roomId = GLOBAL_ROOM;
      window.__rt.channelName = CHANNEL_NAME;
      window.__rt.channels = () => supabase.getChannels?.() || [];
      window.__rt.presence = () => channel.presenceState();
      window.__rt.send = (event, payload) => channel.send({ type: "broadcast", event, payload });
      console.log("[Realtime] Created global channel:", CHANNEL_NAME);
    }
  }

  const presence = { me: user, list: [] };
  const listeners = { chat: [], ai: [], start: [], state: [], lobby: [], try: [], dbg: [] };

  // Presence → unique list (first meta per key)
  function emitPresence() {
    const state = channel.presenceState();
    const people = Object.values(state).map((arr) => arr[0]);
    presence.list = people;
    listeners.lobby.forEach((fn) => fn(people));
  }

  channel.on("presence", { event: "sync" }, () => {
    console.log("[Realtime] presence sync on", CHANNEL_NAME);
    emitPresence();
  });

  // Broadcast handlers
  for (const ev of ["chat","ai","start","state","try","dbg"]) {
    channel.on("broadcast", { event: ev }, (p) => {
      if (ev === "dbg") console.log("[Realtime] (dbg) payload:", p.payload);
      (listeners[ev] || []).forEach((fn) => fn(p.payload));
    });
  }

  await channel.subscribe(async (status) => {
    console.log("[Realtime] Status:", status, "channel:", CHANNEL_NAME);
    if (status === "SUBSCRIBED") {
      try {
        console.log("[Realtime] Tracking presence for", user);
        const res = await channel.track({
          id: user.id,
          name: user.name,
          color: user.color || randomColor(),
          ts: user.ts || Date.now(),
        });
        console.log("[Realtime] Presence track result:", res);
        emitPresence(); // immediate UI sync
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
