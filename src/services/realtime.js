// src/services/realtime.js
import { createClient } from "@supabase/supabase-js";

/* ---------- ENV (frontend-safe) ---------- */
const URL  = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!URL || !ANON) console.error("[Realtime] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");

export const supabase = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
});

/* ---------- small utils ---------- */
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
let channel = null;         // the one and only channel per tab
let tracked = false;        // ensure track() only once
const listeners = {
  lobby: new Set(),
  chat:  new Set(),
  ai:    new Set(),
  start: new Set(),
  state: new Set(),
  try:   new Set(),
  dbg:   new Set(),
};

// Presence cache with guards
let lastPresenceList = [];
let lastPresenceAt   = 0;            // ms since epoch
const EMPTY_SNAPSHOT_GRACE_MS = 2500; // ignore empties that arrive within this window

function computePresenceList() {
  if (!channel?.presenceState) return [];
  const state = channel.presenceState();        // { key: [meta, ...], ... }
  const people = Object.values(state).map(arr => arr[0] || null).filter(Boolean);
  return people;
}

function emitPresenceToAll(applyGuard = true) {
  const now = Date.now();
  const current = computePresenceList();

  // Guard: ignore transient empty snapshots that happen during reconnects/sync races
  if (applyGuard && current.length === 0 && lastPresenceList.length > 0) {
    const age = now - lastPresenceAt;
    if (age < EMPTY_SNAPSHOT_GRACE_MS) {
      // don't broadcast empty; keep the last stable list
      for (const fn of listeners.lobby) fn([...lastPresenceList]);
      return;
    }
  }

  lastPresenceList = current;
  lastPresenceAt = now;
  for (const fn of listeners.lobby) fn([...lastPresenceList]);
}

async function ensureChannel(user) {
  if (channel) return channel;

  // Make sure there isn't a stale channel from earlier code
  for (const c of supabase.getChannels?.() || []) {
    if ((c.topic || c.params?.channel) === CHANNEL_NAME) {
      try { await c.unsubscribe(); } catch {}
    }
  }

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
    window.__rt.send         = (event, payload) => channel.send({ type: "broadcast", event, payload });
    console.log("[Realtime] Singleton channel:", CHANNEL_NAME, "presence key:", user.id);
  }

  // Presence hooks
  channel.on("presence", { event: "sync"  }, () => emitPresenceToAll(true));
  channel.on("presence", { event: "join"  }, () => emitPresenceToAll(false)); // joins are reliable → no guard
  channel.on("presence", { event: "leave" }, () => emitPresenceToAll(true));

  // Broadcast hooks
  for (const ev of ["chat","ai","start","state","try","dbg"]) {
    channel.on("broadcast", { event: ev }, pkt => {
      if (ev === "dbg") console.log("[Realtime] (dbg)", pkt.payload);
      for (const fn of (listeners[ev] || [])) fn(pkt.payload);
    });
  }

  // Subscribe with callback, then track ONCE
  await channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED" && !tracked) {
      tracked = true;
      try {
        await channel.track({
          id: user.id,
          name: user.name,
          color: user.color || randomColor(),
          ts: user.ts || Date.now(),
        });
        // Prime presence immediately so UI never sits at 0
        emitPresenceToAll(false);
      } catch (err) {
        console.error("[Realtime] track() failed:", err);
      }
    }
  });

  return channel;
}

/** Public API */
export async function joinRoom(_ignored, user) {
  await ensureChannel(user);

  function on(type, fn) {
    if (!listeners[type]) listeners[type] = new Set();
    listeners[type].add(fn);

    // if they subscribe to lobby right away, send the cached snapshot
    if (type === "lobby" && lastPresenceList.length) {
      try { fn([...lastPresenceList]); } catch {}
    }

    // return disposer
    return () => listeners[type]?.delete(fn);
  }

  function send(type, payload) {
    return channel.send({ type: "broadcast", event: type, payload });
  }

  return { channel, on, send, presence: { list: [...lastPresenceList], me: user } };
}
