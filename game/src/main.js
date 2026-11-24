// Solmar Bay — game orchestration: renderer, camera, input, driving physics,
// collisions, shooting, save/load, menus and the main loop.
import { WORLD, STREETS, TUNE, clamp, lerp, angleLerp } from './config.js';
import { mulberry32, pick, range } from './random.js';
import { SoundFX } from './audio.js';
import { buildCity, collideBuildings } from './city.js';
import { makeCarMesh, Car, Traffic } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Player } from './player.js';
import { MissionManager, MISSIONS } from './missions.js';
import { Wanted } from './wanted.js';
import { HUD } from './hud.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'solmarbay.save.v1';
const SEED = 1337;

class Game {
  constructor() {
    this.rng = mulberry32(SEED);
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 30, 60);

    this.city = buildCity(this.scene, this.rng);
    this.traffic = new Traffic(this.scene, this.rng, this.city, 14);
    this.peds = new Pedestrians(this.scene, this.rng, 18);
    this.player = new Player(this.scene);
    this.sfx = new SoundFX();
    this.hud = new HUD();
    this.wanted = new Wanted(this.scene, this.rng, (kind, d) => this.onWantedEvent(kind, d));
    this.missions = new MissionManager((kind, d) => this.onMissionEvent(kind, d));

    // Parked cars the player can steal.
    this.parked = [];
    const parkedSpots = [
      [40, 62, 0], [-80, -38, Math.PI / 2], [120, 82, -Math.PI / 2], [-40, -118, 0],
      [80, 158, Math.PI], [-120, 38, Math.PI / 2], [160, -82, 0], [0, -158, -Math.PI / 2],
    ];
    for (const [x, z, h] of parkedSpots) {
      const mesh = makeCarMesh(pick(this.rng, [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0xecf0f1, 0xe67e22]));
      this.scene.add(mesh);
      const car = new Car(mesh, x, z, h);
      car.syncMesh();
      this.parked.push(car);
    }
    this.playerCar = null;

    // Camera
    this.camYaw = Math.PI;
    this.camPitch = 0.28;
    this.camDist = 9;
    this.camMode = 'chase';
    this.camTarget = { x: 0, z: 30 };
    this.lastDrag = -10;
    this.time = 0;

    // Input
    this.keys = new Set();
    this.state = 'menu'; // menu | playing | paused | over
    this.frozen = false; // screenshot staging: render but don't simulate
    this.shotMode = null;
    this.saveTimer = 0;
    this.tracer = null;
    this.tracerTTL = 0;

    this.bindInput();
    this.bindMenus();
    this.loadSave();
    window.addEventListener('resize', () => this.onResize());

    // Screenshot staging: ?shot=cover|street|chase|title
    const shot = new URLSearchParams(window.location.search).get('shot');
    if (shot) {
      this.shotMode = shot;
      document.title = `Solmar Bay — shot ${shot}`;
      stageShot(shot, this);
      this.frozen = true;
      this.updateCamera(0, true);
      this.render();
      this.hud.drawMinimap(this, this.time);
      window.__shotReady = true;
    }
  }

  // ---------- input ----------
  bindInput() {
    const down = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.sfx.ensure();
      if (e.code === 'KeyE') this.tryEnterExitCar();
      if (e.code === 'KeyC') this.camDist = this.camDist > 10 ? 8 : 13;
      if (e.code === 'KeyM') this.sfx.setMuted(!this.sfx.muted);
      if (e.code === 'Enter' && this.state === 'playing' && !this.missions.active && !this.missions.done) this.missions.start();
      if (e.code === 'Escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (e.code === 'Space') e.preventDefault();
    };
    const up = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', () => this.keys.clear());

    let dragging = false, lx = 0, ly = 0, moved = 0;
    this.canvas.addEventListener('pointerdown', (e) => {
      dragging = true; lx = e.clientX; ly = e.clientY; moved = 0;
      this.sfx.ensure();
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      this.camYaw -= dx * 0.005;
      this.camPitch = clamp(this.camPitch + dy * 0.004, 0.06, 1.15);
      this.lastDrag = this.time;
    });
    window.addEventListener('pointerup', (e) => {
      if (dragging && moved < 6 && this.state === 'playing' && !this.player.inCar) this.shoot();
      dragging = false;
    });
    this.canvas.addEventListener('wheel', (e) => {
      this.camDist = clamp(this.camDist * (1 + e.deltaY * 0.001), 5, 22);
      e.preventDefault();
    }, { passive: false });
  }
  readInput() {
    const k = this.keys;
    return {
      f: k.has('KeyW') || k.has('ArrowUp'),
      b: k.has('KeyS') || k.has('ArrowDown'),
      l: k.has('KeyA') || k.has('ArrowLeft'),
      r: k.has('KeyD') || k.has('ArrowRight'),
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      brake: k.has('Space'),
      heading: this.camYaw,
    };
  }

  // ---------- menus / save ----------
  bindMenus() {
    document.getElementById('btnStart').addEventListener('click', () => this.startGame(false));
    document.getElementById('btnContinue').addEventListener('click', () => this.startGame(true));
    document.getElementById('btnResume').addEventListener('click', () => this.resume());
    document.getElementById('btnRestart').addEventListener('click', () => {
      localStorage.removeItem(SAVE_KEY);
      window.location.reload();
    });
    document.getElementById('btnRespawn').addEventListener('click', () => this.respawn());
  }
  showMenu() { document.getElementById('menu').classList.remove('hidden'); }
  hideMenus() {
    for (const id of ['menu', 'pauseMenu', 'overMenu']) document.getElementById(id).classList.add('hidden');
  }
  startGame(useSave) {
    this.sfx.ensure();
    this.hideMenus();
    this.hud.show();
    this.state = 'playing';
    this.camMode = 'chase';
    this.camDist = 9;
    this.camPitch = 0.28;
    this.camYaw = this.player.heading + Math.PI;
    this.updateCamera(0, true);
    if (useSave) this.applySave();
    else {
      this.player.cash = 500;
      this.missions.start();
    }
    this.hud.setCash(this.player.cash);
    this.hud.toast('Welcome to Solmar Bay — the story has begun.');
  }
  pause() {
    this.state = 'paused';
    document.getElementById('pauseMenu').classList.remove('hidden');
  }
  resume() {
    this.state = 'playing';
    document.getElementById('pauseMenu').classList.add('hidden');
  }
  gameOver(kind) {
    this.state = 'over';
    this.sfx.busted();
    const title = document.getElementById('overTitle');
    const text = document.getElementById('overText');
    if (kind === 'busted') {
      title.textContent = 'BUSTED';
      text.textContent = 'The Solmar PD caught up with you. Bail set at $200.';
      this.player.cash = Math.max(0, this.player.cash - 200);
    } else {
      title.textContent = 'WASTED';
      text.textContent = 'You got flatlined. The crew patched you up for $300.';
      this.player.cash = Math.max(0, this.player.cash - 300);
    }
    this.wanted.clear();
    this.player.health = TUNE.healthMax;
    document.getElementById('overMenu').classList.remove('hidden');
    this.save();
  }
  respawn() {
    document.getElementById('overMenu').classList.add('hidden');
    if (this.player.inCar) { this.parked.push(this.player.inCar); this.player.inCar = null; this.playerCar = null; }
    this.player.x = -120; this.player.z = 80; this.player.heading = 0;
    this.player.syncMesh();
    this.camYaw = 0;
    this.state = 'playing';
    this.hud.setCash(this.player.cash);
    this.save();
  }
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.player.cash, missionIdx: this.missions.missionIdx,
        objIdx: this.missions.objIdx, done: this.missions.done,
        x: this.player.x, z: this.player.z, health: this.player.health,
      }));
    } catch { /* storage unavailable — play on without saving */ }
  }
  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      this.savedData = JSON.parse(raw);
      if (this.savedData && (this.savedData.cash > 0 || this.savedData.missionIdx > 0)) {
        document.getElementById('btnContinue').classList.remove('hidden');
      }
    } catch { this.savedData = null; }
  }
  applySave() {
    const s = this.savedData;
    if (!s) return;
    this.player.cash = s.cash ?? 500;
    this.player.health = s.health ?? TUNE.healthMax;
    this.player.x = s.x ?? 0; this.player.z = s.z ?? 30;
    this.player.syncMesh();
    if (s.done) { this.missions.skipTo(MISSIONS.length); }
    else {
      this.missions.skipTo(s.missionIdx || 0);
      this.missions.objIdx = s.objIdx || 0;
      this.missions.active = true;
    }
  }

  // ---------- events ----------
  onMissionEvent(kind, d) {
    if (kind === 'briefing') this.hud.banner(d.title, d.text, 4200);
    else if (kind === 'objective') this.hud.toast(`New objective: ${d.text}`);
    else if (kind === 'reward') {
      this.player.cash += d.amount;
      this.hud.setCash(this.player.cash);
      this.hud.banner('MISSION COMPLETE', `+$${d.amount.toLocaleString('en-US')}  •  ${d.title}`, 3600);
      this.sfx.mission();
      this.save();
    } else if (kind === 'failed') this.hud.toast(d.text, 4000);
    else if (kind === 'setWanted') this.wanted.setStars(d.stars);
    else if (kind === 'clearWanted') { this.wanted.clear(); this.hud.toast('You lost the heat.'); }
    else if (kind === 'storyComplete') {
      this.hud.banner('STORY COMPLETE', 'Solmar Bay is yours — free roam, keep the stack growing.', 5000);
      this.sfx.mission();
      this.save();
    }
  }
  onWantedEvent(kind, d) {
    if (kind === 'wanted' && d.stars >= 2) this.hud.toast(`Wanted level ${d.stars} — Solmar PD is on you!`, 3000);
  }

  // ---------- cars ----------
  nearestCar(x, z, maxD) {
    let best = null, bestD = maxD * maxD;
    const consider = (car) => {
      const dx = car.x - x, dz = car.z - z, d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = car; }
    };
    for (const c of this.parked) consider(c);
    for (const c of this.traffic.cars) consider(c);
    return best;
  }
  tryEnterExitCar() {
    if (this.state !== 'playing') return;
    const p = this.player;
    if (p.inCar) {
      const car = p.inCar;
      p.inCar = null; this.playerCar = null;
      p.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.4;
      p.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.4;
      p.heading = car.heading;
      p.syncMesh();
      this.parked.push(car);
      return;
    }
    const car = this.nearestCar(p.x, p.z, 4.5);
    if (!car) { this.hud.toast('No car close by.'); return; }
    const ti = this.traffic.cars.indexOf(car);
    if (ti >= 0) this.traffic.cars.splice(ti, 1);
    const pi = this.parked.indexOf(car);
    if (pi >= 0) this.parked.splice(pi, 1);
    p.inCar = car; this.playerCar = car;
    p.syncMesh();
    this.sfx.blip(320, 0.1, 'triangle', 0.15);
    if (this.missions.objective && this.missions.objective.type === 'steal') {
      this.wanted.addHeat(15, 'Grand theft auto');
      this.hud.toast('Stolen! The owner called it in — wanted level up.', 3000);
    }
  }

  // ---------- shooting ----------
  shoot() {
    const p = this.player;
    if (p.shotCooldown > 0 || p.inCar) return;
    p.shotCooldown = TUNE.shotCooldown;
    this.sfx.shoot();
    p.armed = true;
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    let best = null, bestD = 55;
    const test = (x, y, z, kind, ref) => {
      const dx = x - origin.x, dy = y - origin.y, dz = z - origin.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > bestD || d < 1) return;
      const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
      if (dot > 0.995) { bestD = d; best = { kind, ref, x, y, z }; }
    };
    for (const ped of this.peds.peds) if (ped.down <= 0) test(ped.x, 1.2, ped.z, 'ped', ped);
    for (const car of this.wanted.police) test(car.x, 1.0, car.z, 'police', car);
    for (const car of this.traffic.cars) test(car.x, 1.0, car.z, 'traffic', car);
    const end = best ? new THREE.Vector3(best.x, best.y, best.z) : origin.clone().add(dir.clone().multiplyScalar(50));
    // Tracer line.
    if (this.tracer) this.scene.remove(this.tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    this.scene.add(this.tracer);
    this.tracerTTL = 0.09;
    if (best) {
      if (best.kind === 'ped') {
        this.peds.knockDown(best.ref);
        this.wanted.addHeat(25, 'Assault');
        this.hud.toast('Pedestrian down! The heat is on you.', 2600);
      } else if (best.kind === 'police') {
        best.ref.disabled = 8;
        this.wanted.addHeat(10, 'Attacking police');
        this.hud.toast('Police car disabled!');
      } else {
        this.hud.toast('You shot a civilian car — bad idea.');
        this.wanted.addHeat(8, 'Property damage');
      }
    }
  }

  // ---------- per-frame ----------
  update(dt, input, scripted = false) {
    this.time += dt;
    const p = this.player;
    p.shotCooldown = Math.max(0, p.shotCooldown - dt);

    // Driving.
    if (p.inCar) {
      const car = p.inCar;
      const steerInput = (input.l ? 1 : 0) - (input.r ? 1 : 0);
      const moving = Math.abs(car.speed) > 0.5;
      if (moving) car.heading += steerInput * TUNE.carTurn * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 8);
      if (input.f) car.speed += TUNE.carAccel * dt;
      if (input.b) car.speed -= (car.speed > 1 ? TUNE.carBrake : TUNE.carAccel * 0.55) * dt;
      if (input.brake) car.speed = lerp(car.speed, 0, Math.min(1, dt * 6));
      if (!input.f && !input.b) car.speed = lerp(car.speed, 0, Math.min(1, dt * 0.9));
      car.speed = clamp(car.speed, -TUNE.carReverse, TUNE.carTopSpeed);
      car.x += -Math.sin(car.heading) * car.speed * dt;
      car.z += -Math.cos(car.heading) * car.speed * dt;
      car.x = clamp(car.x, -205, 205);
      car.z = clamp(car.z, -205, 212);
      if (collideBuildings(this.city, car, 2.2)) {
        if (Math.abs(car.speed) > 12) { this.sfx.crash(); this.damagePlayer(4); }
        car.speed *= 0.35;
      }
      // Camera follows the car (not during scripted screenshot staging).
      if (!scripted && this.time - this.lastDrag > 2) this.camYaw = angleLerp(this.camYaw, car.heading, Math.min(1, dt * 1.1));
      car.syncMesh();
      this.sfx.setEngine(Math.abs(car.speed) / TUNE.carTopSpeed, true);
      // Hit peds?
      if (Math.abs(car.speed) > 5) {
        const ped = this.peds.nearest(car.x, car.z, 2.6);
        if (ped) {
          this.peds.knockDown(ped);
          this.wanted.addHeat(20, 'Hit a pedestrian');
          this.sfx.crash();
          this.hud.toast('You hit a pedestrian! Wanted level up.', 2600);
          car.speed *= 0.7;
        }
      }
      // Bump traffic / police.
      this.bumpCars(car);
    } else {
      p.stepOnFoot(dt, input, (pl, r) => collideBuildings(this.city, pl, r));
      this.sfx.setEngine(0, false);
      // Traffic can clip the player on foot.
      for (const c of this.traffic.cars) {
        if (Math.hypot(c.x - p.x, c.z - p.z) < 2.2 && Math.abs(c.speed) > 3) {
          this.damagePlayer(10);
          p.x += (p.x - c.x) * 0.6; p.z += (p.z - c.z) * 0.6;
        }
      }
    }

    // World life.
    this.traffic.update(dt, this.playerCar);
    this.peds.update(dt, this.playerCar ? { x: this.playerCar.x, z: this.playerCar.z, speed: this.playerCar.speed } : null);
    this.wanted.update(dt, p,
      (car) => { // police ram
        if (p.inCar) {
          this.damagePlayer(6);
          p.inCar.speed *= 0.55;
          this.sfx.crash();
          this.hud.flashDamage();
        }
      },
      () => this.gameOver('busted'),
    );
    // Police slide around buildings instead of driving through them.
    for (const car of this.wanted.police) {
      collideBuildings(this.city, car, 2.2);
      car.syncMesh();
    }

    // Missions + beacon.
    const bp = this.missions.beaconPos();
    if (bp) {
      this.city.beacon.visible = true;
      this.city.beacon.position.set(bp[0], 0, bp[1]);
      this.city.beaconDiamond.rotation.y += dt * 2;
      this.city.beaconDiamond.position.y = 8 + Math.sin(this.time * 3) * 0.7;
    } else {
      this.city.beacon.visible = false;
    }
    this.missions.update(dt, { player: p, inCar: !!p.inCar, pos: p.pos });
    p.heal(dt, this.wanted.stars);

    // Tracer fade.
    if (this.tracer) {
      this.tracerTTL -= dt;
      if (this.tracerTTL <= 0) { this.scene.remove(this.tracer); this.tracer = null; }
    }

    // HUD.
    const st = this.missions.statusText();
    let distText = '';
    if (bp) {
      const d = Math.hypot(p.pos.x - bp[0], p.pos.z - bp[1]);
      distText = `${Math.round(d)}m`;
      if (this.missions.objective && this.missions.objective.type === 'holdout') {
        distText += `  •  HOLD ${Math.max(0, Math.ceil(this.missions.objective.seconds - this.missions.holdout))}s`;
      }
      if (this.missions.mission && this.missions.mission.timeLimit) {
        distText += `  •  ${Math.max(0, Math.ceil(this.missions.mission.timeLimit - this.missions.timer))}s left`;
      }
    }
    this.hud.setMission(st.title, st.text, distText);
    this.hud.setStars(this.wanted.stars);
    this.hud.setHealth(p.health / TUNE.healthMax);
    this.hud.setSpeed(p.inCar ? Math.abs(p.inCar.speed) * 3.6 : 0, !!p.inCar);
    this.hud.setCrosshair(!p.inCar && this.state === 'playing');
    this.hud.drawMinimap(this, this.time);
    this.sfx.setSiren(this.wanted.stars >= 2 && this.wanted.police.length > 0, dt);

    // Autosave.
    this.saveTimer += dt;
    if (this.saveTimer > 10) { this.saveTimer = 0; if (this.state === 'playing') this.save(); }

    if (p.health <= 0 && this.state === 'playing') this.gameOver('wasted');
  }

  bumpCars(car) {
    const all = [...this.traffic.cars, ...this.wanted.police];
    for (const other of all) {
      const dx = car.x - other.x, dz = car.z - other.z;
      const d = Math.hypot(dx, dz);
      if (d < 4.4 && d > 0.01) {
        const push = (4.4 - d) / 2;
        const nx = dx / d, nz = dz / d;
        car.x += nx * push; car.z += nz * push;
        other.x -= nx * push; other.z -= nz * push;
        if (Math.abs(car.speed) > 8) {
          this.sfx.crash();
          this.damagePlayer(3);
          if (this.wanted.police.includes(other)) this.wanted.addHeat(10, 'Hit a police car');
          car.speed *= 0.6;
        }
        other.syncMesh();
      }
    }
  }

  damagePlayer(n) {
    const p = this.player;
    if (this.state !== 'playing') return;
    p.health = Math.max(0, p.health - n);
    this.hud.flashDamage();
  }

  // ---------- camera & render ----------
  updateCamera(dt, snap = false) {
    const p = this.player;
    let tx, tz, ty;
    if (this.camMode === 'vista') { tx = this.camTarget.x; tz = this.camTarget.z; ty = 4; }
    else { tx = p.pos.x; tz = p.pos.z; ty = 1.4; }
    const dist = this.camDist * (p.inCar ? 1.15 : 1);
    const dx = tx + Math.sin(this.camYaw) * dist * Math.cos(this.camPitch);
    const dz = tz + Math.cos(this.camYaw) * dist * Math.cos(this.camPitch);
    const dy = ty + 1.2 + Math.sin(this.camPitch) * dist;
    if (snap) {
      this.camera.position.set(dx, dy, dz);
    } else {
      const k = 1 - Math.exp(-10 * dt);
      this.camera.position.x = lerp(this.camera.position.x, dx, k);
      this.camera.position.y = lerp(this.camera.position.y, dy, k);
      this.camera.position.z = lerp(this.camera.position.z, dz, k);
    }
    this.camera.lookAt(tx, ty + 1.0, tz);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  loop() {
    let last = performance.now();
    const step = () => {
      requestAnimationFrame(step);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (this.state === 'menu') {
        // Slow orbit over the city behind the title screen.
        this.time += dt;
        this.camMode = 'vista';
        this.camTarget = { x: 0, z: 0 };
        this.camYaw += dt * 0.03;
        this.camPitch = 0.5;
        this.camDist = 120;
        this.traffic.update(dt, null);
        this.peds.update(dt, null);
        this.updateCamera(dt);
        this.render();
        return;
      }
      if (this.state === 'playing' && !this.frozen) {
        this.update(dt, this.readInput());
        this.updateCamera(dt);
        this.render();
      } else if (this.state === 'playing' && this.frozen) {
        // Staged screenshot: keep the frame, only spin the beacon.
        if (this.city.beacon.visible) {
          this.city.beaconDiamond.rotation.y += dt * 2;
          this.city.beaconDiamond.position.y = 8 + Math.sin(this.time * 3) * 0.7;
          this.time += dt;
        }
        this.updateCamera(dt, true);
        this.render();
      } else {
        // paused / over: render the frozen frame.
        this.render();
      }
    };
    this.clock = null;
    requestAnimationFrame(step);
  }
}

const game = new Game();
window.__game = game; // exposed for debugging and automated play-testing
game.loop();
