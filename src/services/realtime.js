import { createClient } from "@supabase/supabase-js";

/**
 * FRONTEND ENV (must be set in Vercel with VITE_ prefix)
 * VITE_SUPABASE_URL=https://<project>.supabase.co
 * VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
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

// small utils kept from your project
export function makeId(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[(Math.random() * chars.length) | 0]).join("");
}
const COLORS = ["#9ef","#ffb4a2","#ffd166","#b9fbc0","#bdb2ff","#f1c0e8","#90dbf4","#f4a261","#e9ff70","#a0c4ff","#caffbf","#ffc6ff"];
export function randomColor(){ return COLORS[(Math.random() * COLORS.length) | 0]; }

// 🔒 Single global room (configurable)
const GLOBAL_ROOM = (import.meta.env.VITE_ROOM_ID || "MAIN").toUpperCase();
const CHANNEL_NAME = `room:${GLOBAL_ROOM}`;

/**
 * Join the global room. Returns { channel, presence, on, send }.
 * This version:
 *  - Subscribes with the canonical API (await channel.subscribe())
 *  - Tracks presence ONLY after we are fully SUBSCRIBED
 *  - Emits presence immediately so UI updates right away
 *  - Adds verbose debug + join/leave logs
 */
export async function joinRoom(_ignored, user) {
  // Each browser builds its own channel with a unique presence key = user.id
  const channel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: user.id }, broadcast: { ack: true } },
  });

  // ---------- Debug surface ----------
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

  // Convert presence map → unique list (first meta per presence key)
  function emitPresence() {
    const state = channel.presenceState(); // { key: [{...meta}, ...] }
    const people = Object.values(state).map((arr) => arr[0]); // one per user
    presence.list = people;
    listeners.lobby.forEach((fn) => fn(people));
  }

  // Presence events
  channel.on("presence", { event: "sync" }, () => {
    console.log("[Realtime] presence SYNC on", CHANNEL_NAME, channel.presenceState());
    emitPresence();
  });
  channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
    console.log("[Realtime] presence JOIN", key, newPresences);
  });
  channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
    console.log("[Realtime] presence LEAVE", key, leftPresences);
  });

  // Broadcast handlers
  for (const ev of ["chat", "ai", "start", "state", "try", "dbg"]) {
    channel.on("broadcast", { event: ev }, (packet) => {
      if (ev === "dbg") console.log("[Realtime] (dbg)", packet.payload);
      (listeners[ev] || []).forEach((fn) => fn(packet.payload));
    });
  }

  // ----- Subscribe canonically, then TRACK PRESENCE -----
  const status = await channel.subscribe();
  console.log("[Realtime] subscribe() =>", status, "on", CHANNEL_NAME);

  if (status === "SUBSCRIBED") {
    try {
      const res = await channel.track({
        id: user.id,
        name: user.name,
        color: user.color || randomColor(),
        ts: user.ts || Date.now(),
      });
      console.log("[Realtime] track() =>", res);
      emitPresence();
    } catch (err) {
      console.error("[Realtime] track() failed:", err);
    }
  } else {
    console.error("[Realtime] Not SUBSCRIBED; presence will not work.");
  }

  function on(type, fn) {
    (listeners[type] = listeners[type] || []).push(fn);
  }
  function send(type, payload) {
    channel.send({ type: "broadcast", event: type, payload });
  }

  return { channel, presence, on, send };
}
