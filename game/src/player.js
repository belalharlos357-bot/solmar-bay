// Mara Voss, the player character: third-person on-foot movement with a
// walk cycle, getting in and out of cars, and pistol shooting.
import { TUNE, clamp } from './config.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x9b1c2e }); // crimson jacket
  const skin = new THREE.MeshLambertMaterial({ color: 0xf1c27d });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), jeans);
  legL.position.set(-0.15, 0.42, 0);
  const legR = legL.clone(); legR.position.x = 0.15;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.75, 0.36), jacket);
  torso.position.y = 1.22;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.65, 0.17), jacket);
  armL.position.set(-0.42, 1.2, 0);
  const armR = armL.clone(); armR.position.x = 0.42;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
  head.position.y = 1.8;
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.4), hair);
  hairM.position.y = 2.0;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.42, 1.0, 0.25);
  gun.visible = false;
  g.add(legL, legR, torso, armL, armR, head, hairM, gun);
  g.userData = { legL, legR, armL, armR, torso, head, gun };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.x = 0; this.z = 30; this.heading = Math.PI;
    this.speed = 0;
    this.health = TUNE.healthMax;
    this.cash = 500;
    this.inCar = null;      // Car instance when driving
    this.walkPhase = 0;
    this.shotCooldown = 0;
    this.armed = false;
  }
  get pos() { return this.inCar ? { x: this.inCar.x, z: this.inCar.z } : { x: this.x, z: this.z }; }
  get headingNow() { return this.inCar ? this.inCar.heading : this.heading; }

  /** On-foot step. input: {f,b,l,r,sprint,heading (camera yaw)}. Returns moved distance. */
  stepOnFoot(dt, input, collide) {
    const sprint = input.sprint ? TUNE.sprintSpeed : TUNE.walkSpeed;
    let mx = 0, mz = 0;
    const s = Math.sin(input.heading), c = Math.cos(input.heading);
    if (input.f) { mx += -s; mz += -c; }
    if (input.b) { mx += s; mz += c; }
    if (input.l) { mx += -c; mz += s; }
    if (input.r) { mx += c; mz += -s; }
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len; mz /= len;
      this.heading = Math.atan2(mx, mz);
      this.x += mx * sprint * dt;
      this.z += mz * sprint * dt;
      this.x = clamp(this.x, -178, 178);
      this.z = clamp(this.z, -178, 205);
      if (collide) collide(this, 0.9);
      this.walkPhase += dt * sprint * 1.6;
      this.speed = sprint;
    } else {
      this.speed = 0;
    }
    this.syncMesh();
  }
  syncMesh() {
    this.mesh.visible = !this.inCar;
    if (this.inCar) return;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const swing = this.speed > 0.1 ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
    this.mesh.userData.armL.rotation.x = -swing * 0.7;
    this.mesh.userData.armR.rotation.x = swing * 0.7;
    this.mesh.userData.gun.visible = this.armed;
  }
  heal(dt, wantedStars) {
    if (wantedStars === 0 && this.health < TUNE.healthMax) this.health = Math.min(TUNE.healthMax, this.health + 4 * dt);
  }
}
