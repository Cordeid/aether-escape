import { createClient } from "@supabase/supabase-js";

// Public keys (safe for client) – set in Vercel as VITE_*
const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function makeId(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const COLORS = ["#9ef", "#ffb4a2", "#ffd166", "#b9fbc0", "#bdb2ff", "#f1c0e8", "#90dbf4", "#f4a261", "#e9ff70", "#a0c4ff", "#caffbf", "#ffc6ff"];

export function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

/**
 * Join a realtime room.
 * Returns: { channel, presence, on, send }
 */
export async function joinRoom(roomId, user) {
  const channel = supabase.channel(`room:${roomId}`, {
    config: { presence: { key: user.id } },
  });

  const presence = { me: user, list: [] };
  const listeners = { chat: [], ai: [], start: [], state: [], lobby: [] };

  // Presence sync
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    const people = Object.values(state).flat().map((x) => x);
    presence.list = people;
    listeners.lobby.forEach((fn) => fn(people));
  });

  // Broadcast handlers
  channel.on("broadcast", { event: "chat" }, (p) => listeners.chat.forEach((fn) => fn(p.payload)));
  channel.on("broadcast", { event: "ai" }, (p) => listeners.ai.forEach((fn) => fn(p.payload)));
  channel.on("broadcast", { event: "start" }, (p) => listeners.start.forEach((fn) => fn(p.payload)));
  channel.on("broadcast", { event: "state" }, (p) => listeners.state.forEach((fn) => fn(p.payload)));

channel.subscribe(async (status) => {
  console.log("[Realtime] Status:", status, "channel:", channelName);
  if (status === "SUBSCRIBED") {
    console.log("[Realtime] Tracking presence for", user);
    const res = await channel.track({
      id: user.id,
      name: user.name,
      color: user.color || "#8f8",
      ts: Date.now(),
    });
    console.log("[Realtime] Presence track result:", res);
  }
});


  function on(type, fn) {
    listeners[type]?.push(fn);
  }

  function send(type, payload) {
    channel.send({ type: "broadcast", event: type, payload });
  }

  return { channel, presence, on, send };
}
