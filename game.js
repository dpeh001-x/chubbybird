const canvas = document.querySelector("#game");
const shell = document.querySelector(".game-shell");
const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true }) || canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const paceEl = document.querySelector("#pace");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");
const leaderboardList = document.querySelector("#leaderboardList");
const leaderboardStatus = document.querySelector("#leaderboardStatus");
const refreshLeaderboardButton = document.querySelector("#refreshLeaderboard");
const scoreSubmitForm = document.querySelector("#scoreSubmitForm");
const playerNameInput = document.querySelector("#playerName");
const scoreSubmitButton = document.querySelector("#scoreSubmitButton");
const scoreSubmitValue = document.querySelector("#scoreSubmitValue");
const queryParams = new URLSearchParams(window.location.search);
const auditMode = queryParams.has("audit");
const auditAutoplay = auditMode && queryParams.has("autoplay");

const coarsePointerQuery =
  typeof window.matchMedia === "function" ? window.matchMedia("(pointer: coarse)") : null;
const isMobileDevice =
  Boolean(coarsePointerQuery && coarsePointerQuery.matches) ||
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const DPR_LIMIT = isMobileDevice ? 1 : 1.5;
const MAX_PARTICLES = isMobileDevice ? 18 : 80;
const MAX_DASH_EFFECTS = isMobileDevice ? 14 : 72;
const PHYSICS_STEP = 1 / 60;
const MAX_FRAME_DELTA = isMobileDevice ? 0.036 : 0.04;
const TRAIL_CHANCE = isMobileDevice ? 0.05 : 0.32;
const BASE_SPEED = 430;
const PACE_CYCLE_SECONDS = 8;
const HITBOX_RADIUS = 18;
const MOBILE_ACTION_FRAME_HEIGHT = 144;
const MOBILE_ACTION_SHEET_CELL_WIDTH = 154;
const MOBILE_ACTION_SHEET_CELL_HEIGHT = 144;
const GATE_MIN_GAP = 152;
const GATE_START_GAP = 236;
const GATE_SCORE_TIGHTEN = 2.25;
const EARLY_WIDE_GAP_SCORE_LIMIT = 10;
const EARLY_WIDE_GAP_BONUS = 46;
const FLAP_LIFT = 355;
const SUPER_JUMP_LIFT = 560;
const GRAVITY_BASE = 1160;
const GRAVITY_SPEED_SCALE = 0.22;
const bestKey = "rushwing-best";
const playerNameKey = "chubbybird-player-name";
const playerIdKey = "chubbybird-player-id";
const localLeaderboardKeyPrefix = "chubbybird-weekly-scores:";
const leaderboardLimit = 20;
const BACKGROUND_VIDEO_RATE = isMobileDevice ? 0.45 : 0.72;
const BGM_VOLUME = isMobileDevice ? 0.24 : 0.28;
const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
const USE_VIDEO_BACKGROUND = !isMobileDevice;
const IDLE_RENDER_INTERVAL = isMobileDevice ? 1 / 24 : 1 / 45;
const requestIdle =
  typeof window.requestIdleCallback === "function"
    ? (callback) => window.requestIdleCallback(callback, { timeout: 1200 })
    : (callback) => window.setTimeout(callback, 32);
shell.classList.toggle("mobile-optimized", isMobileDevice);
shell.classList.toggle("mobile-generated-background", !USE_VIDEO_BACKGROUND);
const backgroundVideo = document.createElement("video");
if (USE_VIDEO_BACKGROUND) {
  backgroundVideo.src = "assets/animated-background.mp4?v=retro-bg-1";
}
backgroundVideo.className = "background-video";
backgroundVideo.muted = true;
backgroundVideo.defaultMuted = true;
backgroundVideo.loop = true;
backgroundVideo.autoplay = USE_VIDEO_BACKGROUND;
backgroundVideo.playsInline = true;
backgroundVideo.preload = USE_VIDEO_BACKGROUND ? "metadata" : "none";
backgroundVideo.playbackRate = BACKGROUND_VIDEO_RATE;
backgroundVideo.disablePictureInPicture = true;
backgroundVideo.setAttribute("muted", "");
backgroundVideo.setAttribute("playsinline", "");
backgroundVideo.setAttribute("webkit-playsinline", "");
backgroundVideo.setAttribute("x5-playsinline", "");
backgroundVideo.setAttribute("x5-video-player-type", "h5");
backgroundVideo.addEventListener("loadedmetadata", () => {
  backgroundVideo.playbackRate = BACKGROUND_VIDEO_RATE;
});
backgroundVideo.addEventListener("canplay", markBackgroundVideoReady);
backgroundVideo.addEventListener("playing", markBackgroundVideoReady);
backgroundVideo.addEventListener("error", markBackgroundVideoFallback);
shell.prepend(backgroundVideo);
let backgroundFallbackTimer = null;
const bgmAudio = document.createElement("audio");
bgmAudio.src = "assets/main-bgm.mpeg?v=bgm-1";
bgmAudio.loop = true;
bgmAudio.preload = isMobileDevice ? "none" : "metadata";
bgmAudio.volume = BGM_VOLUME;
bgmAudio.setAttribute("playsinline", "");
const audio = {
  ctx: null,
  master: null,
  unlocked: false,
};
const audit = {
  startedAt: 0,
  lastLogAt: 0,
  frames: 0,
  drawnFrames: 0,
  runningFrames: 0,
  longFrames: 0,
  maxFrameMs: 0,
};
const leaderboardState = {
  entries: [],
  week: getIsoWeekId(),
  latestScore: 0,
  online: false,
  loading: false,
};
const floorArt = {
  topTile: document.createElement("canvas"),
  bodyTile: document.createElement("canvas"),
  dpr: 0,
  topWidth: 168,
  bodyWidth: 222,
  topHeight: 42,
  bodyHeight: 48,
};
const characterImage = new Image();
characterImage.decoding = "async";
if (!isMobileDevice) {
  characterImage.src = "assets/chubby-bird-sprites.png";
}
const characterStillImage = new Image();
characterStillImage.decoding = "async";
if (!isMobileDevice) {
  characterStillImage.src = "assets/chubby-bird.png?v=hd-character-1";
}
const characterMobileActionSheet = new Image();
characterMobileActionSheet.decoding = "async";
if (isMobileDevice) {
  characterMobileActionSheet.src = "assets/chubby-bird-action-mobile.png?v=mobile-action-sheet-1";
}
const characterActionFrames = isMobileDevice
  ? []
  : Array.from({ length: 16 }, (_, index) => {
      const image = new Image();
      image.decoding = "async";
      image.src = `assets/chubby-bird-action/frame_${String(index).padStart(3, "0")}.png?v=action-sprite-1`;
      image.addEventListener("load", queueActionFrameWarmup, { once: true });
      if (typeof image.decode === "function") {
        image.decode().then(queueActionFrameWarmup).catch(() => {});
      }
      return image;
    });
const characterAnimations = {
  idle: [9, 10, 11, 10, 8, 10],
  flap: [2, 3, 4, 5, 6, 7, 8],
  dash: [12, 13, 14, 15, 0, 1, 2],
  super: [3, 4, 5, 6, 7, 8],
};
const optimizedActionFrames = new WeakMap();
const characterSprite = {
  frameCount: 125,
  cellWidth: 111,
  cellHeight: 77,
  frameMs: 38,
};

const state = {
  width: 0,
  height: 0,
  dpr: 0,
  running: false,
  crashed: false,
  lastTime: 0,
  idleDrawTimer: 0,
  needsDraw: true,
  score: 0,
  best: loadBestScore(),
  speed: BASE_SPEED,
  paceStartedAt: 0,
  hudTimer: 0,
  dash: 0,
  dashBoost: 0,
  spawnTimer: 0,
  shake: 0,
  pointerStart: null,
  activePointerId: null,
  activeTouchId: null,
  lastRightTap: 0,
  auditFlapCooldown: 0,
  auditDashTimer: 0,
  particles: [],
  dashEffects: [],
  gates: [],
  clouds: [],
  stars: [],
  ridges: [],
  performanceStress: 0,
  performanceSaver: false,
  bird: {
    x: 0,
    y: 0,
    radius: 23,
    vy: 0,
    angle: 0,
    wing: 0,
    invuln: 0,
    animName: "idle",
    animStartedAt: 0,
    animUntil: 0,
  },
};

bestEl.textContent = state.best;

function loadBestScore() {
  try {
    return Number(localStorage.getItem(bestKey) || 0);
  } catch {
    return 0;
  }
}

function saveBestScore(score) {
  try {
    localStorage.setItem(bestKey, score);
  } catch {
    // Some mobile private-browsing modes block storage; the run should still continue.
  }
}

function getStoredValue(key, fallback = "") {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function setStoredValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private mobile tabs.
  }
}

function getIsoWeekId(date = new Date()) {
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((current - yearStart) / 86400000 + 1) / 7);
  return `${current.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getPlayerId() {
  const stored = getStoredValue(playerIdKey);
  if (stored) return stored;
  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  setStoredValue(playerIdKey, generated);
  return generated;
}

function sanitizePlayerName(name) {
  const cleaned = String(name || "")
    .replace(/[^a-z0-9 ._-]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12);
  return cleaned || "Chubby";
}

function getLeaderboardApiUrl() {
  if (window.location.protocol === "file:") return "";
  if (window.location.hostname.endsWith("github.io")) {
    return "https://moji-studios.com/chubbybird/api/leaderboard";
  }
  return new URL("api/leaderboard", window.location.href).toString();
}

function getLocalLeaderboardKey() {
  return `${localLeaderboardKeyPrefix}${getIsoWeekId()}`;
}

function loadLocalLeaderboard() {
  try {
    const stored = JSON.parse(localStorage.getItem(getLocalLeaderboardKey()) || "[]");
    return Array.isArray(stored) ? stored.slice(0, leaderboardLimit) : [];
  } catch {
    return [];
  }
}

function saveLocalLeaderboardScore(name, score) {
  const entry = {
    name: sanitizePlayerName(name),
    score: Math.max(0, Math.floor(Number(score) || 0)),
    updatedAt: new Date().toISOString(),
  };
  if (!entry.score) return loadLocalLeaderboard();

  const entries = loadLocalLeaderboard().filter((item) => item.name !== entry.name);
  entries.push(entry);
  entries.sort((a, b) => b.score - a.score || a.updatedAt.localeCompare(b.updatedAt));
  const trimmed = entries.slice(0, leaderboardLimit);
  try {
    localStorage.setItem(getLocalLeaderboardKey(), JSON.stringify(trimmed));
  } catch {
    // Best-effort fallback for local play.
  }
  return trimmed;
}

function renderLeaderboard(entries, week = leaderboardState.week) {
  if (!leaderboardList) return;
  leaderboardList.replaceChildren();
  const visibleEntries = Array.isArray(entries) ? entries.slice(0, leaderboardLimit) : [];
  if (!visibleEntries.length) {
    const item = document.createElement("li");
    item.className = "empty-score";
    item.textContent = "No scores yet this week";
    leaderboardList.appendChild(item);
    return;
  }

  visibleEntries.forEach((entry, index) => {
    const item = document.createElement("li");
    const rank = document.createElement("span");
    const name = document.createElement("span");
    const score = document.createElement("span");
    rank.className = "score-rank";
    name.className = "score-name";
    score.className = "score-value";
    rank.textContent = `${index + 1}.`;
    name.textContent = sanitizePlayerName(entry.name);
    score.textContent = Math.max(0, Math.floor(Number(entry.score) || 0)).toString();
    item.append(rank, name, score);
    leaderboardList.appendChild(item);
  });
  leaderboardState.week = week || leaderboardState.week;
}

function setLeaderboardStatus(message) {
  if (leaderboardStatus) leaderboardStatus.textContent = message;
}

function useLocalLeaderboardStatus(message = "Local scores on this device") {
  leaderboardState.online = false;
  leaderboardState.entries = loadLocalLeaderboard();
  renderLeaderboard(leaderboardState.entries, getIsoWeekId());
  setLeaderboardStatus(message);
}

async function loadLeaderboard(options = {}) {
  if (!leaderboardList || leaderboardState.loading) return;
  const url = getLeaderboardApiUrl();
  if (!url) {
    useLocalLeaderboardStatus("Local scores on this device");
    return;
  }

  leaderboardState.loading = true;
  if (!options.silent) setLeaderboardStatus("Loading weekly scores...");
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Leaderboard ${response.status}`);
    const data = await response.json();
    const entries = Array.isArray(data.entries) ? data.entries : [];
    leaderboardState.online = true;
    leaderboardState.entries = entries.slice(0, leaderboardLimit);
    renderLeaderboard(leaderboardState.entries, data.week || getIsoWeekId());
    setLeaderboardStatus(entries.length ? `Online week ${data.week || getIsoWeekId()}` : "Be first this week");
  } catch {
    useLocalLeaderboardStatus("Online board is waiting for deploy");
  } finally {
    leaderboardState.loading = false;
  }
}

function showScoreSubmit(score) {
  if (!scoreSubmitForm || !scoreSubmitValue) return;
  const cleanScore = Math.max(0, Math.floor(Number(score) || 0));
  leaderboardState.latestScore = cleanScore;
  scoreSubmitValue.textContent = cleanScore.toString();
  scoreSubmitForm.classList.toggle("hidden", cleanScore <= 0);
  if (cleanScore > 0) setLeaderboardStatus("Save this run to the weekly board");
}

function hideScoreSubmit() {
  if (scoreSubmitForm) scoreSubmitForm.classList.add("hidden");
}

async function submitLeaderboardScore(event) {
  event.preventDefault();
  const score = leaderboardState.latestScore;
  const name = sanitizePlayerName(playerNameInput ? playerNameInput.value : "");
  if (!score) return;
  setStoredValue(playerNameKey, name);

  const url = getLeaderboardApiUrl();
  if (scoreSubmitButton) scoreSubmitButton.disabled = true;
  try {
    if (!url) {
      leaderboardState.entries = saveLocalLeaderboardScore(name, score);
      renderLeaderboard(leaderboardState.entries, getIsoWeekId());
      setLeaderboardStatus("Saved on this device");
      return;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        playerId: getPlayerId(),
        score,
      }),
    });
    if (!response.ok) throw new Error(`Leaderboard ${response.status}`);
    const data = await response.json();
    leaderboardState.online = true;
    leaderboardState.entries = Array.isArray(data.entries) ? data.entries.slice(0, leaderboardLimit) : [];
    renderLeaderboard(leaderboardState.entries, data.week || getIsoWeekId());
    setLeaderboardStatus(data.accepted ? "Score saved online" : "Your weekly best is already higher");
  } catch {
    leaderboardState.entries = saveLocalLeaderboardScore(name, score);
    renderLeaderboard(leaderboardState.entries, getIsoWeekId());
    setLeaderboardStatus("Saved locally; online board is waiting");
  } finally {
    if (scoreSubmitButton) scoreSubmitButton.disabled = false;
  }
}

function setupLeaderboard() {
  if (playerNameInput) {
    playerNameInput.value = sanitizePlayerName(getStoredValue(playerNameKey, "Chubby"));
  }
  if (scoreSubmitForm) scoreSubmitForm.addEventListener("submit", submitLeaderboardScore);
  if (refreshLeaderboardButton) {
    refreshLeaderboardButton.addEventListener("click", () => loadLeaderboard({ silent: false }));
  }
}

function getViewportSize() {
  const layoutWidth = window.innerWidth || document.documentElement.clientWidth || 320;
  const layoutHeight = window.innerHeight || document.documentElement.clientHeight || 480;
  if (!isMobileDevice) {
    return {
      width: Math.max(320, Math.round(layoutWidth)),
      height: Math.max(320, Math.round(layoutHeight)),
    };
  }

  const visualViewport = window.visualViewport;
  const width = Math.round(
    (visualViewport && visualViewport.width) || layoutWidth
  );
  const height = Math.round(
    (visualViewport && visualViewport.height) || layoutHeight
  );
  return {
    width: Math.max(320, width),
    height: Math.max(320, height),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isImageReady(image) {
  return Boolean(image && image.complete && image.naturalWidth > 0);
}

function getDrawableWidth(drawable) {
  return drawable.naturalWidth || drawable.width || 0;
}

function getDrawableHeight(drawable) {
  return drawable.naturalHeight || drawable.height || 0;
}

let actionFrameWarmQueued = false;

function queueActionFrameWarmup() {
  if (!isMobileDevice || actionFrameWarmQueued) return;
  actionFrameWarmQueued = true;
  requestIdle(() => {
    actionFrameWarmQueued = false;
    for (const image of characterActionFrames) {
      if (isImageReady(image)) getOptimizedActionFrame(image);
    }
  });
}

function getOptimizedActionFrame(image) {
  if (!isMobileDevice || !isImageReady(image)) return image;
  const cached = optimizedActionFrames.get(image);
  if (cached) return cached;

  const ratio = image.naturalWidth / image.naturalHeight;
  const canvasFrame = document.createElement("canvas");
  canvasFrame.height = MOBILE_ACTION_FRAME_HEIGHT;
  canvasFrame.width = Math.ceil(MOBILE_ACTION_FRAME_HEIGHT * ratio);
  const frameCtx = canvasFrame.getContext("2d", { alpha: true });
  if (!frameCtx) return image;
  frameCtx.imageSmoothingEnabled = true;
  frameCtx.imageSmoothingQuality = "medium";
  frameCtx.clearRect(0, 0, canvasFrame.width, canvasFrame.height);
  frameCtx.drawImage(image, 0, 0, canvasFrame.width, canvasFrame.height);
  optimizedActionFrames.set(image, canvasFrame);
  return canvasFrame;
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
  const viewport = getViewportSize();
  if (state.width === viewport.width && state.height === viewport.height && state.dpr === dpr) {
    return;
  }
  state.width = viewport.width;
  state.height = viewport.height;
  state.dpr = dpr;
  state.needsDraw = true;
  document.documentElement.style.setProperty("--app-width", `${state.width}px`);
  document.documentElement.style.setProperty("--app-height", `${state.height}px`);
  canvas.width = Math.floor(state.width * dpr);
  canvas.height = Math.floor(state.height * dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = isMobileDevice ? "medium" : "high";
  state.bird.x = Math.max(92, state.width * 0.2);
  state.bird.y = clamp(state.bird.y || state.height * 0.42, HITBOX_RADIUS + 8, getFloorSurfaceY() - HITBOX_RADIUS - 8);
}

function resetGame() {
  unlockAudio();
  startBgm({ restart: true });
  startBackgroundVideo();
  if (!auditAutoplay) playStartSound();
  shell.classList.add("game-active");
  state.running = true;
  state.crashed = false;
  state.lastTime = performance.now();
  state.idleDrawTimer = 0;
  state.needsDraw = true;
  state.score = 0;
  state.speed = BASE_SPEED;
  state.paceStartedAt = performance.now();
  state.hudTimer = 0;
  state.dash = 0;
  state.dashBoost = 0;
  state.spawnTimer = 0.85;
  state.shake = 0;
  state.lastRightTap = 0;
  state.auditFlapCooldown = 0;
  state.auditDashTimer = 0;
  state.gates = [];
  state.particles = [];
  state.dashEffects = [];
  state.bird.x = Math.max(92, state.width * 0.2);
  state.bird.y = state.height * 0.42;
  state.bird.vy = -220;
  state.bird.angle = 0;
  state.bird.invuln = 0.7;
  overlay.classList.add("hidden");
  hideScoreSubmit();
  updateHud();
}

function updateHud() {
  scoreEl.textContent = state.score;
  bestEl.textContent = state.best;
  paceEl.textContent = `${getPaceMultiplier().toFixed(1)}x`;
}

function getPaceMultiplier() {
  if (!state.running) return 1;
  const elapsed = Math.max(0, (performance.now() - state.paceStartedAt) / 1000);
  const phase = (elapsed % PACE_CYCLE_SECONDS) / PACE_CYCLE_SECONDS;
  const triangle = 1 - Math.abs(phase * 2 - 1);
  return 1 + triangle * 0.5;
}

function getPaceSpeed() {
  return BASE_SPEED * getPaceMultiplier() + state.dashBoost;
}

function getGateGap() {
  const normalGap = Math.max(GATE_MIN_GAP, GATE_START_GAP - state.score * GATE_SCORE_TIGHTEN);
  if (state.score >= EARLY_WIDE_GAP_SCORE_LIMIT) return normalGap;
  const earlyEase = 1 - state.score / EARLY_WIDE_GAP_SCORE_LIMIT;
  return normalGap + EARLY_WIDE_GAP_BONUS * earlyEase;
}

function spawnGate() {
  const margin = Math.max(86, state.height * 0.14);
  const gap = getGateGap();
  const center = margin + Math.random() * (state.height - margin * 2);
  const width = 72;
  const gate = {
    x: state.width + width,
    w: width,
    gapTop: Math.max(74, center - gap * 0.5),
    gapBottom: Math.min(state.height - 56, center + gap * 0.5),
    scored: false,
    pulse: Math.random() * Math.PI,
  };
  state.gates.push(gate);
}

function flap(power = 1, horizontal = 0) {
  const bird = state.bird;
  bird.vy = Math.min(bird.vy, 0) - FLAP_LIFT * power;
  bird.y -= 6 * power;
  bird.invuln = Math.max(bird.invuln, 0.12);
  state.dashBoost = Math.max(state.dashBoost, horizontal * 24);
  triggerCharacterAnimation("flap", 380);
  burst(bird.x - 8, bird.y + 12, 9 + power * 5, "#f7e85f");
  playFlapSound(power);
}

function superJump(strength = 1) {
  const bird = state.bird;
  const lift = SUPER_JUMP_LIFT * (0.92 + Math.min(1, strength) * 0.28);
  bird.vy = Math.min(bird.vy, -120) - lift;
  bird.y -= 12;
  bird.invuln = Math.max(bird.invuln, 0.2);
  state.shake = Math.max(state.shake, 9);
  state.dashBoost = Math.max(state.dashBoost, 110);
  triggerCharacterAnimation("super", 520);
  burst(bird.x - 4, bird.y + 18, isMobileDevice ? 22 : 34, "#fff0a8");
  burst(bird.x - 20, bird.y + 28, isMobileDevice ? 14 : 22, "#8ed6ad");
  playDashSound(0.55);
}

function dashForward(distance) {
  const bird = state.bird;
  const strength = Math.min(1, distance / 210);
  state.dashBoost = Math.max(state.dashBoost, 240 + strength * 300);
  state.dash = Math.min(1, state.dash + 0.9 + strength * 0.55);
  state.shake = Math.max(state.shake, 7 + strength * 8);
  bird.vy = Math.min(bird.vy, -130) - 90 * strength;
  triggerCharacterAnimation("dash", 520);
  spawnDashEffects(bird.x - 6, bird.y, strength);
  burst(bird.x - 24, bird.y, 26 + strength * 18, "#8ed6ad");
  burst(bird.x - 38, bird.y + 10, 22, "#d7aa43");
  playDashSound(strength);
}

function triggerCharacterAnimation(name, durationMs) {
  const bird = state.bird;
  const now = performance.now();
  bird.animName = name;
  bird.animStartedAt = now;
  bird.animUntil = now + durationMs;
}

function spawnDashEffects(x, y, strength) {
  const comicWords = ["WHOOSH", "ZIP!", "DASH!"];
  const starCount = state.performanceSaver ? 1 : isMobileDevice ? 2 : 3;
  const shardCount = state.performanceSaver ? 2 : isMobileDevice ? 3 : 8;
  state.dashEffects.push({
    type: "ring",
    x,
    y,
    age: 0,
    life: 0.36,
    radius: 26,
    maxRadius: 96 + strength * 46,
    color: "#8ed6ad",
  });
  state.dashEffects.push({
    type: "comicBurst",
    x: x - 8,
    y,
    age: 0,
    life: 0.34,
    radius: 22,
    maxRadius: 112 + strength * 34,
    spikes: isMobileDevice ? 11 : 15,
    rotation: -0.15 + Math.random() * 0.3,
  });
  if (!isMobileDevice && !state.performanceSaver) {
    state.dashEffects.push({
      type: "halftone",
      x: x - 18,
      y: y + 2,
      age: 0,
      life: 0.32,
      radius: 112 + strength * 46,
    });
  }
  state.dashEffects.push({
    type: "comicText",
    text: comicWords[Math.floor(Math.random() * comicWords.length)],
    x: x + 28,
    y: y - 46,
    vx: -390 - strength * 160,
    vy: -30 - strength * 20,
    age: 0,
    life: isMobileDevice ? 0.3 : 0.42,
    size: isMobileDevice ? 18 + strength * 4 : 24 + strength * 8,
    rotation: -0.12 + Math.random() * 0.08,
  });

  for (let i = 0; i < starCount; i += 1) {
    state.dashEffects.push({
      type: "impactStar",
      x: x - 18 - Math.random() * 42,
      y: y - 30 + Math.random() * 60,
      vx: -220 - Math.random() * 260,
      vy: -80 + Math.random() * 160,
      age: 0,
      life: 0.26 + Math.random() * 0.16,
      size: 10 + Math.random() * 10 + strength * 4,
      rotation: Math.random() * Math.PI,
      color: i % 2 ? "#fff0a8" : "#d7aa43",
    });
  }

  for (let i = 0; i < shardCount; i += 1) {
    const angle = -0.5 + Math.random() * 1;
    state.dashEffects.push({
      type: "shard",
      x: x - 12,
      y,
      vx: -300 - Math.random() * 360,
      vy: Math.sin(angle) * 260,
      age: 0,
      life: 0.3 + Math.random() * 0.18,
      size: 8 + Math.random() * 10,
      color: i % 3 === 0 ? "#d7aa43" : "#8ed6ad",
    });
  }
}

function burst(x, y, count, color) {
  const available = Math.max(0, MAX_PARTICLES - state.particles.length);
  const effectScale = state.performanceSaver ? 0.28 : isMobileDevice ? 0.42 : 0.72;
  const amount = Math.min(Math.ceil(count * effectScale), available);
  for (let i = 0; i < amount; i += 1) {
    state.particles.push({
      x,
      y,
      vx: -80 - Math.random() * 220,
      vy: -160 + Math.random() * 320,
      life: 0.28 + Math.random() * 0.28,
      size: 2 + Math.random() * 5,
      color,
      glow: Math.random() > 0.45,
    });
  }
}

function startGesture(x, y, flapped = false) {
  state.pointerStart = { x, y, flapped };
}

function endGesture(x, y) {
  if (!state.running) {
    resetGame();
    return;
  }

  const start = state.pointerStart;
  if (!start) {
    flap(1);
    return;
  }

  const dx = x - start.x;
  const dy = y - start.y;
  const distance = Math.hypot(dx, dy);
  const gestureThreshold = isMobileDevice ? 22 : 28;
  if (distance > gestureThreshold) {
    const swipeDistance = isMobileDevice ? 34 : 42;
    const swipeRatio = isMobileDevice ? 1.05 : 1.25;
    const rightSwipe = dx > swipeDistance && Math.abs(dx) > Math.abs(dy) * swipeRatio;
    const upSwipe = dy < -swipeDistance && Math.abs(dy) > Math.abs(dx) * 1.05;
    if (rightSwipe) {
      dashForward(distance);
      state.pointerStart = null;
      return;
    }
    if (upSwipe) {
      superJump(Math.min(1, distance / 220));
      state.pointerStart = null;
      return;
    }
    if (dy < -22) {
      const upward = start.flapped ? 0.42 : 1.22;
      flap(0.36 + Math.min(distance / 260, 0.58) * upward, Math.abs(dx) / 130);
    } else if (!start.flapped) {
      flap(0.88, Math.abs(dx) / 120);
    }
    if (dy > 34) {
      state.bird.vy += 220;
      state.dashBoost = Math.max(state.dashBoost, 70);
      burst(state.bird.x, state.bird.y - 14, 14, "#ff6c51");
    }
  } else if (!start.flapped) {
    flap(1);
  }
  state.pointerStart = null;
}

function crash() {
  if (state.bird.invuln > 0 || state.crashed) return;
  state.crashed = true;
  state.running = false;
  pauseBgm();
  shell.classList.remove("game-active");
  state.needsDraw = true;
  state.shake = 20;
  burst(state.bird.x, state.bird.y, 38, "#ff6c51");
  playCrashSound();
  state.best = Math.max(state.best, state.score);
  saveBestScore(state.best);
  overlay.querySelector("h1").textContent = "Run Over";
  overlay.querySelector("p").textContent =
    `Score ${state.score}. Tap or Space to flap. Swipe up for a super jump. Swipe right or double-tap Right to dash.`;
  startButton.textContent = "Retry";
  overlay.classList.remove("hidden");
  showScoreSubmit(state.score);
  loadLeaderboard({ silent: true });
  updateHud();
}

function recordAuditFrame(now, frameDelta, drew) {
  if (!auditMode) return;
  if (!audit.startedAt) {
    audit.startedAt = now;
    audit.lastLogAt = now;
  }

  const frameMs = frameDelta * 1000;
  audit.frames += 1;
  if (drew) audit.drawnFrames += 1;
  if (state.running) audit.runningFrames += 1;
  if (frameMs > 34) audit.longFrames += 1;
  audit.maxFrameMs = Math.max(audit.maxFrameMs, frameMs);

  if (now - audit.lastLogAt < 10000) return;
  const elapsedSeconds = Math.max(0.001, (now - audit.startedAt) / 1000);
  const current = {
    elapsed: Number(elapsedSeconds.toFixed(1)),
    fps: Number((audit.frames / elapsedSeconds).toFixed(1)),
    drawnFps: Number((audit.drawnFrames / elapsedSeconds).toFixed(1)),
    runningFrames: audit.runningFrames,
    longFrames: audit.longFrames,
    maxFrameMs: Number(audit.maxFrameMs.toFixed(1)),
    particles: state.particles.length,
    dashEffects: state.dashEffects.length,
    gates: state.gates.length,
  };
  console.info(`CHUBBY_AUDIT ${JSON.stringify(current)}`);
  audit.lastLogAt = now;
}

function runAuditAutopilot(dt) {
  if (!auditAutoplay) return;
  const bird = state.bird;
  const nextGate = state.gates.find((gate) => gate.x + gate.w > bird.x - 18);
  const floorY = getFloorSurfaceY();
  const targetY = nextGate
    ? (nextGate.gapTop + nextGate.gapBottom) * 0.5 - 8
    : state.height * 0.42;

  state.auditFlapCooldown = Math.max(0, state.auditFlapCooldown - dt);
  state.auditDashTimer += dt;
  if ((bird.y > targetY + 18 || bird.vy > 430) && state.auditFlapCooldown <= 0) {
    flap(0.82);
    state.auditFlapCooldown = 0.22;
  }
  if (state.auditDashTimer > 3.4) {
    dashForward(230);
    state.auditDashTimer = 0;
  }

  bird.y = clamp(bird.y, HITBOX_RADIUS + 8, floorY - HITBOX_RADIUS - 10);
  if (bird.y <= HITBOX_RADIUS + 10 && bird.vy < 0) bird.vy = 40;
  if (bird.y >= floorY - HITBOX_RADIUS - 12 && bird.vy > 0) bird.vy = -120;
}

function step(now) {
  if (auditAutoplay && !state.running) resetGame();
  const frameDelta = state.lastTime ? Math.max(0, (now - state.lastTime) / 1000 || 0) : 0;
  let dt = Math.min(MAX_FRAME_DELTA, frameDelta);
  state.lastTime = now;
  let drew = false;
  if (state.running) {
    while (dt > 0) {
      const slice = Math.min(PHYSICS_STEP, dt);
      update(slice);
      dt -= slice;
    }
    draw(now);
    drew = true;
  } else {
    state.idleDrawTimer += dt;
    if (state.needsDraw || state.idleDrawTimer >= IDLE_RENDER_INTERVAL) {
      state.idleDrawTimer = 0;
      state.needsDraw = false;
      draw(now);
      drew = true;
    }
  }
  recordAuditFrame(now, frameDelta, drew);
  updatePerformanceMode(frameDelta);
  requestAnimationFrame(step);
}

function updatePerformanceMode(frameDelta) {
  if (!isMobileDevice || !state.running || frameDelta <= 0) return;
  const stressDelta = frameDelta > 0.034 ? 1.8 : -0.32;
  state.performanceStress = clamp(state.performanceStress + stressDelta, 0, 12);
  if (!state.performanceSaver && state.performanceStress >= 6) {
    state.performanceSaver = true;
    shell.classList.add("performance-saver");
    backgroundVideo.pause();
  }
}

function update(dt) {
  const bird = state.bird;
  state.speed = BASE_SPEED;
  state.hudTimer += dt;
  state.dash = Math.max(0, state.dash - dt * 5.2);
  state.dashBoost = Math.max(0, state.dashBoost - dt * (2500 + state.dashBoost * 4.5));
  const paceSpeed = getPaceSpeed();
  state.spawnTimer -= dt;
  state.shake = Math.max(0, state.shake - dt * 50);
  bird.invuln = Math.max(0, bird.invuln - dt);
  bird.vy += (GRAVITY_BASE + paceSpeed * GRAVITY_SPEED_SCALE) * dt;
  bird.y += bird.vy * dt;
  bird.angle = Math.max(-0.75, Math.min(1.15, bird.vy / 620));
  if (state.dash > 0) {
    bird.angle = Math.max(-0.5, bird.angle - state.dash * 0.35);
  }
  bird.wing += dt * (16 + paceSpeed / 80);
  runAuditAutopilot(dt);
  if (state.particles.length < MAX_PARTICLES && Math.random() < TRAIL_CHANCE) {
    state.particles.push({
      x: bird.x - 22,
      y: bird.y + 5 + Math.sin(bird.wing) * 4,
      vx: -180 - Math.random() * 90,
      vy: -20 + Math.random() * 40,
      life: 0.22 + Math.random() * 0.18,
      size: 2 + Math.random() * 3,
      color: Math.random() > 0.5 ? "#87ffe2" : "#f7e85f",
      glow: true,
    });
  }

  if (state.spawnTimer <= 0) {
    spawnGate();
    state.spawnTimer = Math.max(0.78, 1.3 - (getPaceMultiplier() - 1) * 0.28);
  }

  for (const gate of state.gates) {
    const previousX = gate.x;
    gate.x -= paceSpeed * dt;
    gate.pulse += dt * 5;
    if (!gate.scored && gate.x + gate.w < bird.x) {
      gate.scored = true;
      state.score += 1;
      playScoreSound();
      updateHud();
    }
    const sweptLeft = Math.min(previousX, gate.x);
    const sweptRight = Math.max(previousX + gate.w, gate.x + gate.w);
    const withinX = bird.x + HITBOX_RADIUS > sweptLeft && bird.x - HITBOX_RADIUS < sweptRight;
    const outsideGap = bird.y - HITBOX_RADIUS < gate.gapTop || bird.y + HITBOX_RADIUS > gate.gapBottom;
    if (!auditAutoplay && withinX && outsideGap) {
      crash();
    }
  }
  compactArray(state.gates, (gate) => gate.x > -gate.w - 20);

  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 500 * dt;
  }
  compactArray(state.particles, (p) => p.life > 0);

  for (const effect of state.dashEffects) {
    effect.age += dt;
    if (effect.type === "shard") {
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.vy += 480 * dt;
    }
    if (effect.type === "comicText" || effect.type === "impactStar") {
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
    }
  }
  compactArray(state.dashEffects, (effect) => effect.age < effect.life);
  if (state.dashEffects.length > MAX_DASH_EFFECTS) {
    state.dashEffects.splice(0, state.dashEffects.length - MAX_DASH_EFFECTS);
  }

  if (state.hudTimer > 0.12) {
    state.hudTimer = 0;
    updateHud();
  }

  if (auditAutoplay) {
    bird.y = clamp(bird.y, HITBOX_RADIUS + 8, getFloorSurfaceY() - HITBOX_RADIUS - 10);
  } else if (bird.y - HITBOX_RADIUS < 0 || bird.y + HITBOX_RADIUS > getFloorSurfaceY()) {
    crash();
  }
}

function compactArray(items, keep) {
  let write = 0;
  for (let read = 0; read < items.length; read += 1) {
    const item = items[read];
    if (keep(item)) {
      items[write] = item;
      write += 1;
    }
  }
  items.length = write;
}

function draw(now = performance.now()) {
  const { width, height } = state;
  const shakeTime = now;
  const shakeX = state.shake ? Math.sin(shakeTime * 0.052) * state.shake * 0.42 : 0;
  const shakeY = state.shake ? Math.cos(shakeTime * 0.061) * state.shake * 0.32 : 0;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawBackground();
  drawGates();
  drawDashEffects();
  drawParticles();
  drawBird(now);
  drawForeground(now);
  ctx.restore();
}

function drawBackground() {}

function drawGeneratedBackground() {
  ctx.fillStyle = "#123549";
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.fillStyle = "#071527";
  ctx.fillRect(0, 0, state.width, state.height * 0.36);
  ctx.fillStyle = "#1e4f45";
  ctx.fillRect(0, state.height * 0.58, state.width, state.height * 0.42);
  ctx.fillStyle = "rgba(249, 255, 207, 0.06)";
  ctx.fillRect(0, state.height * 0.34, state.width, state.height * 0.08);

  drawCelDisc(state.width * 0.78, state.height * 0.2, 54, "#ffe988", "#f18a5d", "#22192a", 4);
  ctx.fillStyle = "rgba(255, 248, 165, 0.28)";
  ctx.beginPath();
  ctx.arc(state.width * 0.78 - 13, state.height * 0.2 - 16, 15, 0, Math.PI * 2);
  ctx.fill();

  for (const star of state.stars) {
    ctx.globalAlpha = 0.25 + Math.sin(star.twinkle) * 0.18;
    ctx.fillStyle = "#f9ffcf";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawRidges();

  ctx.fillStyle = "#44616a";
  for (const cloud of state.clouds) {
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.r * 1.8, cloud.r * 0.44, 0, 0, Math.PI * 2);
    ctx.ellipse(cloud.x - cloud.r * 0.72, cloud.y + 4, cloud.r, cloud.r * 0.34, 0, 0, Math.PI * 2);
    ctx.ellipse(cloud.x + cloud.r * 0.74, cloud.y + 3, cloud.r * 0.92, cloud.r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(8, 20, 26, 0.45)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#5f7880";
    ctx.beginPath();
    ctx.ellipse(cloud.x - cloud.r * 0.32, cloud.y - 5, cloud.r * 0.92, cloud.r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#44616a";
  }
}

function startBackgroundVideo() {
  if (!USE_VIDEO_BACKGROUND) {
    markBackgroundVideoFallback();
    return;
  }
  if (state.performanceSaver && state.running) return;
  backgroundVideo.muted = true;
  backgroundVideo.defaultMuted = true;
  backgroundVideo.playbackRate = BACKGROUND_VIDEO_RATE;
  if (backgroundFallbackTimer) {
    window.clearTimeout(backgroundFallbackTimer);
  }
  backgroundFallbackTimer = window.setTimeout(() => {
    if (backgroundVideo.readyState < 2 || backgroundVideo.paused) {
      markBackgroundVideoFallback();
    }
  }, 1400);
  if (backgroundVideo.readyState >= 2) {
    markBackgroundVideoReady();
  }
  if (!backgroundVideo.paused && !backgroundVideo.ended) {
    markBackgroundVideoReady();
    return;
  }
  try {
    const play = backgroundVideo.play();
    if (play && typeof play.catch === "function") {
      play.then(markBackgroundVideoReady).catch(markBackgroundVideoFallback);
    }
  } catch {
    markBackgroundVideoFallback();
  }
}

function markBackgroundVideoReady() {
  if (backgroundFallbackTimer) {
    window.clearTimeout(backgroundFallbackTimer);
    backgroundFallbackTimer = null;
  }
  shell.classList.add("video-ready");
  shell.classList.remove("video-fallback");
}

function markBackgroundVideoFallback() {
  shell.classList.add("video-fallback");
}

function startBgm(options = {}) {
  if (auditAutoplay) return;
  bgmAudio.volume = BGM_VOLUME;
  if (options.restart) {
    try {
      bgmAudio.currentTime = 0;
    } catch {
      // Some browsers only allow seeking once metadata is ready.
    }
  }
  const play = bgmAudio.play();
  if (play && typeof play.catch === "function") {
    play.catch(() => {});
  }
}

function pauseBgm() {
  bgmAudio.pause();
}

function resumeAudio() {
  if (!AudioContextCtor) return null;
  if (!audio.ctx) {
    audio.ctx = new AudioContextCtor();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.26;
    audio.master.connect(audio.ctx.destination);
  }
  if (audio.ctx.state === "suspended") {
    audio.ctx.resume().catch(() => {});
  }
  return audio.ctx;
}

function unlockAudio() {
  const audioCtx = resumeAudio();
  if (!audioCtx || audio.unlocked) return;
  try {
    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    source.buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(audio.master);
    source.start();
    source.stop(audioCtx.currentTime + 0.01);
    audio.unlocked = true;
  } catch {
    audio.unlocked = false;
  }
}

function playTone(type, startFreq, endFreq, duration, volume, delay = 0) {
  const audioCtx = resumeAudio();
  if (!audioCtx) return;

  const start = audioCtx.currentTime + delay;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFreq, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(audio.master);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playNoise(duration, volume, delay = 0, startFreq = 900, endFreq = 180, filterType = "bandpass") {
  const audioCtx = resumeAudio();
  if (!audioCtx) return;

  const start = audioCtx.currentTime + delay;
  const length = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }

  const source = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  filter.type = filterType;
  filter.frequency.setValueAtTime(Math.max(1, startFreq), start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + duration);
  filter.Q.setValueAtTime(filterType === "bandpass" ? 1.4 : 0.8, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function playStartSound() {
  if (auditAutoplay) return;
  unlockAudio();
  playTone("triangle", 420, 650, 0.06, 0.055);
  playTone("square", 650, 980, 0.08, 0.045, 0.06);
  playTone("triangle", 980, 1240, 0.06, 0.032, 0.12);
}

function playFlapSound(power) {
  if (auditAutoplay) return;
  const lift = Math.min(1.6, power);
  unlockAudio();
  playTone("triangle", 660 + lift * 45, 980 + lift * 130, 0.055, 0.058);
  playTone("square", 1040 + lift * 80, 720 + lift * 70, 0.045, 0.026, 0.018);
  playNoise(0.035, 0.022, 0.005, 2200, 1150);
}

function playDashSound(strength) {
  if (auditAutoplay) return;
  const boost = Math.max(0.25, Math.min(1, strength));
  unlockAudio();
  playNoise(0.2, 0.11 + boost * 0.025, 0, 2600, 240);
  playTone("sawtooth", 260 + boost * 140, 58, 0.18, 0.082);
  playTone("square", 1120, 620, 0.07, 0.048, 0.018);
  playTone("triangle", 1460, 920, 0.055, 0.035, 0.08);
}

function playScoreSound() {
  if (auditAutoplay) return;
  unlockAudio();
  playTone("square", 680, 920, 0.07, 0.04);
  playTone("square", 920, 1220, 0.08, 0.04, 0.07);
}

function playCrashSound() {
  if (auditAutoplay) return;
  unlockAudio();
  playTone("sawtooth", 170, 45, 0.28, 0.075);
  playNoise(0.22, 0.08);
}

function drawRidges(now = performance.now()) {
  for (let layer = 0; layer < state.ridges.length; layer += 1) {
    const points = state.ridges[layer];
    const speed = getPaceSpeed() * (0.055 + layer * 0.028);
    const baseY = state.height - 76 + layer * 22;
    ctx.fillStyle = layer === 0 ? "rgba(8, 34, 40, 0.66)" : "rgba(7, 23, 28, 0.88)";
    ctx.beginPath();
    ctx.moveTo(0, state.height);
    for (let i = -1; i < points.length + 2; i += 1) {
      const point = points[(i + points.length) % points.length];
      const loopW = points.length * 190;
      const x = ((point.x - now * 0.001 * speed) % loopW) - 190;
      ctx.lineTo(x, baseY - point.h);
      ctx.lineTo(x + point.w * 0.52, baseY - point.h - 32);
      ctx.lineTo(x + point.w, baseY - point.h);
    }
    ctx.lineTo(state.width, state.height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGates() {
  for (const gate of state.gates) {
    const glow = isMobileDevice ? 0.42 : 0.5 + Math.sin(gate.pulse) * 0.5;
    ctx.save();
    drawPillarSegment(gate, true, glow);
    drawPillarSegment(gate, false, glow);
    if (!isMobileDevice) {
      drawGapEdgeSpark(gate, glow);
    }
    ctx.restore();
  }
}

function drawPillarSegment(gate, top, glow) {
  const capH = 30;
  const bodyX = gate.x;
  const bodyW = gate.w;
  const capX = gate.x - 13;
  const capW = gate.w + 26;
  const bodyY = top ? -24 : gate.gapBottom + capH - 3;
  const bodyH = top ? gate.gapTop - capH + 27 : state.height - gate.gapBottom + 42;
  const capY = top ? gate.gapTop - capH : gate.gapBottom;

  drawPillarBody(bodyX, bodyY, bodyW, Math.max(22, bodyH), top);
  drawPillarCap(capX, capY, capW, capH, top, glow);
}

function drawPillarBody(x, y, w, h, top) {
  const ink = "#071013";

  const front = ctx.createLinearGradient(x, y, x + w, y);
  front.addColorStop(0, "#8ed6ad");
  front.addColorStop(0.34, "#3aa979");
  front.addColorStop(0.72, "#22664f");
  front.addColorStop(1, "#123d32");
  roundedRect(x, y, w, h, 8, front);

  ctx.fillStyle = "rgba(5, 4, 3, 0.2)";
  ctx.fillRect(x + w - 16, y + 8, 10, Math.max(0, h - 16));
  ctx.fillStyle = "rgba(255, 240, 168, 0.34)";
  ctx.fillRect(x + 10, y + 10, 8, Math.max(0, h - 20));
  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.fillRect(x + 22, y + 16, 3, Math.max(0, h - 32));

  drawPillarBands(x, y, w, h, top);

  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  roundedRectStroke(x, y, w, h, 8);

  ctx.strokeStyle = "rgba(255, 240, 168, 0.26)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 15, y + 18);
  ctx.lineTo(x + 15, y + h - 18);
  ctx.stroke();

  if (!isMobileDevice && h > 84) {
    drawPillarFeatherAccent(x + w * 0.58, top ? y + h - 74 : y + 54, top ? -0.28 : 0.28);
  }
}

function drawPillarBands(x, y, w, h, top) {
  const bandGap = isMobileDevice ? 92 : 64;
  const start = top ? y + 36 : y + 24;
  const end = y + h - 28;
  for (let bandY = start; bandY < end; bandY += bandGap) {
    ctx.fillStyle = "#071013";
    roundedRect(bandY % 2 ? x + 6 : x + 9, bandY + 2, w - 10, 11, 4, "#071013");
    const band = ctx.createLinearGradient(x, bandY, x + w, bandY);
    band.addColorStop(0, "#fff0a8");
    band.addColorStop(0.45, "#d7aa43");
    band.addColorStop(1, "#7c4e1f");
    roundedRect(x + 4, bandY, w - 12, 11, 4, band);
    ctx.fillStyle = "rgba(255, 255, 255, 0.34)";
    ctx.fillRect(x + 11, bandY + 2, Math.max(4, w * 0.18), 2);
  }
}

function drawPillarCap(x, y, w, h, top, glow) {
  const ink = "#071013";

  const cap = ctx.createLinearGradient(x, y, x + w, y + h);
  cap.addColorStop(0, "#b9e8c5");
  cap.addColorStop(0.34, "#49b783");
  cap.addColorStop(0.74, "#1f644f");
  cap.addColorStop(1, "#123d32");
  roundedRect(x, y, w, h, 8, cap);

  ctx.fillStyle = top ? "rgba(5, 4, 3, 0.24)" : "rgba(255, 240, 168, 0.24)";
  ctx.fillRect(x + 6, top ? y + h - 10 : y + 6, w - 12, 6);
  ctx.fillStyle = top ? "rgba(255, 240, 168, 0.28)" : "rgba(5, 4, 3, 0.18)";
  ctx.fillRect(x + 12, top ? y + 6 : y + h - 11, Math.max(10, w * 0.28), 5);

  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  roundedRectStroke(x, y, w, h, 8);

  const rimY = top ? y + h - 8 : y + 6;
  ctx.strokeStyle = `rgba(255, 240, 168, ${0.26 + glow * 0.2})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 12, rimY);
  ctx.lineTo(x + w - 14, rimY);
  ctx.stroke();
}

function drawPillarFeatherAccent(x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(0.52, 0.52);
  ctx.fillStyle = "#071013";
  ctx.beginPath();
  ctx.moveTo(-5, 20);
  ctx.bezierCurveTo(18, 8, 23, -16, 1, -24);
  ctx.bezierCurveTo(-19, -13, -18, 8, -5, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d7aa43";
  ctx.beginPath();
  ctx.moveTo(-4, 15);
  ctx.bezierCurveTo(12, 5, 16, -11, 2, -18);
  ctx.bezierCurveTo(-11, -9, -12, 6, -4, 15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#7c4e1f";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-4, 15);
  ctx.quadraticCurveTo(0, 0, 3, -17);
  ctx.stroke();
  ctx.restore();
}

function drawGapEdgeSpark(gate, glow) {
  const alpha = 0.18 + glow * 0.16;
  ctx.fillStyle = `rgba(255, 240, 168, ${alpha})`;
  roundedRect(gate.x + 8, gate.gapTop - 5, gate.w - 16, 5, 3, ctx.fillStyle);
  roundedRect(gate.x + 8, gate.gapBottom, gate.w - 16, 5, 3, ctx.fillStyle);

  ctx.fillStyle = `rgba(142, 214, 173, ${0.1 + glow * 0.12})`;
  ctx.beginPath();
  ctx.ellipse(gate.x + gate.w * 0.5, gate.gapTop - 16, gate.w * 0.34, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(gate.x + gate.w * 0.5, gate.gapBottom + 16, gate.w * 0.34, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function getCharacterFrameState(now = performance.now()) {
  const activeName = state.bird.animUntil > now ? state.bird.animName : "idle";
  const frames = characterAnimations[activeName] || characterAnimations.idle;
  const frameMs = activeName === "idle" ? 170 : 58;
  const elapsed = activeName === "idle" ? now : now - state.bird.animStartedAt;
  const rawIndex = Math.floor(elapsed / frameMs);
  const frameIndex = activeName === "idle" ? rawIndex % frames.length : Math.min(frames.length - 1, rawIndex);
  return {
    activeName,
    frameIndex: frames[frameIndex],
  };
}

function getCharacterActionFrame(now = performance.now()) {
  if (!characterActionFrames.length) return null;
  const { frameIndex } = getCharacterFrameState(now);
  const image = characterActionFrames[frameIndex];
  return isImageReady(image) ? getOptimizedActionFrame(image) : null;
}

function drawBird(now = performance.now()) {
  const b = state.bird;
  ctx.save();
  ctx.translate(b.x + state.dash * 14, b.y);
  ctx.rotate(b.angle);

  if (isMobileDevice && isImageReady(characterMobileActionSheet)) {
    const { activeName, frameIndex } = getCharacterFrameState(now);
    const ratio = MOBILE_ACTION_SHEET_CELL_WIDTH / MOBILE_ACTION_SHEET_CELL_HEIGHT;
    const flap = Math.sin(b.wing * 1.38);
    const drawH = 118 + flap * 2 + state.dash * 5 + (activeName === "super" ? 6 : 0);
    const drawW = drawH * ratio;
    const wingBob = flap * 1.4;
    const flash = b.invuln > 0 && Math.floor(now / 70) % 2;
    const stretchX = 1 + state.dash * 0.08 + (activeName === "dash" ? 0.04 : 0);
    const stretchY = 1 - state.dash * 0.025 + (activeName === "super" ? 0.03 : 0);

    ctx.globalAlpha = flash ? 0.82 : 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";
    ctx.scale(stretchX, stretchY);
    ctx.drawImage(
      characterMobileActionSheet,
      frameIndex * MOBILE_ACTION_SHEET_CELL_WIDTH,
      0,
      MOBILE_ACTION_SHEET_CELL_WIDTH,
      MOBILE_ACTION_SHEET_CELL_HEIGHT,
      -drawW * 0.52,
      -drawH * 0.58 + wingBob,
      drawW,
      drawH
    );
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  const actionFrame = getCharacterActionFrame(now);
  if (actionFrame) {
    const ratio = getDrawableWidth(actionFrame) / getDrawableHeight(actionFrame);
    const active = b.animUntil > now ? b.animName : "idle";
    const flap = Math.sin(b.wing * 1.38);
    const drawH = 118 + flap * 2 + state.dash * 5 + (active === "super" ? 6 : 0);
    const drawW = drawH * ratio;
    const wingBob = flap * 1.4;
    const flash = b.invuln > 0 && Math.floor(now / 70) % 2;
    const stretchX = 1 + state.dash * 0.08 + (active === "dash" ? 0.04 : 0);
    const stretchY = 1 - state.dash * 0.025 + (active === "super" ? 0.03 : 0);

    ctx.globalAlpha = flash ? 0.82 : 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = isMobileDevice ? "medium" : "high";
    ctx.scale(stretchX, stretchY);
    if (!isMobileDevice) {
      ctx.shadowColor = "rgba(4, 10, 12, 0.38)";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = -6;
      ctx.shadowOffsetY = 8;
    }
    ctx.drawImage(actionFrame, -drawW * 0.52, -drawH * 0.58 + wingBob, drawW, drawH);
    ctx.globalAlpha = 1;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.restore();
    return;
  }

  if (characterStillImage.complete && characterStillImage.naturalWidth > 0) {
    const ratio = characterStillImage.naturalWidth / characterStillImage.naturalHeight;
    const flap = Math.sin(b.wing * 1.45);
    const drawH = 106 + flap * 2.4 + state.dash * 5;
    const drawW = drawH * ratio;
    const wingBob = flap * 1.7;
    const flash = b.invuln > 0 && Math.floor(now / 70) % 2;
    const stretchX = 1 + state.dash * 0.08 + Math.max(0, -b.vy) * 0.00004;
    const stretchY = 1 - state.dash * 0.025 - Math.max(0, -b.vy) * 0.000018;

    ctx.globalAlpha = flash ? 0.8 : 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.scale(stretchX, stretchY);
    if (!isMobileDevice) {
      ctx.shadowColor = "rgba(4, 10, 12, 0.42)";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = -6;
      ctx.shadowOffsetY = 8;
    }
    ctx.drawImage(
      characterStillImage,
      -drawW * 0.52,
      -drawH * 0.62 + wingBob,
      drawW,
      drawH,
    );
    ctx.globalAlpha = 1;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.restore();
    return;
  }

  if (characterImage.complete && characterImage.naturalWidth > 0) {
    const speedBoost = Math.max(0, getPaceSpeed() - BASE_SPEED) / BASE_SPEED;
    const frameIndex =
      Math.floor((now * (1 + speedBoost * 0.35)) / characterSprite.frameMs) %
      characterSprite.frameCount;
    const frameX = frameIndex * characterSprite.cellWidth;
    const drawH = 84;
    const drawW = drawH * (characterSprite.cellWidth / characterSprite.cellHeight);
    const wingBob = Math.sin(b.wing) * 1.4;
    const flash = b.invuln > 0 && Math.floor(now / 70) % 2;

    ctx.globalAlpha = flash ? 0.76 : 1;
    if (!isMobileDevice) {
      ctx.shadowColor = "rgba(4, 10, 12, 0.42)";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = -6;
      ctx.shadowOffsetY = 8;
    }
    ctx.drawImage(
      characterImage,
      frameX,
      0,
      characterSprite.cellWidth,
      characterSprite.cellHeight,
      -drawW * 0.52,
      -drawH * 0.54 + wingBob,
      drawW,
      drawH,
    );
    ctx.globalAlpha = 1;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.restore();
    return;
  }

  const flash = b.invuln > 0 && Math.floor(now / 70) % 2;
  const bodyBase = flash ? "#ffffff" : "#ffd82f";
  const bodyShade = flash ? "#d6f7ff" : "#e2a823";
  const bodyInk = "#071013";

  ctx.shadowColor = "rgba(4, 10, 12, 0.35)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = -7;
  ctx.shadowOffsetY = 9;
  ctx.fillStyle = bodyBase;
  ctx.beginPath();
  ctx.ellipse(0, 5, 29, 33, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bodyShade;
  ctx.beginPath();
  ctx.ellipse(7, 14, 20, 22, -0.08, -0.1, Math.PI * 1.08);
  ctx.quadraticCurveTo(-4, 34, -16, 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = bodyInk;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, 5, 29, 33, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  drawPlushTexture(flash);

  ctx.fillStyle = flash ? "#f8ffff" : "#fff2c0";
  ctx.beginPath();
  ctx.ellipse(-1, 15, 18, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(7, 16, 19, 0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = flash ? "#ffffff" : "#ffe982";
  ctx.beginPath();
  ctx.ellipse(-10, -15, 11, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bodyBase;
  ctx.strokeStyle = bodyInk;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-25, 5);
  ctx.quadraticCurveTo(-44, 8, -47, 20);
  ctx.quadraticCurveTo(-35, 24, -23, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(25, 5);
  ctx.quadraticCurveTo(42, 9, 43, 20);
  ctx.quadraticCurveTo(33, 23, 23, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(7, 16, 19, 0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-37, 14);
  ctx.quadraticCurveTo(-32, 15, -26, 12);
  ctx.moveTo(35, 14);
  ctx.quadraticCurveTo(31, 15, 25, 12);
  ctx.stroke();

  ctx.fillStyle = "#ff6c51";
  ctx.beginPath();
  ctx.ellipse(0, -4, 7.2, 4.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#071013";
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.fillStyle = "#ff9f62";
  ctx.beginPath();
  ctx.ellipse(-2, -5.8, 3.5, 1.35, -0.12, 0, Math.PI * 2);
  ctx.fill();

  const wingLift = Math.sin(b.wing) * 6;
  ctx.fillStyle = bodyBase;
  ctx.strokeStyle = "#d99b20";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-6, -29);
  ctx.quadraticCurveTo(-1, -36 + wingLift * 0.1, 4, -29);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1, -29);
  ctx.quadraticCurveTo(7, -34 + wingLift * 0.1, 10, -28);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 128, 151, 0.64)";
  ctx.beginPath();
  ctx.arc(-14, 0, 5.2, 0, Math.PI * 2);
  ctx.arc(15, 1, 4.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#071013";
  ctx.beginPath();
  ctx.arc(-10, -11, 6.1, 0, Math.PI * 2);
  ctx.arc(12, -10, 5.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-12, -13.4, 1.8, 0, Math.PI * 2);
  ctx.arc(10, -12.2, 1.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e6792e";
  ctx.strokeStyle = "#071013";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(-9, 38, 7, 3.8, -0.12, 0, Math.PI * 2);
  ctx.ellipse(9, 38, 7, 3.8, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ff9f62";
  ctx.beginPath();
  ctx.ellipse(-10, 36.8, 3, 1.4, -0.12, 0, Math.PI * 2);
  ctx.ellipse(8, 36.8, 3, 1.4, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlushTexture(flash) {
  ctx.save();
  ctx.strokeStyle = flash ? "#ffffff" : "rgba(255, 236, 130, 0.72)";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  for (let i = 0; i < 18; i += 1) {
    const angle = (Math.PI * 2 * i) / 18;
    const wobble = Math.sin(performance.now() * 0.004 + i) * 0.8;
    const rx = Math.cos(angle) * 28;
    const ry = Math.sin(angle) * 32;
    const startX = rx * 0.88;
    const startY = 5 + ry * 0.88;
    const endX = rx * 0.98 + Math.cos(angle) * wobble;
    const endY = 5 + ry * 0.98 + Math.sin(angle) * wobble;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  ctx.strokeStyle = flash ? "#f8ffff" : "#ffe982";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-5, -29);
  ctx.quadraticCurveTo(-1, -34, 4, -29);
  ctx.moveTo(2, -29);
  ctx.quadraticCurveTo(7, -33, 10, -28);
  ctx.stroke();

  ctx.fillStyle = flash ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 246, 170, 0.22)";
  for (let i = 0; i < 26; i += 1) {
    const x = -20 + ((i * 13) % 41);
    const y = -18 + ((i * 17) % 47);
    if ((x * x) / 720 + ((y - 5) * (y - 5)) / 980 < 1) {
      ctx.fillRect(x, y, 2, 1.4);
    }
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 3);
    if (p.glow && !isMobileDevice) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

function drawDashEffects() {
  for (const effect of state.dashEffects) {
    const t = Math.max(0, 1 - effect.age / effect.life);
    if (effect.type === "ring") {
      const radius = effect.radius + (effect.maxRadius - effect.radius) * (1 - t);
      ctx.globalAlpha = t;
      ctx.strokeStyle = "#071013";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.ellipse(effect.x, effect.y, radius * 1.2, radius * 0.52, -0.08, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(effect.x, effect.y, radius * 1.2, radius * 0.52, -0.08, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }

    if (effect.type === "comicBurst") {
      const progress = 1 - t;
      const radius = effect.radius + (effect.maxRadius - effect.radius) * progress;
      ctx.save();
      ctx.translate(effect.x, effect.y);
      ctx.rotate(effect.rotation + progress * 0.18);
      ctx.globalAlpha = t * 0.92;
      drawStarburstPath(0, 0, radius * 0.55, radius, effect.spikes);
      ctx.fillStyle = "#071013";
      ctx.fill();
      drawStarburstPath(0, 0, radius * 0.46, radius * 0.86, effect.spikes);
      ctx.fillStyle = "#fff0a8";
      ctx.fill();
      ctx.strokeStyle = "#7c4e1f";
      ctx.lineWidth = 3;
      ctx.stroke();
      drawStarburstPath(0, 0, radius * 0.2, radius * 0.38, effect.spikes);
      ctx.fillStyle = "#d7aa43";
      ctx.fill();
      ctx.restore();
      continue;
    }

    if (effect.type === "halftone") {
      ctx.save();
      ctx.globalAlpha = t * 0.38;
      const spread = effect.radius * (1.05 - t * 0.18);
      for (let row = -3; row <= 3; row += 1) {
        for (let col = -5; col <= 5; col += 1) {
          const dotX = effect.x + col * 18 - (1 - t) * 52;
          const dotY = effect.y + row * 16 + (col % 2) * 6;
          const distance = Math.hypot(dotX - effect.x, dotY - effect.y);
          if (distance > spread) continue;
          const size = Math.max(1.4, (1 - distance / spread) * 5.2 * t);
          ctx.fillStyle = (row + col) % 2 ? "#d7aa43" : "#fff0a8";
          ctx.beginPath();
          ctx.arc(dotX, dotY, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      continue;
    }

    if (effect.type === "comicText") {
      ctx.save();
      ctx.translate(effect.x, effect.y);
      ctx.rotate(effect.rotation);
      ctx.globalAlpha = Math.min(1, t * 1.25);
      ctx.font = `900 ${effect.size}px Inter, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#071013";
      ctx.lineWidth = 8;
      ctx.strokeText(effect.text, 0, 0);
      ctx.strokeStyle = "#7c4e1f";
      ctx.lineWidth = 3;
      ctx.strokeText(effect.text, 0, 0);
      ctx.fillStyle = "#fff0a8";
      ctx.fillText(effect.text, 0, 0);
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(-effect.size * 1.25, -effect.size * 0.42, effect.size * 0.7, 3);
      ctx.restore();
      continue;
    }

    if (effect.type === "impactStar") {
      ctx.save();
      ctx.translate(effect.x, effect.y);
      ctx.rotate(effect.rotation + (1 - t) * 0.9);
      ctx.globalAlpha = t;
      drawStarburstPath(0, 0, effect.size * 0.42, effect.size, 5);
      ctx.fillStyle = "#071013";
      ctx.fill();
      drawStarburstPath(0, 0, effect.size * 0.28, effect.size * 0.76, 5);
      ctx.fillStyle = effect.color;
      ctx.fill();
      ctx.restore();
      continue;
    }

    if (effect.type === "shard") {
      ctx.globalAlpha = t;
      ctx.fillStyle = "#071013";
      ctx.beginPath();
      ctx.moveTo(effect.x - 3, effect.y - effect.size);
      ctx.lineTo(effect.x + effect.size, effect.y);
      ctx.lineTo(effect.x - 3, effect.y + effect.size);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y - effect.size * 0.68);
      ctx.lineTo(effect.x + effect.size * 0.82, effect.y);
      ctx.lineTo(effect.x, effect.y + effect.size * 0.68);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = "butt";
}

function drawStarburstPath(x, y, innerRadius, outerRadius, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

function drawForeground(now = performance.now()) {
  ensureFloorArt();
  const groundY = getFloorSurfaceY() + 8;
  const topOffset = positiveModulo(now * 0.18, floorArt.topWidth);
  const tileOffset = positiveModulo(now * 0.34, floorArt.bodyWidth);

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(0, groundY - 14, state.width, 18);

  ctx.fillStyle = "#071013";
  roundedRect(-8, groundY - 5, state.width + 16, 64, 8, "#071013");

  const topGradient = ctx.createLinearGradient(0, groundY - 5, 0, groundY + 22);
  topGradient.addColorStop(0, "#fff0a8");
  topGradient.addColorStop(0.34, "#d7aa43");
  topGradient.addColorStop(1, "#7c4e1f");
  ctx.fillStyle = topGradient;
  roundedRect(-4, groundY - 12, state.width + 8, 28, 8, topGradient);

  ctx.strokeStyle = "#071013";
  ctx.lineWidth = 4;
  roundedRectStroke(-4, groundY - 12, state.width + 8, 28, 8);

  ctx.fillStyle = "#174d3d";
  roundedRect(-4, groundY + 10, state.width + 8, 56, 8, "#174d3d");
  ctx.fillStyle = "#0b241f";
  ctx.fillRect(0, groundY + 32, state.width, state.height - groundY);

  drawRepeatingTile(floorArt.topTile, floorArt.topWidth, floorArt.topHeight, -topOffset, groundY - 30);
  drawRepeatingTile(floorArt.bodyTile, floorArt.bodyWidth, floorArt.bodyHeight, -tileOffset, groundY + 16);
  ctx.restore();
}

function getFloorSurfaceY() {
  return state.height - 52;
}

function ensureFloorArt() {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
  if (floorArt.dpr === dpr) return;
  floorArt.dpr = dpr;
  buildFloorTile(floorArt.topTile, floorArt.topWidth, floorArt.topHeight, dpr, drawFloorTopTile);
  buildFloorTile(floorArt.bodyTile, floorArt.bodyWidth, floorArt.bodyHeight, dpr, drawFloorBodyTile);
}

function buildFloorTile(tile, width, height, dpr, drawTile) {
  tile.width = Math.ceil(width * dpr);
  tile.height = Math.ceil(height * dpr);
  const tileCtx = tile.getContext("2d");
  tileCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tileCtx.clearRect(0, 0, width, height);
  tileCtx.imageSmoothingEnabled = true;
  tileCtx.imageSmoothingQuality = "high";
  drawTile(tileCtx);
}

function drawFloorTopTile(tileCtx) {
  for (let x = -42; x < floorArt.topWidth + 48; x += 42) {
    tileCtx.fillStyle = "#3aa979";
    tileCtx.beginPath();
    tileCtx.moveTo(x, 21);
    tileCtx.quadraticCurveTo(x + 10, 2, x + 20, 21);
    tileCtx.quadraticCurveTo(x + 30, 31, x + 42, 21);
    tileCtx.closePath();
    tileCtx.fill();
    tileCtx.strokeStyle = "#071013";
    tileCtx.lineWidth = 3;
    tileCtx.stroke();

    tileCtx.fillStyle = "rgba(255, 240, 168, 0.58)";
    tileCtx.beginPath();
    tileCtx.ellipse(x + 18, 19, 6, 2.4, -0.2, 0, Math.PI * 2);
    tileCtx.fill();
  }
}

function drawFloorBodyTile(tileCtx) {
  roundedRectTo(tileCtx, 0, 4, 50, 14, 5, "#245d48");
  tileCtx.strokeStyle = "rgba(7, 16, 19, 0.72)";
  tileCtx.lineWidth = 2;
  tileCtx.strokeRect(3, 6, 44, 9);
  roundedRectTo(tileCtx, 30, 24, 38, 10, 5, "#102f29");

  roundedRectTo(tileCtx, 102, 1, 46, 12, 5, "#245d48");
  tileCtx.strokeRect(105, 3, 40, 8);
  roundedRectTo(tileCtx, 148, 24, 44, 11, 5, "#102f29");

  tileCtx.lineCap = "round";
  drawGroundFeather(24, 2, 0.42, -0.45, tileCtx);
  drawGroundPebble(64, 13, 7, "#d7aa43", tileCtx);
  drawGroundPebble(78, 21, 4, "#8ed6ad", tileCtx);
  drawGroundFeather(174, 10, 0.34, -0.2, tileCtx);
  drawGroundPebble(194, 17, 5, "#fff0a8", tileCtx);
  tileCtx.lineCap = "butt";
}

function drawRepeatingTile(tile, width, height, offsetX, y) {
  for (let x = offsetX - width; x < state.width + width; x += width) {
    ctx.drawImage(tile, x, y, width, height);
  }
}

function positiveModulo(value, size) {
  return ((value % size) + size) % size;
}

function roundedRectTo(targetCtx, x, y, w, h, r, fillStyle) {
  targetCtx.fillStyle = fillStyle;
  targetCtx.beginPath();
  targetCtx.moveTo(x + r, y);
  targetCtx.lineTo(x + w - r, y);
  targetCtx.quadraticCurveTo(x + w, y, x + w, y + r);
  targetCtx.lineTo(x + w, y + h - r);
  targetCtx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  targetCtx.lineTo(x + r, y + h);
  targetCtx.quadraticCurveTo(x, y + h, x, y + h - r);
  targetCtx.lineTo(x, y + r);
  targetCtx.quadraticCurveTo(x, y, x + r, y);
  targetCtx.fill();
}

function drawGroundPebble(x, y, radius, color, targetCtx = ctx) {
  targetCtx.fillStyle = "#071013";
  targetCtx.beginPath();
  targetCtx.ellipse(x + 2, y + 2, radius + 1, radius * 0.58 + 1, -0.08, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.fillStyle = color;
  targetCtx.beginPath();
  targetCtx.ellipse(x, y, radius, radius * 0.58, -0.08, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.fillStyle = "rgba(255, 255, 255, 0.42)";
  targetCtx.beginPath();
  targetCtx.ellipse(x - radius * 0.24, y - radius * 0.18, radius * 0.28, radius * 0.12, -0.08, 0, Math.PI * 2);
  targetCtx.fill();
}

function drawGroundFeather(x, y, scale, angle, targetCtx = ctx) {
  targetCtx.save();
  targetCtx.translate(x, y);
  targetCtx.rotate(angle);
  targetCtx.scale(scale, scale);
  targetCtx.fillStyle = "#071013";
  targetCtx.beginPath();
  targetCtx.moveTo(-5, 18);
  targetCtx.bezierCurveTo(17, 8, 20, -13, 1, -21);
  targetCtx.bezierCurveTo(-16, -11, -16, 7, -5, 18);
  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.fillStyle = "#fff0a8";
  targetCtx.beginPath();
  targetCtx.moveTo(-4, 14);
  targetCtx.bezierCurveTo(10, 4, 13, -9, 2, -16);
  targetCtx.bezierCurveTo(-9, -8, -10, 5, -4, 14);
  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.strokeStyle = "#7c4e1f";
  targetCtx.lineWidth = 2;
  targetCtx.beginPath();
  targetCtx.moveTo(-4, 14);
  targetCtx.quadraticCurveTo(-1, 0, 3, -15);
  targetCtx.stroke();
  targetCtx.restore();
}

function roundedRect(x, y, w, h, r, fillStyle) {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
}

function drawCelDisc(x, y, radius, base, shade, ink, lineWidth) {
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(x + radius * 0.18, y + radius * 0.2, radius * 0.82, -0.05, Math.PI * 0.95);
  ctx.quadraticCurveTo(x - radius * 0.15, y + radius * 0.45, x - radius * 0.28, y + radius * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCelBlock(x, y, w, h, depth = 18, front = "#35c188", side = "#176b59", ink = "#071013") {
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(x + w, y + depth);
  ctx.lineTo(x + w + depth, y);
  ctx.lineTo(x + w + depth, y + h);
  ctx.lineTo(x + w, y + h + depth);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = front;
  roundedRect(x, y, w, h, 10, front);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  roundedRectStroke(x, y, w, h, 10);
  ctx.beginPath();
  ctx.moveTo(x + w, y + depth);
  ctx.lineTo(x + w + depth, y);
  ctx.lineTo(x + w + depth, y + h);
  ctx.lineTo(x + w, y + h + depth);
  ctx.stroke();

  ctx.fillStyle = "rgba(249, 255, 207, 0.34)";
  ctx.fillRect(x + 10, y + 8, Math.max(6, w * 0.14), Math.max(0, h - 16));
}

function roundedRectStroke(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.stroke();
}

function pointFromEvent(event) {
  const touch =
    (event.changedTouches && event.changedTouches[0]) || (event.touches && event.touches[0]);
  return touch ? { x: touch.clientX, y: touch.clientY } : { x: event.clientX, y: event.clientY };
}

function preventEventDefault(event) {
  if (event.cancelable !== false) {
    event.preventDefault();
  }
}

function beginGestureAt(x, y) {
  unlockAudio();
  if (state.running && !state.crashed) startBgm();
  startBackgroundVideo();
  const wasRunning = state.running;
  if (!state.running && overlay.classList.contains("hidden")) resetGame();
  const immediateFlap = wasRunning && !state.crashed;
  startGesture(x, y, immediateFlap);
  if (immediateFlap) {
    flap(1);
  }
}

function finishGestureAt(x, y) {
  endGesture(x, y);
}

function onStart(event) {
  preventEventDefault(event);
  const point = pointFromEvent(event);
  beginGestureAt(point.x, point.y);
}

function onEnd(event) {
  preventEventDefault(event);
  const point = pointFromEvent(event);
  finishGestureAt(point.x, point.y);
}

function onPointerStart(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (state.activePointerId !== null) return;
  state.activePointerId = event.pointerId;
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is not universal on older mobile browsers.
  }
  onStart(event);
}

function onPointerEnd(event) {
  if (state.activePointerId !== event.pointerId) return;
  state.activePointerId = null;
  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch {
    // Safe no-op for browsers that do not expose capture release.
  }
  onEnd(event);
}

function onPointerCancel(event) {
  if (state.activePointerId !== null && state.activePointerId !== event.pointerId) return;
  preventEventDefault(event);
  state.activePointerId = null;
  state.pointerStart = null;
  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch {
    // Safe no-op for browsers that do not expose capture release.
  }
}

function touchById(touches, identifier) {
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches[index];
    if (touch.identifier === identifier) return touch;
  }
  return null;
}

function onTouchStart(event) {
  if (state.activeTouchId !== null) {
    preventEventDefault(event);
    return;
  }
  const touch = event.changedTouches[0];
  if (!touch) return;
  state.activeTouchId = touch.identifier;
  preventEventDefault(event);
  beginGestureAt(touch.clientX, touch.clientY);
}

function onTouchEnd(event) {
  const touch = touchById(event.changedTouches, state.activeTouchId);
  if (!touch) return;
  state.activeTouchId = null;
  preventEventDefault(event);
  finishGestureAt(touch.clientX, touch.clientY);
}

function onTouchCancel(event) {
  const touch = touchById(event.changedTouches, state.activeTouchId);
  if (!touch) return;
  preventEventDefault(event);
  state.activeTouchId = null;
  state.pointerStart = null;
}

function preventTouchScroll(event) {
  preventEventDefault(event);
}

let resizeQueued = false;

function scheduleResize() {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    resize();
  });
}

function handleVisibilityChange() {
  state.lastTime = performance.now();
  state.needsDraw = true;
  if (document.hidden) {
    backgroundVideo.pause();
    pauseBgm();
  } else {
    startBackgroundVideo();
    if (state.running && !state.crashed) startBgm();
  }
}

window.addEventListener("resize", scheduleResize);
document.addEventListener("visibilitychange", handleVisibilityChange);
if (isMobileDevice && window.visualViewport) {
  window.visualViewport.addEventListener("resize", scheduleResize);
  window.visualViewport.addEventListener("scroll", scheduleResize);
}
window.addEventListener("orientationchange", () => {
  scheduleResize();
  window.setTimeout(scheduleResize, 240);
});
window.addEventListener("pointerdown", startBackgroundVideo, { passive: true });
window.addEventListener("pointerdown", unlockAudio, { passive: true });
window.addEventListener("touchstart", startBackgroundVideo, { passive: true });
window.addEventListener("touchstart", unlockAudio, { passive: true });
window.addEventListener("click", startBackgroundVideo, { passive: true });
window.addEventListener("click", unlockAudio, { passive: true });
window.addEventListener("touchmove", preventTouchScroll, { passive: false });
canvas.addEventListener("contextmenu", preventTouchScroll);
if (window.PointerEvent) {
  canvas.addEventListener("pointerdown", onPointerStart);
  canvas.addEventListener("pointerup", onPointerEnd);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("lostpointercapture", onPointerCancel);
} else {
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", onTouchCancel, { passive: false });
  canvas.addEventListener("mousedown", onStart);
  canvas.addEventListener("mouseup", onEnd);
}
window.addEventListener("keydown", (event) => {
  unlockAudio();
  if (state.running && !state.crashed) startBgm();
  startBackgroundVideo();
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    if (!state.running) resetGame();
    flap(event.shiftKey ? 1.8 : 1);
  }
  if (event.code === "ArrowRight") {
    event.preventDefault();
    if (!state.running) resetGame();
    if (event.repeat) return;

    const now = performance.now();
    if (now - state.lastRightTap < 280) {
      dashForward(230);
      state.lastRightTap = 0;
    } else {
      state.lastRightTap = now;
    }
  }
  if (event.code === "ArrowDown") {
    state.bird.vy += 220;
    state.dashBoost = Math.max(state.dashBoost, 70);
  }
});
startButton.addEventListener("click", resetGame);

setupLeaderboard();
resize();
if (isMobileDevice) {
  requestIdle(startBackgroundVideo);
} else {
  startBackgroundVideo();
}
queueActionFrameWarmup();
loadLeaderboard();
requestAnimationFrame(step);
