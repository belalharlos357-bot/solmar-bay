// Solmar Bay itself: a sun-soaked coastal city drawn as one ground texture
// (roads, sidewalks, beach, water) plus procedural buildings, palms, lamps and
// billboards. Returns collision boxes and road data the gameplay uses.
import { WORLD, STREETS } from './config.js';
import { pick, range, int } from './random.js';

const BUILDING_COLORS = [0xe8c9a0, 0xd9a06b, 0xc98f7a, 0x9fb8c8, 0xe6dcc8, 0xb8a88a, 0xd47f6a, 0x8fb8a8, 0xf0e0c0];
const HOTEL_COLORS = [0xf2e6c8, 0xe8b48a, 0xffffff, 0xffd9a0];

function makeWindowTexture(rng, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 256);
  const cols = int(rng, 4, 6), rows = int(rng, 8, 14);
  const cw = 128 / cols, ch = 256 / rows;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const warm = rng() < 0.24;
      g.fillStyle = warm ? (lit ? '#ffd98a' : '#7a6a4a') : (rng() < 0.5 ? '#2a3542' : '#3d4c5e');
      g.fillRect(x * cw + 3, y * ch + 4, cw - 6, ch - 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundTexture(rng) {
  const S = 1024; // canvas px; world 440 wide -> 2.327 px per unit
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  const px = (v) => (v + WORLD.half) / (WORLD.half * 2) * S;
  const sc = S / (WORLD.half * 2);
  // Base concrete / grass lots
  g.fillStyle = '#7d8a6a'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#8a8f7a';
  for (let i = 0; i < 40; i += 1) {
    g.fillRect(rng() * S, rng() * S, 40 + rng() * 120, 30 + rng() * 90);
  }
  // Beach sand (south)
  g.fillStyle = '#e8d5a0';
  g.fillRect(0, px(WORLD.beachZ), S, px(WORLD.half) - px(WORLD.beachZ));
  // Water (far south)
  const wg = g.createLinearGradient(0, px(WORLD.waterZ), 0, S);
  wg.addColorStop(0, '#2f9ec4'); wg.addColorStop(1, '#1668a0');
  g.fillStyle = wg;
  g.fillRect(0, px(WORLD.waterZ), S, S - px(WORLD.waterZ));
  g.strokeStyle = 'rgba(255,255,255,.45)';
  g.lineWidth = 2;
  for (let i = 0; i < 26; i += 1) {
    const y = px(WORLD.waterZ) + 6 + rng() * (S - px(WORLD.waterZ) - 10);
    g.beginPath(); g.moveTo(rng() * S, y); g.lineTo(rng() * S + 60, y); g.stroke();
  }
  // Sidewalks around every block
  g.fillStyle = '#b9b3a4';
  for (const sx of STREETS) for (const sz of STREETS) {
    g.fillRect(px(sx - 13.5), px(sz - 13.5), 27 * sc, 27 * sc);
  }
  // Roads
  g.fillStyle = '#33363d';
  for (const s of STREETS) {
    g.fillRect(0, px(s - 5), S, 10 * sc);
    g.fillRect(px(s - 5), 0, 10 * sc, S);
  }
  // Centre dashes
  g.fillStyle = '#d8c95a';
  for (const s of STREETS) {
    for (let v = -WORLD.half; v < WORLD.half; v += 8) {
      g.fillRect(px(v), px(s - 0.35), 4 * sc, 0.7 * sc);
      g.fillRect(px(s - 0.35), px(v), 0.7 * sc, 4 * sc);
    }
  }
  // Crosswalks at intersections
  g.fillStyle = 'rgba(255,255,255,.75)';
  for (const sx of STREETS) for (const sz of STREETS) {
    for (let k = -2; k <= 2; k += 1) {
      g.fillRect(px(sx + k * 1.8 - 0.5), px(sz - 5), 1 * sc, 2 * sc);
      g.fillRect(px(sx + k * 1.8 - 0.5), px(sz + 3), 1 * sc, 2 * sc);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function billboardTexture(text, sub, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 128);
  g.fillStyle = fg; g.font = 'bold 34px Verdana, sans-serif';
  g.textAlign = 'center'; g.fillText(text, 128, 56);
  g.font = '18px Verdana, sans-serif'; g.fillText(sub, 128, 92);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const city = { buildings: [], palms: [], lamps: [] };

  // Sky, sun, fog — late-afternoon, sun-soaked.
  scene.background = new THREE.Color(0x9fc4e8);
  scene.fog = new THREE.Fog(0xd8b48f, 180, 520);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(-140, 160, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x8a7a5a, 1.1));

  // Ground with the painted city map.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2, WORLD.half * 2),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Buildings: one or two per block, taller downtown and along the beach.
  const winTexA = makeWindowTexture(rng, true);
  const winTexB = makeWindowTexture(rng, false);
  const winTexC = makeWindowTexture(rng, true);
  const winTexs = [winTexA, winTexB, winTexC];
  const geoCache = new Map();
  function boxGeo(w, h, d) {
    const key = `${w}|${h}|${d}`;
    if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
    return geoCache.get(key);
  }
  for (const bx of STREETS) {
    for (const bz of STREETS) {
      if (bz > 170) continue; // beach blocks stay open
      const cx = bx + 20, cz = bz + 20; // block centre (streets are 40 apart)
      const downtown = Math.hypot(cx, cz);
      const beachfront = cz > 140;
      const n = rng() < 0.35 ? 2 : 1;
      for (let k = 0; k < n; k += 1) {
        const w = range(rng, 12, 20), d = range(rng, 12, 20);
        const ox = n === 2 ? (k === 0 ? -6 : 6) : 0;
        const oz = n === 2 ? (k === 0 ? 5 : -5) : 0;
        let h = range(rng, 8, 22);
        if (downtown < 70) h = range(rng, 22, 46);
        if (beachfront) h = range(rng, 18, 34);
        const color = beachfront ? pick(rng, HOTEL_COLORS) : pick(rng, BUILDING_COLORS);
        const mat = new THREE.MeshLambertMaterial({ color, map: pick(rng, winTexs) });
        const m = new THREE.Mesh(boxGeo(w, h, d), mat);
        m.position.set(cx + ox, h / 2, cz + oz);
        m.castShadow = true; m.receiveShadow = true;
        scene.add(m);
        // Rooftop box (AC unit / penthouse)
        if (rng() < 0.5) {
          const roof = new THREE.Mesh(boxGeo(w * 0.3, 2, d * 0.3),
            new THREE.MeshLambertMaterial({ color: 0x6a6a6a }));
          roof.position.set(cx + ox + range(rng, -3, 3), h + 1, cz + oz + range(rng, -3, 3));
          scene.add(roof);
        }
        city.buildings.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2, h });
      }
    }
  }

  // Palms along the avenues and the beachfront.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 6, 6);
  const leafGeo = new THREE.ConeGeometry(2.6, 3.2, 7);
  for (let i = 0; i < 90; i += 1) {
    const alongBeach = i < 24;
    let x, z;
    if (alongBeach) { x = -180 + i * 15 + range(rng, -4, 4); z = 176 + range(rng, -2, 2); }
    else {
      const s = pick(rng, STREETS);
      if (rng() < 0.5) { x = s + (rng() < 0.5 ? 6.5 : -6.5); z = range(rng, -160, 160); }
      else { z = s + (rng() < 0.5 ? 6.5 : -6.5); x = range(rng, -160, 160); }
    }
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3; trunk.castShadow = true;
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.y = 7; leaves.castShadow = true;
    palm.add(trunk, leaves);
    palm.position.set(x, 0, z);
    palm.rotation.y = rng() * Math.PI * 2;
    palm.rotation.z = range(rng, -0.08, 0.08);
    scene.add(palm);
    city.palms.push(palm);
  }

  // Street lamps.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const bulbMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 0.9 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 7, 6);
  const bulbGeo = new THREE.SphereGeometry(0.45, 8, 6);
  for (const sx of STREETS) for (const sz of STREETS) {
    if (rng() < 0.5) continue;
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 3.5;
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.y = 7.1;
    lamp.add(pole, bulb);
    lamp.position.set(sx + 6.8, 0, sz + 6.8);
    scene.add(lamp);
    city.lamps.push(lamp);
  }

  // Billboards with the city's own brands.
  const ads = [
    ['SOLMAR BAY', 'sun • speed • sin', '#1c2a4a', '#ffd166'],
    ['PALM COLA', 'taste the coast', '#a4133c', '#ffffff'],
    ['VICE MOTORS', 'drive it like you stole it', '#222222', '#7dff9a'],
    ['HOTEL MARLIN', 'rooms with a view', '#0f766e', '#ffe9a8'],
  ];
  const boardSpots = [[-40, -120, 0.4], [80, 40, -0.9], [-120, 120, 2.2], [120, -80, 1.4]];
  ads.forEach((ad, i) => {
    const [x, z, ry] = boardSpots[i];
    const board = new THREE.Group();
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 9),
      new THREE.MeshLambertMaterial({ map: billboardTexture(ad[0], ad[1], ad[2], ad[3]) }),
    );
    face.position.y = 12;
    const post = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 1), poleMat);
    post.position.y = 4;
    board.add(face, post);
    board.position.set(x, 0, z);
    board.rotation.y = ry;
    scene.add(board);
  });

  // Pier + docks props at the beach, in the gap between beachfront hotels.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 40), pierMat);
  pier.position.set(-80, 0.5, 205);
  pier.castShadow = true;
  scene.add(pier);
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xa8763e });
  const crateGeo = new THREE.BoxGeometry(2.4, 2.4, 2.4);
  for (let i = 0; i < 10; i += 1) {
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.set(range(rng, -84, -76), 1.2, range(rng, 190, 212));
    crate.rotation.y = rng() * Math.PI;
    crate.castShadow = true;
    scene.add(crate);
  }

  // Mission marker beacon (shared, moved by the mission system).
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  diamond.position.y = 8;
  beacon.add(beam, diamond);
  beacon.visible = false;
  scene.add(beacon);
  city.beacon = beacon;
  city.beaconDiamond = diamond;

  return city;
}

/** Push a circle (x,z,r) out of every building AABB it overlaps. Returns true on hit. */
export function collideBuildings(city, p, r) {
  let hit = false;
  for (const b of city.buildings) {
    if (p.x > b.minX - r && p.x < b.maxX + r && p.z > b.minZ - r && p.z < b.maxZ + r) {
      const dxl = p.x - (b.minX - r), dxr = (b.maxX + r) - p.x;
      const dzl = p.z - (b.minZ - r), dzr = (b.maxZ + r) - p.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) p.x = b.minX - r;
      else if (m === dxr) p.x = b.maxX + r;
      else if (m === dzl) p.z = b.minZ - r;
      else p.z = b.maxZ + r;
      hit = true;
    }
  }
  return hit;
}
