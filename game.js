const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const paceEl = document.querySelector("#pace");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");

const DPR_LIMIT = 2;
const bestKey = "rushwing-best";
const backgroundVideo = document.createElement("video");
backgroundVideo.src = "assets/animated-background.mp4";
backgroundVideo.muted = true;
backgroundVideo.defaultMuted = true;
backgroundVideo.loop = true;
backgroundVideo.autoplay = true;
backgroundVideo.playsInline = true;
backgroundVideo.preload = "auto";
backgroundVideo.setAttribute("muted", "");
backgroundVideo.setAttribute("playsinline", "");
backgroundVideo.setAttribute("webkit-playsinline", "");
const characterImage = new Image();
characterImage.src = "assets/chubby-bird-sprites.png";
const characterSprite = {
  frameCount: 125,
  cellWidth: 111,
  cellHeight: 77,
  frameMs: 38,
};

const state = {
  width: 0,
  height: 0,
  running: false,
  crashed: false,
  lastTime: 0,
  score: 0,
  best: Number(localStorage.getItem(bestKey) || 0),
  speed: 430,
  dash: 0,
  dashBoost: 0,
  spawnTimer: 0,
  shake: 0,
  charge: 0,
  holdStart: 0,
  pointerStart: null,
  particles: [],
  dashEffects: [],
  gates: [],
  clouds: [],
  stars: [],
  ridges: [],
  bird: {
    x: 0,
    y: 0,
    radius: 23,
    vy: 0,
    angle: 0,
    wing: 0,
    invuln: 0,
  },
};

bestEl.textContent = state.best;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = Math.floor(state.width * dpr);
  canvas.height = Math.floor(state.height * dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.bird.x = Math.max(92, state.width * 0.2);
}

function resetGame() {
  startBackgroundVideo();
  state.running = true;
  state.crashed = false;
  state.lastTime = performance.now();
  state.score = 0;
  state.speed = 430;
  state.dash = 0;
  state.dashBoost = 0;
  state.spawnTimer = 0.85;
  state.shake = 0;
  state.charge = 0;
  state.gates = [];
  state.particles = [];
  state.dashEffects = [];
  state.clouds = Array.from({ length: 12 }, () => ({
    x: Math.random() * state.width,
    y: Math.random() * state.height * 0.68,
    r: 18 + Math.random() * 58,
    s: 14 + Math.random() * 42,
  }));
  state.stars = Array.from({ length: 64 }, () => ({
    x: Math.random() * state.width,
    y: Math.random() * state.height * 0.66,
    size: 0.7 + Math.random() * 2.2,
    twinkle: Math.random() * Math.PI * 2,
  }));
  state.ridges = Array.from({ length: 2 }, (_, layer) =>
    Array.from({ length: 10 }, (_, i) => ({
      x: i * 190,
      h: 80 + Math.random() * 135 + layer * 40,
      w: 170 + Math.random() * 110,
    })),
  );
  state.bird.x = Math.max(92, state.width * 0.2);
  state.bird.y = state.height * 0.42;
  state.bird.vy = -220;
  state.bird.angle = 0;
  state.bird.invuln = 0.7;
  overlay.classList.add("hidden");
  updateHud();
}

function updateHud() {
  scoreEl.textContent = state.score;
  bestEl.textContent = state.best;
  paceEl.textContent = `${((state.speed + state.dashBoost) / 430).toFixed(1)}x`;
}

function spawnGate() {
  const margin = Math.max(86, state.height * 0.14);
  const gap = Math.max(128, 210 - state.score * 3.2);
  const center = margin + Math.random() * (state.height - margin * 2);
  const width = 72;
  state.gates.push({
    x: state.width + width,
    w: width,
    gapTop: Math.max(74, center - gap * 0.5),
    gapBottom: Math.min(state.height - 56, center + gap * 0.5),
    scored: false,
    pulse: Math.random() * Math.PI,
  });
}

function flap(power = 1, horizontal = 0) {
  const bird = state.bird;
  bird.vy = Math.min(bird.vy, 0) - 265 * power;
  bird.y -= 3.5 * power;
  bird.invuln = Math.max(bird.invuln, 0.08);
  state.speed += horizontal * 16;
  burst(bird.x - 8, bird.y + 12, 9 + power * 5, "#f7e85f");
}

function dashForward(distance, held) {
  const bird = state.bird;
  const strength = Math.min(1, distance / 210);
  state.speed += 6 + strength * 8 + held * 4;
  state.dashBoost = Math.max(state.dashBoost, 240 + strength * 300 + held * 110);
  state.dash = Math.min(1, state.dash + 0.9 + strength * 0.55);
  state.shake = Math.max(state.shake, 7 + strength * 8);
  bird.vy = Math.min(bird.vy, -130) - 90 * strength;
  spawnDashEffects(bird.x - 6, bird.y, strength);
  burst(bird.x - 24, bird.y, 26 + strength * 18, "#87ffe2");
  burst(bird.x - 38, bird.y + 10, 22, "#f7e85f");
}

function spawnDashEffects(x, y, strength) {
  state.dashEffects.push({
    type: "ring",
    x,
    y,
    age: 0,
    life: 0.36,
    radius: 26,
    maxRadius: 96 + strength * 46,
    color: "#87ffe2",
  });
  state.dashEffects.push({
    type: "flash",
    x,
    y,
    age: 0,
    life: 0.2,
    strength,
  });

  for (let i = 0; i < 9; i += 1) {
    state.dashEffects.push({
      type: "slash",
      x: x - 12 - Math.random() * 26,
      y: y - 38 + i * 10 + Math.random() * 8,
      age: 0,
      life: 0.24 + Math.random() * 0.14,
      length: 92 + Math.random() * 92 + strength * 44,
      width: 4 + Math.random() * 5,
      drift: 360 + Math.random() * 260,
      color: i % 2 ? "#f7e85f" : "#87ffe2",
    });
  }

  for (let i = 0; i < 15; i += 1) {
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
      color: i % 3 === 0 ? "#f7e85f" : "#87ffe2",
    });
  }
}

function burst(x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
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

function startHold(x, y) {
  state.pointerStart = { x, y, t: performance.now() };
  state.holdStart = performance.now();
}

function endHold(x, y) {
  if (!state.running) {
    resetGame();
    return;
  }

  const start = state.pointerStart;
  const held = Math.min(1, (performance.now() - state.holdStart) / 620);
  state.charge = 0;
  if (!start) {
    flap(1);
    return;
  }

  const dx = x - start.x;
  const dy = y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 28) {
    const rightSwipe = dx > 42 && Math.abs(dx) > Math.abs(dy) * 1.25;
    if (rightSwipe) {
      dashForward(distance, held);
      state.pointerStart = null;
      return;
    }
    const upward = dy < 0 ? 1.22 : 0.72;
    flap(0.82 + Math.min(distance / 240, 0.72) * upward + held * 0.24, Math.abs(dx) / 100);
    if (dy > 34) {
      state.bird.vy += 260;
      state.speed += 26;
      burst(state.bird.x, state.bird.y - 14, 14, "#ff6c51");
    }
  } else {
    flap(1 + held * 1.3);
  }
  state.pointerStart = null;
}

function crash() {
  if (state.bird.invuln > 0 || state.crashed) return;
  state.crashed = true;
  state.running = false;
  state.shake = 20;
  burst(state.bird.x, state.bird.y, 38, "#ff6c51");
  state.best = Math.max(state.best, state.score);
  localStorage.setItem(bestKey, state.best);
  overlay.querySelector("h1").textContent = "Run Over";
  overlay.querySelector("p").textContent = `Score ${state.score}. Swipe right to surge forward, or release charged holds to punch through the next pace spike.`;
  startButton.textContent = "Retry";
  overlay.classList.remove("hidden");
  updateHud();
}

function step(now) {
  const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0);
  state.lastTime = now;
  if (state.running) update(dt);
  draw();
  requestAnimationFrame(step);
}

function update(dt) {
  const bird = state.bird;
  state.speed += dt * 9.5;
  state.dash = Math.max(0, state.dash - dt * 5.2);
  state.dashBoost = Math.max(0, state.dashBoost - dt * (2500 + state.dashBoost * 4.5));
  const paceSpeed = state.speed + state.dashBoost;
  state.spawnTimer -= dt;
  state.shake = Math.max(0, state.shake - dt * 50);
  state.charge = state.pointerStart ? Math.min(1, (performance.now() - state.holdStart) / 620) : 0;
  bird.invuln = Math.max(0, bird.invuln - dt);
  bird.vy += (1240 + paceSpeed * 0.28) * dt;
  bird.y += bird.vy * dt;
  bird.angle = Math.max(-0.75, Math.min(1.15, bird.vy / 620));
  if (state.dash > 0) {
    bird.angle = Math.max(-0.5, bird.angle - state.dash * 0.35);
  }
  bird.wing += dt * (16 + paceSpeed / 80);
  if (Math.random() < 0.9) {
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
    state.spawnTimer = Math.max(0.72, 1.12 - state.score * 0.012);
  }

  for (const cloud of state.clouds) {
    cloud.x -= cloud.s * dt;
    if (cloud.x < -cloud.r * 2) {
      cloud.x = state.width + cloud.r;
      cloud.y = Math.random() * state.height * 0.68;
    }
  }

  for (const star of state.stars) {
    star.x -= (paceSpeed * 0.02 + star.size * 4) * dt;
    star.twinkle += dt * 2.8;
    if (star.x < -8) {
      star.x = state.width + Math.random() * 80;
      star.y = Math.random() * state.height * 0.66;
    }
  }

  for (const gate of state.gates) {
    const previousX = gate.x;
    gate.x -= paceSpeed * dt;
    gate.pulse += dt * 5;
    if (!gate.scored && gate.x + gate.w < bird.x) {
      gate.scored = true;
      state.score += 1;
      state.speed += 20;
      updateHud();
    }
    const sweptLeft = Math.min(previousX, gate.x);
    const sweptRight = Math.max(previousX + gate.w, gate.x + gate.w);
    const withinX = bird.x + bird.radius > sweptLeft && bird.x - bird.radius < sweptRight;
    const outsideGap = bird.y - bird.radius < gate.gapTop || bird.y + bird.radius > gate.gapBottom;
    if (withinX && outsideGap) crash();
  }
  state.gates = state.gates.filter((gate) => gate.x > -gate.w - 20);

  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 500 * dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  for (const effect of state.dashEffects) {
    effect.age += dt;
    if (effect.type === "slash") {
      effect.x -= effect.drift * dt;
    }
    if (effect.type === "shard") {
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.vy += 480 * dt;
    }
  }
  state.dashEffects = state.dashEffects.filter((effect) => effect.age < effect.life);

  if (bird.y - bird.radius < 0 || bird.y + bird.radius > state.height) crash();
}

function draw() {
  const { width, height } = state;
  const shakeX = (Math.random() - 0.5) * state.shake;
  const shakeY = (Math.random() - 0.5) * state.shake;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawBackground();
  drawDashFlash();
  drawSpeedLines();
  drawGates();
  drawDashEffects();
  drawParticles();
  drawBird();
  drawCharge();
  drawForeground();
  ctx.restore();
}

function drawDashFlash() {
  const flash = state.dashEffects.find((effect) => effect.type === "flash");
  if (!flash) return;
  const t = 1 - flash.age / flash.life;
  ctx.fillStyle = `rgba(135, 255, 226, ${0.1 * t})`;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.fillStyle = `rgba(249, 255, 207, ${0.1 * t})`;
  ctx.beginPath();
  ctx.moveTo(0, state.bird.y - 54);
  ctx.lineTo(state.width, state.bird.y - 6);
  ctx.lineTo(state.width, state.bird.y + 36);
  ctx.lineTo(0, state.bird.y + 12);
  ctx.closePath();
  ctx.fill();
}

function drawBackground() {
  if (drawAnimatedBackground()) return;
  drawGeneratedBackground();
}

function drawAnimatedBackground() {
  if (backgroundVideo.readyState < 2 || !backgroundVideo.videoWidth || !backgroundVideo.videoHeight) {
    return false;
  }

  drawVideoCover(backgroundVideo);
  ctx.fillStyle = "rgba(3, 12, 18, 0.18)";
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.fillStyle = "rgba(249, 255, 207, 0.05)";
  ctx.fillRect(0, state.height * 0.34, state.width, state.height * 0.08);
  return true;
}

function drawVideoCover(video) {
  const scale = Math.max(state.width / video.videoWidth, state.height / video.videoHeight);
  const drawW = video.videoWidth * scale;
  const drawH = video.videoHeight * scale;
  const drawX = (state.width - drawW) * 0.5;
  const drawY = (state.height - drawH) * 0.5;
  ctx.drawImage(video, drawX, drawY, drawW, drawH);
}

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
  if (!backgroundVideo.paused) return;
  const play = backgroundVideo.play();
  if (play && typeof play.catch === "function") {
    play.catch(() => {});
  }
}

function drawRidges() {
  for (let layer = 0; layer < state.ridges.length; layer += 1) {
    const points = state.ridges[layer];
    const speed = (state.speed + state.dashBoost) * (0.055 + layer * 0.028);
    const baseY = state.height - 76 + layer * 22;
    ctx.fillStyle = layer === 0 ? "rgba(8, 34, 40, 0.66)" : "rgba(7, 23, 28, 0.88)";
    ctx.beginPath();
    ctx.moveTo(0, state.height);
    for (let i = -1; i < points.length + 2; i += 1) {
      const point = points[(i + points.length) % points.length];
      const loopW = points.length * 190;
      const x = ((point.x - performance.now() * 0.001 * speed) % loopW) - 190;
      ctx.lineTo(x, baseY - point.h);
      ctx.lineTo(x + point.w * 0.52, baseY - point.h - 32);
      ctx.lineTo(x + point.w, baseY - point.h);
    }
    ctx.lineTo(state.width, state.height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSpeedLines() {
  const pace = Math.max(0, (state.speed + state.dashBoost - 430) / 380) + state.dash * 0.65;
  ctx.lineCap = "round";
  for (let i = 0; i < 26; i += 1) {
    const y = ((i * 83 + performance.now() * (0.24 + pace * 0.18)) % state.height);
    const x = (i * 137 + performance.now() * -(0.46 + pace * 0.36)) % (state.width + 220);
    const len = 42 + pace * 90 + (i % 4) * 10;
    ctx.strokeStyle = i % 3 === 0 ? "rgba(247, 232, 95, 0.22)" : "rgba(64, 225, 190, 0.18)";
    ctx.lineWidth = 1.2 + pace * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len, y + 10);
    ctx.stroke();
  }
}

function drawGates() {
  for (const gate of state.gates) {
    const glow = 0.5 + Math.sin(gate.pulse) * 0.5;
    const cap = 20;
    const side = 18;

    ctx.shadowColor = `rgba(64, 225, 190, ${0.15 + glow * 0.22})`;
    ctx.shadowBlur = 10;
    drawCelBlock(gate.x, -18, gate.w, gate.gapTop + 18, side);
    drawCelBlock(gate.x, gate.gapBottom, gate.w, state.height - gate.gapBottom + 18, side);
    ctx.shadowBlur = 0;

    drawCelBlock(gate.x - 10, gate.gapTop - cap, gate.w + 20, cap, 8, "#49e09e", "#1a7c63", "#10251f");
    drawCelBlock(gate.x - 10, gate.gapBottom, gate.w + 20, cap, 8, "#49e09e", "#1a7c63", "#10251f");

    ctx.fillStyle = `rgba(249, 255, 207, ${0.26 + glow * 0.28})`;
    ctx.fillRect(gate.x + 12, 8, 7, Math.max(0, gate.gapTop - cap - 18));
    ctx.fillRect(gate.x + 12, gate.gapBottom + cap + 8, 7, state.height - gate.gapBottom);

    ctx.strokeStyle = "rgba(5, 16, 18, 0.48)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gate.x + 10, gate.gapTop - 44);
    ctx.lineTo(gate.x + gate.w - 10, gate.gapTop - 44);
    ctx.moveTo(gate.x + 10, gate.gapBottom + 44);
    ctx.lineTo(gate.x + gate.w - 10, gate.gapBottom + 44);
    ctx.stroke();
  }
}

function drawBird() {
  const b = state.bird;
  ctx.save();
  ctx.translate(b.x + state.dash * 14, b.y);
  ctx.rotate(b.angle);

  if (characterImage.complete && characterImage.naturalWidth > 0) {
    const speedBoost = Math.max(0, (state.speed + state.dashBoost - 430) / 430);
    const frameIndex =
      Math.floor((performance.now() * (1 + speedBoost * 0.35)) / characterSprite.frameMs) %
      characterSprite.frameCount;
    const frameX = frameIndex * characterSprite.cellWidth;
    const drawH = 84;
    const drawW = drawH * (characterSprite.cellWidth / characterSprite.cellHeight);
    const wingBob = Math.sin(b.wing) * 1.4;
    const flash = b.invuln > 0 && Math.floor(performance.now() / 70) % 2;

    ctx.globalAlpha = flash ? 0.76 : 1;
    ctx.shadowColor = "rgba(4, 10, 12, 0.42)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = -6;
    ctx.shadowOffsetY = 8;
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

  const flash = b.invuln > 0 && Math.floor(performance.now() / 70) % 2;
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
    if (p.glow) {
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

    if (effect.type === "slash") {
      ctx.globalAlpha = t;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#071013";
      ctx.lineWidth = effect.width + 5;
      ctx.beginPath();
      ctx.moveTo(effect.x + effect.length * 0.14, effect.y - 9);
      ctx.lineTo(effect.x - effect.length, effect.y + 12);
      ctx.stroke();
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = effect.width;
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y);
      ctx.lineTo(effect.x - effect.length, effect.y + 18);
      ctx.stroke();
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

function drawCharge() {
  if (!state.pointerStart || !state.running) return;
  const b = state.bird;
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.arc(b.x, b.y, 38, -Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
  ctx.strokeStyle = "#f7e85f";
  ctx.beginPath();
  ctx.arc(b.x, b.y, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.charge);
  ctx.stroke();
}

function drawForeground() {
  const groundY = state.height - 34;
  ctx.fillStyle = "#10251f";
  ctx.fillRect(0, groundY, state.width, state.height - groundY);
  ctx.fillStyle = "#1f5648";
  ctx.fillRect(0, groundY, state.width, 10);
  ctx.strokeStyle = "#071013";
  ctx.lineWidth = 4;
  ctx.strokeRect(-3, groundY - 1, state.width + 6, 12);

  ctx.fillStyle = "rgba(249, 255, 207, 0.26)";
  const offset = (performance.now() * -0.36) % 56;
  for (let x = offset; x < state.width + 56; x += 56) {
    ctx.fillRect(x, groundY + 10, 24, 3);
  }
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
  const touch = event.changedTouches?.[0] || event.touches?.[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : { x: event.clientX, y: event.clientY };
}

function onStart(event) {
  event.preventDefault();
  const point = pointFromEvent(event);
  if (!state.running && overlay.classList.contains("hidden")) resetGame();
  startHold(point.x, point.y);
}

function onEnd(event) {
  event.preventDefault();
  const point = pointFromEvent(event);
  endHold(point.x, point.y);
}

window.addEventListener("resize", resize);
if (window.PointerEvent) {
  canvas.addEventListener("pointerdown", onStart);
  canvas.addEventListener("pointerup", onEnd);
  canvas.addEventListener("pointercancel", onEnd);
} else {
  canvas.addEventListener("touchstart", onStart, { passive: false });
  canvas.addEventListener("touchend", onEnd, { passive: false });
  canvas.addEventListener("mousedown", onStart);
  canvas.addEventListener("mouseup", onEnd);
}
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    if (!state.running) resetGame();
    flap(event.shiftKey ? 1.8 : 1);
  }
  if (event.code === "ArrowDown") {
    state.bird.vy += 260;
    state.speed += 24;
  }
});
startButton.addEventListener("click", resetGame);

resize();
startBackgroundVideo();
requestAnimationFrame(step);
