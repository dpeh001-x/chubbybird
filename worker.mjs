const leaderboardLimit = 20;
const storedScoreLimit = 100;

const jsonHeaders = {
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

export class WeeklyLeaderboard {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (request.method === "OPTIONS") return json({ ok: true });
    if (request.method === "GET") return this.getScores();
    if (request.method === "POST") return this.submitScore(request);
    return json({ error: "Method not allowed" }, 405, { Allow: "GET, POST, OPTIONS" });
  }

  async getScores() {
    const week = getIsoWeekId();
    const entries = await this.readEntries(week);
    return json({
      week,
      entries: entries.slice(0, leaderboardLimit).map(publicEntry),
    });
  }

  async submitScore(request) {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Expected JSON body" }, 400);
    }

    const score = Math.floor(Number(payload.score));
    if (!Number.isFinite(score) || score <= 0 || score > 999999) {
      return json({ error: "Score out of range" }, 400);
    }

    const playerId = sanitizePlayerId(payload.playerId);
    const name = sanitizeName(payload.name);
    const week = getIsoWeekId();
    const now = new Date().toISOString();
    let accepted = false;
    let entries = await this.readEntries(week);
    const existing = entries.find((entry) => entry.playerId === playerId);

    if (existing) {
      existing.name = name;
      if (score > existing.score) {
        existing.score = score;
        existing.updatedAt = now;
        accepted = true;
      }
    } else {
      entries.push({ playerId, name, score, updatedAt: now });
      accepted = true;
    }

    entries.sort((a, b) => b.score - a.score || a.updatedAt.localeCompare(b.updatedAt));
    entries = entries.slice(0, storedScoreLimit);
    await this.ctx.storage.put(scoreKey(week), entries);

    const rank = entries.findIndex((entry) => entry.playerId === playerId) + 1;
    return json({
      accepted,
      rank,
      week,
      entries: entries.slice(0, leaderboardLimit).map(publicEntry),
    });
  }

  async readEntries(week) {
    const entries = await this.ctx.storage.get(scoreKey(week));
    return Array.isArray(entries) ? entries : [];
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (isLeaderboardPath(url.pathname)) {
      if (!env.LEADERBOARD) return json({ error: "Leaderboard binding missing" }, 503);
      const id = env.LEADERBOARD.idFromName("weekly-global");
      return env.LEADERBOARD.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

function isLeaderboardPath(pathname) {
  return pathname === "/api/leaderboard" || pathname.endsWith("/api/leaderboard");
}

function scoreKey(week) {
  return `scores:${week}`;
}

function getIsoWeekId(date = new Date()) {
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((current - yearStart) / 86400000 + 1) / 7);
  return `${current.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function sanitizeName(name) {
  const cleaned = String(name || "")
    .replace(/[^a-z0-9 ._-]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12);
  return cleaned || "Chubby";
}

function sanitizePlayerId(playerId) {
  const cleaned = String(playerId || "")
    .replace(/[^a-z0-9-]/gi, "")
    .slice(0, 64);
  return cleaned.length >= 8 ? cleaned : `guest-${crypto.randomUUID()}`;
}

function publicEntry(entry) {
  return {
    name: sanitizeName(entry.name),
    score: Math.max(0, Math.floor(Number(entry.score) || 0)),
    updatedAt: String(entry.updatedAt || ""),
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...jsonHeaders,
      ...headers,
    },
  });
}
