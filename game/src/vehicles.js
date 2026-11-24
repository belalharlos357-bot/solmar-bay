// Cars: mesh factory, traffic that follows the street grid, and police cars
// that chase the player. All arcade physics, no engine beyond three.js.
import { WORLD, STREETS, TUNE, nearestStreet, clamp } from './config.js';
import { pick, range, int } from './random.js';

const CAR_COLORS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1a1a1a, 0x7f8c8d, 0x16a085, 0xd35400];

function policeDoorTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f5f5f5'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#111'; g.font = 'bold 22px Verdana, sans-serif';
  g.textAlign = 'center'; g.fillText('POLICE', 64, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
let policeTex = null;

export function makeCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), bodyMat);
  body.position.y = 0.55; body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 2.2), darkMat);
  cabin.position.set(0, 1.1, -0.25); cabin.castShadow = true;
  g.add(body, cabin);
  if (isPolice) {
    if (!policeTex) policeTex = policeDoorTexture();
    const doorMat = new THREE.MeshLambertMaterial({ map: policeTex });
    const doorL = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), doorMat);
    doorL.position.set(-1.06, 0.62, 0.1); doorL.rotation.y = -Math.PI / 2;
    const doorR = doorL.clone(); doorR.position.x = 1.06; doorR.rotation.y = Math.PI / 2;
    g.add(doorL, doorR);
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1 }));
    red.position.x = -0.4;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 1 }));
    blue.position.x = 0.4;
    bar.add(red, blue);
    bar.position.set(0, 1.48, -0.25);
    g.add(bar);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
  }
  // Headlights / taillights
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe9a0, emissiveIntensity: 0.7 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000, emissiveIntensity: 0.7 });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), headMat);
    h.position.set(sx, 0.6, 2.21); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    t.position.set(sx, 0.6, -2.21); g.add(t);
  }
  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.body = body;
  return g;
}

export class Car {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh;
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
    this.steerVis = 0;
  }
  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    // Mesh front is +z; heading's forward is (-sin h, -cos h), so add PI.
    this.mesh.rotation.y = this.heading + Math.PI;
    const spin = this.speed * 0.016 / 0.42;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }
}

// --- Traffic: cars that cruise the grid, turning at intersections. ---
export class Traffic {
  constructor(scene, rng, city, count = 14) {
    this.scene = scene; this.rng = rng; this.city = city;
    this.cars = [];
    for (let i = 0; i < count; i += 1) {
      const color = pick(rng, CAR_COLORS);
      const mesh = makeCarMesh(color);
      scene.add(mesh);
      const horizontal = rng() < 0.5;
      const s = pick(rng, STREETS);
      const v = range(rng, -160, 160);
      const lane = (rng() < 0.5 ? 2.2 : -2.2);
      const car = new Car(mesh, horizontal ? v : s + lane, horizontal ? s + lane : v, horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2));
      car.speed = range(rng, 7, 11);
      car.horizontal = horizontal;
      car.lane = lane;
      this.cars.push(car);
    }
  }
  update(dt, playerCar) {
    for (const car of this.cars) {
      if (car.disabled > 0) { car.disabled -= dt; car.speed = 0; car.syncMesh(); continue; }
      // Slow for a car ahead on the same street.
      let target = TUNE.trafficSpeed;
      const fx = -Math.sin(car.heading), fz = -Math.cos(car.heading);
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.x - car.x, dz = other.z - car.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 100 && dx * fx + dz * fz > 0 && Math.abs(dx * fz - dz * fx) < 4) { target = 0; break; }
      }
      car.speed = THREE.MathUtils.lerp(car.speed, target, Math.min(1, dt * 2));
      const step = car.speed * dt;
      car.x += -Math.sin(car.heading) * step;
      car.z += -Math.cos(car.heading) * step;
      // At an intersection, sometimes turn onto the cross street.
      const along = car.horizontal ? car.x : car.z;
      const mod = ((along % 40) + 40) % 40;
      const nearCross = Math.min(mod, 40 - mod);
      if (nearCross < 1.2 && this.rng() < 0.03) {
        car.heading += this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        car.horizontal = !car.horizontal;
        if (car.horizontal) car.z = nearestStreet(car.z) + car.lane;
        else car.x = nearestStreet(car.x) + car.lane;
      }
      // Wrap around the city edge.
      if (car.x > 175) car.x = -175;
      if (car.x < -175) car.x = 175;
      if (car.z > 175) car.z = -175;
      if (car.z < -175) car.z = 175;
      car.syncMesh();
    }
  }
}

// --- Police: spawned by the wanted system, chase and ram the player. ---
export class PoliceCar extends Car {
  constructor(mesh, x, z, heading) {
    super(mesh, x, z, heading);
    this.flash = 0;
    this.bumpCooldown = 0;
  }
}

export function spawnPolice(scene, rng, x, z, heading) {
  const mesh = makeCarMesh(0xf5f5f5, true);
  scene.add(mesh);
  return new PoliceCar(mesh, x, z, heading);
}

export function updatePoliceCar(car, dt, tx, tz, onRam) {
  car.flash += dt;
  const on = Math.floor(car.flash * 6) % 2 === 0;
  if (car.mesh.userData.lightRed) {
    car.mesh.userData.lightRed.material.emissiveIntensity = on ? 2.2 : 0.15;
    car.mesh.userData.lightBlue.material.emissiveIntensity = on ? 0.15 : 2.2;
  }
  if (car.disabled > 0) {
    car.disabled -= dt;
    car.speed = THREE.MathUtils.lerp(car.speed, 0, Math.min(1, dt * 4));
    car.x += -Math.sin(car.heading) * car.speed * dt;
    car.z += -Math.cos(car.heading) * car.speed * dt;
    car.syncMesh();
    return;
  }
  const dx = tx - car.x, dz = tz - car.z;
  const dist = Math.hypot(dx, dz) || 1;
  const wantHeading = Math.atan2(-dx, -dz);
  let dh = wantHeading - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  car.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
  const targetSpeed = dist > 60 ? TUNE.policeSpeed : TUNE.policeSpeed * 0.85;
  car.speed = THREE.MathUtils.lerp(car.speed, targetSpeed, Math.min(1, dt * 1.2));
  car.x += -Math.sin(car.heading) * car.speed * dt;
  car.z += -Math.cos(car.heading) * car.speed * dt;
  car.bumpCooldown -= dt;
  if (dist < 4.6 && car.bumpCooldown <= 0) {
    car.bumpCooldown = 0.8;
    if (onRam) onRam(car);
  }
  car.syncMesh();
}
