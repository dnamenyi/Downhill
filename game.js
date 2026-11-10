// Downhill Rush - a simple 2D downhill mountain bike racer.
// Controls: Right/D/Space = pedal, Down/S = brake, Left/Right in air = rotate (flip for boost), R = restart.
(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const W = 960, H = 540;
  function resize() { canvas.width = W; canvas.height = H; }
  resize();

  const G = 1400, COURSE = 14000, WHEEL = 12;

  const smooth = t => t * t * (3 - 2 * t);
  function kicker(x, c) {
    if (x > c - 160 && x <= c) return -45 * smooth((x - (c - 160)) / 160);
    if (x > c && x < c + 90) return -45 * (1 - smooth((x - c) / 90));
    return 0;
  }
  function groundY(x) {
    let y = x * 0.32 + 70 * Math.sin(x / 320) + 30 * Math.sin(x / 120 + 1);
    for (let c = 1800; c < COURSE; c += 1700) y += kicker(x, c);
    return y;
  }
  const groundAngle = x => Math.atan2(groundY(x + 2) - groundY(x - 2), 4);

  class Rider {
    constructor(name, color, ai) {
      this.name = name; this.color = color; this.ai = ai;
      this.power = ai ? 330 + Math.random() * 110 : 420;
      this.reset(0);
    }
    reset(x) {
      this.x = x; this.y = groundY(x) - WHEEL; this.s = 0; this.vx = 0; this.vy = 0;
      this.angle = groundAngle(x); this.air = false; this.spin = 0; this.flips = 0;
      this.crash = 0; this.finished = false; this.time = 0; this.input = {};
    }
    update(dt) {
      if (this.finished) { this.s *= 0.98; if (this.s < 1) this.s = 0; }
      if (this.crash > 0) {
        this.crash -= dt;
        if (this.crash <= 0) this.reset(Math.max(0, this.x - 60));
        return;
      }
      const inp = this.input;
      if (this.air) {
        this.vy += G * dt; this.x += this.vx * dt; this.y += this.vy * dt;
        let rot = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
        this.angle += rot * 6 * dt; this.spin += rot * 6 * dt;
        const gy = groundY(this.x) - WHEEL;
        if (this.y >= gy) {
          this.y = gy;
          const ga = groundAngle(this.x);
          const spinsDone = Math.round(this.spin / (2 * Math.PI));
          let diff = (this.angle - spinsDone * 2 * Math.PI) - ga;
          this.flips = Math.abs(spinsDone);
          if (Math.abs(diff) > 0.9) { this.crash = 1.2; this.vx = this.vy = this.s = 0; this.flips = 0; return; }
          const t = [Math.cos(ga), Math.sin(ga)];
          this.s = Math.max(0, this.vx * t[0] + this.vy * t[1]) * 0.97 * (1 + 0.12 * this.flips);
          this.angle = ga; this.air = false;
          if (this.flips > 0) { this.lastTrick = this.flips; this.trickT = 2; }
        }
        return;
      }
      // ground
      const ga = groundAngle(this.x);
      this.angle = ga;
      let a = G * Math.sin(ga) - 0.0012 * this.s * Math.abs(this.s) - 18;
      if (inp.pedal && !this.finished && this.s < 700) a += this.power * (1 - this.s / 800);
      if (inp.brake || this.finished) a -= Math.sign(this.s) * 700;
      this.s = Math.max(0, this.s + a * dt);
      const vx = this.s * Math.cos(ga), vy = this.s * Math.sin(ga);
      const nx = this.x + vx * dt, by = this.y + vy * dt + 0.5 * G * dt * dt;
      const gy = groundY(nx) - WHEEL;
      if (gy - by > 2 && this.s > 150) {
        this.air = true; this.vx = vx; this.vy = vy; this.spin = 0; this.x = nx; this.y = by;
      } else { this.x = nx; this.y = gy; }
      if (!this.finished) this.time += dt;
      if (this.x >= COURSE && !this.finished) { this.finished = true; this.finishTime = this.time; }
    }
    draw(cx, cy, me) {
      const px = this.x - cx, py = this.y - cy;
      if (px < -60 || px > W + 60) return;
      ctx.save();
      ctx.translate(px, py);
      if (this.crash > 0) ctx.rotate(Math.sin(this.crash * 20) * 0.3 + 1.5);
      else ctx.rotate(this.angle);
      ctx.globalAlpha = me ? 1 : 0.85;
      ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(-17, 0, WHEEL, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(17, 0, WHEEL, 0, 7); ctx.stroke();
      ctx.strokeStyle = this.color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-4, -16); ctx.lineTo(13, -14); ctx.lineTo(17, 0);
      ctx.moveTo(-4, -16); ctx.lineTo(0, 0); ctx.lineTo(-17, 0); ctx.stroke();
      ctx.fillStyle = this.color;
      ctx.fillRect(-9, -36, 10, 20);
      ctx.fillStyle = '#fc9';
      ctx.beginPath(); ctx.arc(2, -42, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(2, -44, 6.5, Math.PI, 0); ctx.fill();
      ctx.restore();
      if (!me) {
        ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(this.name, px, py - 62);
      }
    }
  }

  const keys = {};
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (state === 'title' && (e.code === 'Space' || e.code === 'Enter')) start();
    else if (e.code === 'KeyR') start();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });

  let player, rivals, state = 'title', countdown = 0, trees = [];
  function start() {
    player = new Rider('You', '#e33', false);
    rivals = [new Rider('Ace', '#38f', true), new Rider('Bolt', '#3b4', true), new Rider('Viper', '#c5c', true)];
    rivals.forEach((r, i) => r.reset(-30 * (i + 1)));
    player.reset(0);
    countdown = 3; state = 'race';
    trees = [];
    for (let x = 100; x < COURSE + 800; x += 60 + Math.random() * 120) trees.push({ x, h: 40 + Math.random() * 40, z: Math.random() });
  }

  function ai(r) {
    const i = r.input; i.pedal = true; i.brake = false; i.left = i.right = false;
    if (r.air) {
      const target = groundAngle(r.x + r.vx * 0.3);
      const d = target + Math.round((r.angle - target) / (2 * Math.PI)) * 2 * Math.PI - r.angle;
      i.right = d > 0.1; i.left = d < -0.1;
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.03, (now - last) / 1000); last = now;
    if (state === 'race') step(dt);
    render();
    requestAnimationFrame(frame);
  }

  function step(dt) {
    if (countdown > 0) { countdown -= dt; return; }
    player.input = {
      pedal: keys.ArrowRight || keys.KeyD || keys.Space,
      brake: keys.ArrowDown || keys.KeyS,
      left: keys.ArrowLeft || keys.KeyA,
      right: keys.ArrowRight || keys.KeyD,
    };
    // in air, Space shouldn't matter; pedal only on ground
    for (const r of rivals) { ai(r); r.update(dt); }
    player.update(dt);
    if (player.trickT > 0) player.trickT -= dt;
  }

  function render() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#6cf'); g.addColorStop(1, '#cef');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (!player) { overlay('DOWNHILL RUSH', 'Press SPACE to start'); help(); return; }

    const cx = player.x - 300;
    const cy = player.y - 320;
    // parallax mountains
    ctx.fillStyle = '#8ab';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let sx = 0; sx <= W; sx += 20) {
      const wx = sx + cx * 0.2;
      ctx.lineTo(sx, 300 + 60 * Math.sin(wx / 150) + 40 * Math.sin(wx / 53) - cy * 0.1);
    }
    ctx.lineTo(W, H); ctx.fill();
    // terrain
    ctx.fillStyle = '#5a4';
    ctx.beginPath(); ctx.moveTo(0, H + 400);
    for (let sx = 0; sx <= W + 10; sx += 10) ctx.lineTo(sx, groundY(sx + cx) - cy);
    ctx.lineTo(W, H + 400); ctx.fill();
    ctx.strokeStyle = '#873'; ctx.lineWidth = 6; ctx.beginPath();
    for (let sx = 0; sx <= W + 10; sx += 10) ctx[sx ? 'lineTo' : 'moveTo'](sx, groundY(sx + cx) - cy + 3);
    ctx.stroke();
    // trees
    for (const t of trees) {
      const sx = t.x - cx; if (sx < -40 || sx > W + 40) continue;
      const by = groundY(t.x) - cy;
      ctx.fillStyle = '#541'; ctx.fillRect(sx - 3, by - t.h * 0.4, 6, t.h * 0.4);
      ctx.fillStyle = '#273';
      ctx.beginPath(); ctx.moveTo(sx - 16, by - t.h * 0.3); ctx.lineTo(sx, by - t.h); ctx.lineTo(sx + 16, by - t.h * 0.3); ctx.fill();
    }
    // finish line
    const fx = COURSE - cx;
    if (fx > -20 && fx < W + 20) {
      const fy = groundY(COURSE) - cy;
      ctx.fillStyle = '#fff'; ctx.fillRect(fx - 2, fy - 120, 4, 120);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#000' : '#fff'; ctx.fillRect(fx - 60 + i * 20, fy - 120, 20, 14); }
    }
    rivals.forEach(r => r.draw(cx, cy, false));
    player.draw(cx, cy, true);

    // HUD
    ctx.textAlign = 'left'; ctx.fillStyle = '#000a'; ctx.fillRect(10, 10, 220, 92);
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
    ctx.fillText('Time: ' + player.time.toFixed(2) + 's', 20, 32);
    ctx.fillText('Speed: ' + Math.round(player.air ? Math.hypot(player.vx, player.vy) : player.s) / 10 + ' km/h*', 20, 54);
    const pos = 1 + rivals.filter(r => r.finished === player.finished && (r.finished ? r.finishTime < player.finishTime : r.x > player.x) || (r.finished && !player.finished)).length;
    ctx.fillText('Position: ' + pos + '/' + (rivals.length + 1), 20, 76);
    ctx.fillText('Distance: ' + Math.min(100, Math.round(player.x / COURSE * 100)) + '%', 20, 98);
    if (player.trickT > 0) {
      ctx.textAlign = 'center'; ctx.fillStyle = '#ff0'; ctx.font = 'bold 32px sans-serif';
      ctx.fillText(player.lastTrick + 'x FLIP BOOST!', W / 2, 90);
    }
    if (player.crash > 0) { ctx.textAlign = 'center'; ctx.fillStyle = '#f33'; ctx.font = 'bold 40px sans-serif'; ctx.fillText('WIPEOUT!', W / 2, 150); }
    if (countdown > 0) overlay(String(Math.ceil(countdown)), '');
    if (player.finished) overlay('FINISH! Place ' + pos, 'Time ' + player.finishTime.toFixed(2) + 's - press R to race again');
    help();
  }

  function overlay(big, small) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.font = 'bold 56px sans-serif';
    ctx.fillText(big, W / 2, H / 2 - 20);
    ctx.font = '22px sans-serif'; ctx.fillText(small, W / 2, H / 2 + 20);
  }
  function help() {
    ctx.textAlign = 'right'; ctx.fillStyle = '#000'; ctx.font = '13px sans-serif';
    ctx.fillText('→/D/Space pedal  ↓/S brake  ←/→ rotate in air (flip for boost)  R restart', W - 10, H - 10);
  }

  requestAnimationFrame(frame);
})();
