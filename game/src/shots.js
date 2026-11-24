// Screenshot scenes behind ?shot=cover|street|chase|title. Each stages the
// real game (real city, traffic, police, HUD, minimap) into a fixed dramatic
// moment, then runs a short scripted simulation so wheels spin, peds walk and
// police close in — the frame is what a short game really looks like.
import { makeCarMesh, Car } from './vehicles.js';

function givePlayerCar(game, x, z, heading, color) {
  const mesh = makeCarMesh(color || 0xc0392b);
  game.scene.add(mesh);
  const car = new Car(mesh, x, z, heading);
  car.speed = 18;
  car.syncMesh();
  game.player.inCar = car;
  game.playerCar = car;
  game.parked.push(car);
  return car;
}

function driveFor(game, seconds, throttle = true) {
  const input = { f: throttle, b: false, l: false, r: false, sprint: false, heading: game.camYaw };
  for (let i = 0; i < seconds * 60; i += 1) game.update(1 / 60, input, true);
}

/** Police cars placed relative to the player's current spot, trailing behind. */
function policeTrail(game, offsets) {
  const p = game.player.pos;
  const h = game.player.headingNow;
  for (const [side, back] of offsets) {
    const x = p.x + Math.sin(h + Math.PI / 2) * side + Math.sin(h) * back;
    const z = p.z + Math.cos(h + Math.PI / 2) * side + Math.cos(h) * back;
    const car = game.wanted.spawnAt(x, z, h);
    car.speed = 22;
    car.syncMesh();
  }
}

export function stageShot(name, game) {
  const g = game;
  g.hideMenus();
  g.hud.show();
  g.state = 'playing';
  if (name === 'title') {
    // Title screen over a high city vista, looking south to the beach.
    g.showMenu();
    g.hud.hide();
    g.camMode = 'vista';
    g.camYaw = Math.PI; // look south
    g.camPitch = 0.55;
    g.camDist = 60;
    g.camTarget = { x: 0, z: -40 };
    g.player.x = 0; g.player.z = 40; g.player.heading = Math.PI;
    g.player.syncMesh();
    g.missions.skipTo(0);
    g.missions.start();
    driveFor(g, 0.5, false);
    g.hud.clearOverlays();
    return;
  }
  if (name === 'street') {
    // On foot at the docks, mission 2, package beacon glowing at the pier, peds strolling.
    g.missions.skipTo(1);
    g.missions.start();
    g.missions.objIdx = 1; // the collect step, beacon at the pier
    g.player.x = -80; g.player.z = 164; g.player.heading = 0; // facing the pier
    g.player.armed = true;
    g.player.syncMesh();
    // Bring a few walkers down to the docks so the pier is alive.
    const dockSpots = [[-76, 172, 0.3], [-84, 176, -0.5], [-74, 182, 1.2], [-86, 170, 2.4]];
    g.peds.peds.slice(0, 4).forEach((ped, i) => {
      ped.x = dockSpots[i][0]; ped.z = dockSpots[i][1]; ped.heading = dockSpots[i][2];
      ped.mesh.position.set(ped.x, 0, ped.z);
    });
    g.camMode = 'chase';
    g.camYaw = g.player.heading + Math.PI;
    g.camPitch = 0.22;
    g.camDist = 8;
    g.wanted.clear();
    driveFor(g, 1.2, false);
    g.hud.clearOverlays();
    return;
  }
  if (name === 'chase') {
    // Four stars, three police cars closing in on the player's car, seen from
    // a low rear angle so the pursuit fills the frame.
    g.missions.skipTo(2);
    g.missions.start();
    givePlayerCar(g, 0, 40, 0, 0x1a1a1a);
    g.wanted.setStars(4);
    g.camMode = 'chase';
    g.camYaw = 0.12;
    g.camPitch = 0.35;
    g.camDist = 14;
    driveFor(g, 1.5, true);
    // Flanking close behind the player car, inside the camera's view.
    policeTrail(g, [[-5, 4], [5, 5], [0, 7]]);
    driveFor(g, 0.3, true);
    g.hud.clearOverlays();
    return;
  }
  // cover (default): three stars, driving down the avenue toward the camera
  // with police in pursuit flanking behind and the mission beacon ahead on the minimap.
  g.missions.skipTo(0);
  g.missions.start();
  givePlayerCar(g, 0, 90, 0, 0xc0392b);
  g.wanted.setStars(3);
  g.camMode = 'chase';
  g.camYaw = Math.PI; // camera ahead, looking back at the car and its pursuit
  g.camPitch = 0.22;
  g.camDist = 11;
  driveFor(g, 1.5, true);
  // Police flanking just beyond the player car, in the camera's view.
  policeTrail(g, [[-3.5, 14], [3.5, 20]]);
  // A couple of traffic cars further back down the avenue for depth.
  const ahead = g.traffic.cars;
  if (ahead[0]) { ahead[0].x = 3.5; ahead[0].z = g.player.pos.z + 26; ahead[0].heading = 0; ahead[0].speed = 12; ahead[0].syncMesh(); }
  if (ahead[1]) { ahead[1].x = -3.5; ahead[1].z = g.player.pos.z + 36; ahead[1].heading = 0; ahead[1].speed = 12; ahead[1].syncMesh(); }
  // No more simulation after placing the pursuit: the frozen loop renders
  // this exact composition (a final drive would let the police close in and
  // hide behind the player car).
  g.hud.clearOverlays();
}
