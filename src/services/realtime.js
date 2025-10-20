import { createClient } from "@supabase/supabase-js";

// Public keys (safe for client) – set in Vercel as VITE_* and redeploy
const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  console.error(
    "[Realtime] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in Vercel and redeploy."
  );
}

export const supabase = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
});

export function makeId(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[(Math.random() * chars.length) | 0]).join("");
}

const COLORS = ["#9ef", "#ffb4a2", "#ffd166", "#b9fbc0", "#bdb2ff", "#f1c0e8", "#90dbf4", "#f4a261", "#e9ff70", "#a0c4ff", "#caffbf", "#ffc6ff"];
export function randomColor() {
  return COLORS[(Math.random() * COLORS.length) | 0];
}

/**
 * Join a realtime room.
 * Returns: { channel, presence, on, send }
 */
export async function joinRoom(roomId, user) {
  // Normalize defensively so everyone ends up in the exact same topic
  const norm = String(roomId || "")
    .replace(/^#/, "")
    .trim()
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 16);

  const channelName = `room:${norm}`;
  const channel = supabase.channel(channelName, {
    config: { presence: { key: user.id }, broadcast: { ack: true } },
  });

  // ---- tiny debug surface (handy in DevTools) ----
  if (typeof window !== "undefined") {
    window.__rt = window.__rt || {};
    window.__rt.supabaseUrl = URL;
    window.__rt.roomId = norm;
    window.__rt.channelName = channelName;
    window.__rt.channels = () => supabase.getChannels?.() || [];
    window.__rt.presence = () => channel.presenceState();
    window.__rt.send = (event, payload) => channel.send({ type: "broadcast", event, payload });
    console.log("[Realtime] Using Supabase URL:", URL);
    console.log("[Realtime] Subscribing channel:", channelName);
  }

  const presence = { me: user, list: [] };
  const listeners = { chat: [], ai: [], start: [], state: [], lobby: [], try: [], dbg: [] };

  // Convert presence map → unique list (first meta per presence key)
  function emitPresence() {
    const state = channel.presenceState(); // { key: [{...meta}, {...}] }
    const people = Object.values(state).map((arr) => arr[0]);
    presence.list = people;
    listeners.lobby.forEach((fn) => fn(people));
    // Force broadcast to ensure all clients sync
    channel.send({ type: "broadcast", event: "lobby", payload: people });
  }

  // Presence sync from Supabase
  channel.on("presence", { event: "sync" }, () => {
    console.log("[Realtime] presence sync on", channelName);
    emitPresence();
  });

  // Broadcast handlers
  channel.on("broadcast", { event: "chat" }, (p) => listeners.chat.forEach((fn) => fn(p.payload)));
  channel.on("broadcast", { event: "ai" }, (p) => listeners.ai.forEach((fn) => fn(p.payload)));
  channel.on("broadcast", { event: "start" }, (p) => listeners.start.forEach((fn) => fn(p.payload)));
  channel.on("broadcast", { event: "state" }, (p) => listeners.state.forEach((fn) => fn(p.payload)));
  channel.on("broadcast", { event: "try" }, (p) => listeners.try.forEach((fn) => fn(p.payload)));
  channel.on("broadcast", { event: "dbg" }, (p) => {
    console.log("[Realtime] (dbg) payload:", p.payload);
    listeners.dbg.forEach((fn) => fn(p.payload));
  });

  // Subscribe then TRACK PRESENCE (critical)
  await channel.subscribe(async (status) => {
    console.log("[Realtime] Status:", status, "channel:", channelName);
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
        // Immediate sync after tracking
        emitPresence();
      } catch (err) {
        console.error("[Realtime] track() failed:", err);
      }
    }
  });

  function on(type, fn) {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(fn);
  }
  function send(type, payload) {
    channel.send({ type: "broadcast", event: type, payload });
  }

  return { channel, presence, on, send };
}