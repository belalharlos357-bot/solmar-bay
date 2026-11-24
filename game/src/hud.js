// HUD: cash, mission panel, wanted stars, health, speed, toasts, banners and
// the circular minimap (roads, buildings, player, police, mission beacon).
import { WORLD, STREETS } from './config.js';

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      cash: document.getElementById('cashBox'),
      missionTitle: document.getElementById('missionTitle'),
      missionText: document.getElementById('missionText'),
      missionDist: document.getElementById('missionDist'),
      stars: document.getElementById('stars'),
      healthFill: document.getElementById('healthFill'),
      speedBox: document.getElementById('speedBox'),
      speedVal: document.getElementById('speedVal'),
      toast: document.getElementById('toast'),
      banner: document.getElementById('banner'),
      crosshair: document.getElementById('crosshair'),
      damage: document.getElementById('damage'),
      status: document.getElementById('status'),
    };
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.toastTimer = null;
    this.bannerTimer = null;
  }
  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }
  setCash(n) { this.el.cash.firstChild.textContent = `$${n.toLocaleString('en-US')}`; }
  setMission(title, text, distText) {
    this.el.missionTitle.textContent = title;
    this.el.missionText.textContent = text;
    this.el.missionDist.textContent = distText || '';
  }
  setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i += 1) s += i < n ? '★' : '<span class="dim">★</span>';
    this.el.stars.innerHTML = s;
  }
  setHealth(frac) {
    this.el.healthFill.style.width = `${Math.max(0, Math.min(100, frac * 100))}%`;
    this.el.healthFill.style.background = frac > 0.5 ? 'linear-gradient(90deg,#37d67a,#a5e34d)' : frac > 0.25 ? 'linear-gradient(90deg,#f0a13c,#f5d76e)' : 'linear-gradient(90deg,#e74c3c,#f1948a)';
  }
  setSpeed(kmh, driving) {
    this.el.speedBox.classList.toggle('hidden', !driving);
    if (driving) this.el.speedVal.textContent = String(Math.round(kmh));
  }
  setCrosshair(on) { this.el.crosshair.style.display = on ? 'block' : 'none'; }
  flashDamage() {
    this.el.damage.style.opacity = '1';
    setTimeout(() => { this.el.damage.style.opacity = '0'; }, 180);
  }
  toast(text, ms = 2600) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    this.el.status.textContent = text;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.style.opacity = '0'; }, ms);
  }
  clearOverlays() {
    clearTimeout(this.toastTimer);
    clearTimeout(this.bannerTimer);
    this.el.toast.style.opacity = '0';
    this.el.banner.style.opacity = '0';
  }
  banner(main, sub, ms = 3000) {
    this.el.banner.innerHTML = `${main}${sub ? `<small>${sub}</small>` : ''}`;
    this.el.banner.style.opacity = '1';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => { this.el.banner.style.opacity = '0'; }, ms);
  }
  drawMinimap(game, time) {
    const g = this.mapCtx;
    const S = 200;
    const px = (v) => (v + WORLD.half) / (WORLD.half * 2) * S;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#20242c';
    g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.fill();
    g.save();
    g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.clip();
    // Water + beach
    g.fillStyle = '#1668a0'; g.fillRect(0, px(196), S, S - px(196));
    g.fillStyle = '#e8d5a0'; g.fillRect(0, px(182), S, px(196) - px(182));
    // Roads
    g.strokeStyle = '#555a63'; g.lineWidth = 5;
    for (const s of STREETS) {
      g.beginPath(); g.moveTo(0, px(s)); g.lineTo(S, px(s)); g.stroke();
      g.beginPath(); g.moveTo(px(s), 0); g.lineTo(px(s), S); g.stroke();
    }
    // Buildings
    g.fillStyle = '#9aa0ab';
    for (const b of game.city.buildings) {
      g.fillRect(px(b.minX), px(b.minZ), px(b.maxX) - px(b.minX), px(b.maxZ) - px(b.minZ));
    }
    // Mission beacon
    const bp = game.missions.beaconPos();
    if (bp) {
      const pulse = 5 + Math.sin(time * 4) * 2;
      g.fillStyle = '#ffd166';
      g.beginPath(); g.arc(px(bp[0]), px(bp[1]), pulse, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    }
    // Traffic
    g.fillStyle = '#c8ccd4';
    for (const c of game.traffic.cars) g.fillRect(px(c.x) - 1.5, px(c.z) - 1.5, 3, 3);
    // Police
    g.fillStyle = '#ff4444';
    for (const c of game.wanted.police) {
      g.beginPath(); g.arc(px(c.x), px(c.z), 3.5, 0, Math.PI * 2); g.fill();
    }
    // Player arrow
    const p = game.player;
    g.save();
    g.translate(px(p.pos.x), px(p.pos.z));
    g.rotate(-p.headingNow + Math.PI);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 1; g.stroke();
    g.restore();
    g.restore();
  }
}
