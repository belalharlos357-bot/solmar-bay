// Synthesised sound effects with WebAudio — no audio assets, everything is
// generated at run time. Safe to construct before a user gesture; the context
// resumes on the first key or click.
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: sawtooth through a low-pass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
      // Siren: square wave, two-tone wail, gain driven by police proximity.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 750;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      const sirenFilter = this.ctx.createBiquadFilter();
      sirenFilter.type = 'lowpass'; sirenFilter.frequency.value = 1400;
      this.sirenOsc.connect(sirenFilter).connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
    } catch { return false; }
    return true;
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  setEngine(speed01, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.075 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 165, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(280 + speed01 * 900, t, 0.1);
  }
  setSiren(on, dt) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenPhase += dt;
    const hi = Math.floor(this.sirenPhase * 1.6) % 2 === 0;
    this.sirenOsc.frequency.setTargetAtTime(hi ? 920 : 660, t, 0.05);
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, t, 0.2);
  }
  blip(freq, dur, type = 'sine', vol = 0.2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur);
  }
  noise(dur, vol, freq = 800) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
  shoot() { this.noise(0.12, 0.5, 2600); this.blip(180, 0.08, 'square', 0.12); }
  crash() { this.noise(0.25, 0.5, 300); this.blip(70, 0.2, 'sine', 0.3); }
  pickup() { this.blip(660, 0.12, 'sine', 0.22); setTimeout(() => this.blip(990, 0.18, 'sine', 0.22), 90); }
  mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.22), i * 110)); }
  busted() { this.blip(220, 0.5, 'sawtooth', 0.25); setTimeout(() => this.blip(165, 0.7, 'sawtooth', 0.25), 200); }
}
