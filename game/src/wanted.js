// The wanted system: heat builds with crimes, stars follow, police cars spawn
// and chase. Busted on foot, wasted at zero health — both cost cash.
import { TUNE, clamp } from './config.js';
import { spawnPolice, updatePoliceCar } from './vehicles.js';

export function starsForHeat(heat) {
  if (heat >= 80) return 5;
  if (heat >= 60) return 4;
  if (heat >= 40) return 3;
  if (heat >= 20) return 2;
  if (heat > 0) return 1;
  return 0;
}

export class Wanted {
  constructor(scene, rng, onEvent) {
    this.scene = scene; this.rng = rng; this.onEvent = onEvent;
    this.heat = 0;
    this.stars = 0;
    this.quietTime = 0;
    this.police = [];
    this.bustedTimer = 0;
  }
  addHeat(n, reason) {
    this.heat = clamp(this.heat + n, 0, 100);
    this.quietTime = 0;
    if (reason) this.onEvent('crime', { reason, heat: this.heat });
  }
  setStars(n) { this.heat = [0, 5, 25, 45, 65, 85][clamp(n, 0, 5)]; this.quietTime = 0; }
  spawnAt(x, z, heading) {
    const car = spawnPolice(this.scene, this.rng, x, z, heading);
    this.police.push(car);
    return car;
  }
  clear() { this.heat = 0; this.quietTime = 0; this.despawnAll(); }
  despawnAll() {
    for (const p of this.police) this.scene.remove(p.mesh);
    this.police = [];
  }
  update(dt, player, onRam, onBusted) {
    this.quietTime += dt;
    if (this.quietTime > 4 && this.heat > 0) this.heat = Math.max(0, this.heat - TUNE.wantedDecay * dt);
    const stars = starsForHeat(this.heat);
    if (stars !== this.stars) {
      this.stars = stars;
      if (stars > 0) this.onEvent('wanted', { stars });
    }
    // Keep the right number of police on the street.
    const want = this.stars === 0 ? 0 : Math.min(6, this.stars + 1);
    while (this.police.length < want) {
      const a = this.rng() * Math.PI * 2;
      const d = 70 + this.rng() * 40;
      const p = player.pos;
      const car = spawnPolice(this.scene, this.rng, p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, a);
      this.police.push(car);
    }
    while (this.police.length > want) {
      const car = this.police.pop();
      this.scene.remove(car.mesh);
    }
    // Chase.
    const tp = player.pos;
    for (const car of this.police) {
      updatePoliceCar(car, dt, tp.x, tp.z, (c) => { if (onRam) onRam(c); });
      // Keep police on the map.
      car.x = clamp(car.x, -200, 200);
      car.z = clamp(car.z, -200, 220);
    }
    // Busted: on foot, a police car sits on you at 2+ stars.
    if (!player.inCar && this.stars >= 2) {
      let near = false;
      for (const car of this.police) {
        if (Math.hypot(car.x - player.x, car.z - player.z) < TUNE.bustedRange) { near = true; break; }
      }
      if (near) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 1.6) { this.bustedTimer = 0; if (onBusted) onBusted(); }
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt);
      }
    } else {
      this.bustedTimer = 0;
    }
  }
}
