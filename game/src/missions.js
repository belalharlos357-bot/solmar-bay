// The story: "The Solmar Job" — five missions across the city, each a short
// chain of objectives (steal a car, reach a place, collect, escape, deliver).
// The manager moves the beacon, reports progress and pays out on completion.
export const MISSIONS = [
  {
    id: 'wheels-up', title: 'MISSION 1 · WHEELS UP',
    briefing: 'The crew needs wheels. Steal a car off the street and bring it to the garage on Marlin Ave.',
    reward: 800,
    objectives: [
      { type: 'steal', text: 'Steal a car — walk up to one and press E' },
      { type: 'goto', pos: [120, -40], radius: 9, text: 'Drive the car to the garage (yellow beacon)' },
    ],
  },
  {
    id: 'the-pickup', title: 'MISSION 2 · THE PICKUP',
    briefing: 'A package is waiting at the docks. Go on foot — the pier is too tight for a car.',
    reward: 1200,
    objectives: [
      { type: 'goto', pos: [-80, 176], radius: 8, text: 'Reach the docks at the south pier' },
      { type: 'collect', pos: [-80, 186], radius: 4, text: 'Walk into the glowing package to grab it' },
    ],
  },
  {
    id: 'heat-wave', title: 'MISSION 3 · HEAT WAVE',
    briefing: 'The drop went loud. Solmar PD is on you — lose them and get to the safehouse on Coral St.',
    reward: 1500, setWanted: 2,
    objectives: [
      { type: 'escape', pos: [-120, 80], radius: 10, text: 'Reach the safehouse — the heat dies when you get there' },
    ],
  },
  {
    id: 'the-long-drop', title: 'MISSION 4 · THE LONG DROP',
    briefing: 'The buyer is across town and the clock is ticking. Ninety seconds. Don\'t stop for anyone.',
    reward: 2200, timeLimit: 90,
    objectives: [
      { type: 'timed', pos: [160, -160], radius: 9, text: 'Deliver the package to the north-east penthouse' },
    ],
  },
  {
    id: 'solmar-nights', title: 'MISSION 5 · SOLMAR NIGHTS',
    briefing: 'One last score: the penthouse vault on Ocean Drive. Get inside, hold the roof for 20 seconds while the crew cracks it.',
    reward: 5000, setWanted: 3,
    objectives: [
      { type: 'goto', pos: [40, 150], radius: 8, text: 'Reach the penthouse on Ocean Drive' },
      { type: 'holdout', pos: [40, 150], radius: 12, seconds: 20, text: 'Hold the roof — survive the police for 20 seconds' },
    ],
  },
];

export class MissionManager {
  constructor(onEvent) {
    this.onEvent = onEvent; // (kind, data) — toast, banner, reward, wanted, complete
    this.missionIdx = 0;
    this.objIdx = 0;
    this.timer = 0;
    this.holdout = 0;
    this.done = false;
    this.active = false;
  }
  get mission() { return MISSIONS[this.missionIdx] || null; }
  get objective() {
    const m = this.mission;
    return m ? m.objectives[this.objIdx] : null;
  }
  start() {
    this.active = true;
    this.objIdx = 0; this.timer = 0; this.holdout = 0; this.done = false;
    const m = this.mission;
    this.onEvent('briefing', { title: m.title, text: m.briefing });
    if (m.setWanted) this.onEvent('setWanted', { stars: m.setWanted });
  }
  skipTo(idx) { // for save loading / testing
    this.missionIdx = idx; this.objIdx = 0; this.timer = 0; this.holdout = 0;
    this.active = idx < MISSIONS.length; this.done = idx >= MISSIONS.length;
  }
  /** Returns the beacon position for the current objective, or null. */
  beaconPos() {
    const o = this.objective;
    if (!o || !this.active) return null;
    if (o.type === 'steal') return null;
    return o.pos;
  }
  update(dt, ctx) {
    // ctx: {player, inCar, pos:{x,z}, onSteal}
    if (!this.active || this.done) return;
    const m = this.mission, o = this.objective;
    if (!o) return;
    if (m.timeLimit) {
      this.timer += dt;
      if (this.timer > m.timeLimit) {
        this.onEvent('failed', { text: 'Too slow — the buyer walked. Try the mission again.' });
        this.objIdx = 0; this.timer = 0;
        return;
      }
    }
    const p = ctx.pos;
    const d = o.pos ? Math.hypot(p.x - o.pos[0], p.z - o.pos[1]) : Infinity;
    switch (o.type) {
      case 'steal':
        if (ctx.inCar) this.advance(ctx);
        break;
      case 'goto':
      case 'collect':
      case 'timed':
        if (o.type === 'collect' && ctx.inCar) break; // must be on foot
        if (d < o.radius) this.advance(ctx);
        break;
      case 'escape':
        if (d < o.radius) {
          this.onEvent('clearWanted', {});
          this.advance(ctx);
        }
        break;
      case 'holdout':
        if (d < o.radius) {
          this.holdout += dt;
          if (this.holdout >= o.seconds) this.advance(ctx);
        } else {
          this.holdout = Math.max(0, this.holdout - dt * 2);
        }
        break;
      default:
        break;
    }
  }
  advance(ctx) {
    const m = this.mission;
    this.objIdx += 1;
    this.timer = 0; this.holdout = 0;
    if (this.objIdx >= m.objectives.length) {
      this.onEvent('reward', { amount: m.reward, title: m.title });
      this.missionIdx += 1;
      this.objIdx = 0;
      if (this.missionIdx >= MISSIONS.length) {
        this.done = true; this.active = false;
        this.onEvent('storyComplete', {});
      } else {
        const nm = this.mission;
        this.onEvent('briefing', { title: nm.title, text: nm.briefing });
        if (nm.setWanted) this.onEvent('setWanted', { stars: nm.setWanted });
      }
    } else {
      this.onEvent('objective', { text: this.objective.text });
    }
  }
  /** HUD text for the current objective. */
  statusText() {
    if (this.done) return { title: 'STORY COMPLETE', text: 'Solmar Bay is yours. Free roam — keep the stack growing.' };
    if (!this.active) return { title: 'FREE ROAM', text: 'Explore the city. Press Enter to start the story.' };
    const o = this.objective;
    return { title: this.mission.title, text: o.text };
  }
}
