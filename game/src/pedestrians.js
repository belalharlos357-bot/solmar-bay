// Pedestrians: simple low-poly walkers strolling the sidewalks. They scatter
// when a car comes at them and fall when hit; the wanted system counts that.
import { WORLD, STREETS, clamp } from './config.js';
import { pick, range } from './random.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xecf0f1, 0xe67e22, 0x1abc9c];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const PANTS = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x5d4037, 0x1a1a2e];

function makePedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, SKINS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rng, PANTS) });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), pants);
  legL.position.set(-0.14, 0.4, 0);
  const legR = legL.clone(); legR.position.x = 0.14;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), shirt);
  armL.position.set(-0.4, 1.15, 0);
  const armR = armL.clone(); armR.position.x = 0.4;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.72;
  g.add(legL, legR, torso, armL, armR, head);
  g.userData = { legL, legR, armL, armR, torso, head };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class Pedestrians {
  constructor(scene, rng, count = 18) {
    this.scene = scene; this.rng = rng;
    this.peds = [];
    for (let i = 0; i < count; i += 1) {
      const mesh = makePedMesh(rng);
      scene.add(mesh);
      const s = pick(rng, STREETS);
      const along = range(rng, -160, 160);
      const side = rng() < 0.5 ? 7.5 : -7.5;
      const horizontal = rng() < 0.5;
      this.peds.push({
        mesh, x: horizontal ? along : s + side, z: horizontal ? s + side : along,
        heading: horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
        speed: range(rng, 1.1, 2.0), walkPhase: rng() * 10, down: 0, respawn: 0,
      });
    }
  }
  update(dt, danger) {
    for (const p of this.peds) {
      if (p.down > 0) {
        p.down -= dt;
        if (p.down <= 0) {
          // Get back up and wander off, or respawn elsewhere.
          p.mesh.visible = true;
          p.mesh.rotation.x = 0;
          p.respawn = 0;
          const s = pick(this.rng, STREETS);
          p.x = range(this.rng, -160, 160); p.z = s + 7.5;
          p.heading = this.rng() * Math.PI * 2;
        }
        continue;
      }
      // Flee a fast car bearing down on them.
      let flee = false;
      if (danger) {
        const d = Math.hypot(danger.x - p.x, danger.z - p.z);
        if (d < 12 && Math.abs(danger.speed) > 8) {
          flee = true;
          const away = Math.atan2(p.x - danger.x, p.z - danger.z);
          p.heading = away;
          p.speed = 4.2;
        }
      }
      if (!flee) p.speed = THREE.MathUtils.lerp(p.speed, 1.5, dt);
      p.walkPhase += dt * (4 + p.speed * 2);
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      if (Math.abs(p.x) > 168 || Math.abs(p.z) > 168 || this.rng() < dt * 0.02) {
        p.heading = this.rng() * Math.PI * 2;
        p.x = clamp(p.x, -168, 168); p.z = clamp(p.z, -168, 168);
      }
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      const swing = Math.sin(p.walkPhase) * 0.5;
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
      p.mesh.userData.armL.rotation.x = -swing * 0.7;
      p.mesh.userData.armR.rotation.x = swing * 0.7;
    }
  }
  /** Knock a ped down (car hit or shot). Returns the ped. */
  knockDown(p) {
    p.down = 6;
    p.mesh.rotation.x = -Math.PI / 2;
    p.mesh.position.y = 0.35;
    return p;
  }
  /** Nearest standing ped within r of (x,z). */
  nearest(x, z, r) {
    let best = null, bestD = r * r;
    for (const p of this.peds) {
      if (p.down > 0) continue;
      const dx = p.x - x, dz = p.z - z, d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
}
