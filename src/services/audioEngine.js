/**
 * Hybrid Audio Engine v3
 * Organic (Rain/Ocean/Forest) → Sample files + Web Audio processing
 * Neurological (Binaural/Delta) → Pure oscillator synthesis
 */

// ─── Sample Loader ────────────────────────────────────────────────────────────
async function loadSample(ctx, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sample not found: ${url}`);
  const ab = await res.arrayBuffer();
  return ctx.decodeAudioData(ab);
}

function loopSource(ctx, buf) {
  const s = ctx.createBufferSource();
  s.buffer = buf; s.loop = true;
  return s;
}

// ─── Synthesis Noise Buffers (fallback) ──────────────────────────────────────
function makeWhite(ctx, sec = 4) {
  const n = ctx.sampleRate * sec;
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function makeBrown(ctx, sec = 4) {
  const n = ctx.sampleRate * sec;
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let l = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    d[i] = l = (l + 0.02 * w) / 1.02;
    d[i] *= 3.8;
  }
  return b;
}

function makePink(ctx, sec = 4) {
  const n = ctx.sampleRate * sec;
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
    b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
    b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
    d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
    b6 = w * 0.115926;
  }
  return b;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌧 RAIN — Sample + highpass/lowpass shaping, drop AM
// ─────────────────────────────────────────────────────────────────────────────
async function buildRain(ctx, master) {
  const nodes = [];
  let mainSrc;

  try {
    const buf = await loadSample(ctx, '/sounds/rain.mp3');
    mainSrc = loopSource(ctx, buf);
    // Shape: remove extreme lows (rumble), keep naturalistic mid-high
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 80;
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass';  lpf.frequency.value = 8000;
    const g   = ctx.createGain(); g.gain.value = 0.9;
    mainSrc.connect(hpf); hpf.connect(lpf); lpf.connect(g); g.connect(master);
    mainSrc.start(); nodes.push(mainSrc);
  } catch (_) {
    // Fallback: synthesis
    const wb  = makeWhite(ctx, 4);
    const bb  = makeBrown(ctx, 4);

    const heavy = loopSource(ctx, wb);
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 300;
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass';  lpf.frequency.value = 6000;
    const g   = ctx.createGain(); g.gain.value = 0.45;
    heavy.connect(hpf); hpf.connect(lpf); lpf.connect(g); g.connect(master);
    heavy.start(); nodes.push(heavy);

    // Drop pitter-patter
    const drop = loopSource(ctx, wb);
    const dbp  = ctx.createBiquadFilter(); dbp.type = 'bandpass'; dbp.frequency.value = 3500; dbp.Q.value = 1.5;
    const dg   = ctx.createGain(); dg.gain.value = 0.18;
    const dlfo = ctx.createOscillator(); dlfo.type = 'square'; dlfo.frequency.value = 9;
    const dlg  = ctx.createGain(); dlg.gain.value = 0.15;
    dlfo.connect(dlg); dlg.connect(dg.gain);
    drop.connect(dbp); dbp.connect(dg); dg.connect(master);
    drop.start(); dlfo.start(); nodes.push(drop, dlfo);

    // Thunder
    const thud  = loopSource(ctx, bb);
    const tlpf  = ctx.createBiquadFilter(); tlpf.type = 'lowpass'; tlpf.frequency.value = 90;
    const tg    = ctx.createGain(); tg.gain.value = 0.5;
    const tlfo  = ctx.createOscillator(); tlfo.type = 'sine'; tlfo.frequency.value = 0.04;
    const tlg   = ctx.createGain(); tlg.gain.value = 0.35;
    tlfo.connect(tlg); tlg.connect(tg.gain);
    thud.connect(tlpf); tlpf.connect(tg); tg.connect(master);
    thud.start(); tlfo.start(); nodes.push(thud, tlfo);
  }

  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌊 OCEAN WAVES — Sample/Synth + LFO controls BOTH gain AND filter freq
//   Wave crash → gain↑ + filter.freq↑ (bright, open)
//   Wave recede → gain↓ + filter.freq↓ (dark, muffled)
// ─────────────────────────────────────────────────────────────────────────────
async function buildOcean(ctx, master) {
  const nodes = [];
  let waveSrc;

  const buildWaveGraph = (src) => {
    // ── Lowpass filter — frequency will be modulated by LFO ──
    const lpf  = ctx.createBiquadFilter();
    lpf.type   = 'lowpass';
    lpf.frequency.value = 800; // center freq (gets modulated ±700)
    lpf.Q.value = 0.8;

    // ── Gain node — modulated by LFO ──
    const wg = ctx.createGain(); wg.gain.value = 0.05; // starts quiet

    // ── Single LFO (0.08Hz ≈ 12.5 sec cycle) drives BOTH ──
    const lfo  = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.08;

    // LFO → Gain: DC offset 0.35 + sine 0.3 → gain swings 0.05–0.65
    const dc_g = ctx.createConstantSource(); dc_g.offset.value = 0.35;
    const lg   = ctx.createGain(); lg.gain.value = 0.3;
    dc_g.connect(wg.gain); lfo.connect(lg); lg.connect(wg.gain);

    // LFO → Filter frequency: center 800 + sine 700 → freq swings 100–1500
    //   (wave crash = 1500 Hz "bright"; wave pull back = 100 Hz "muffled")
    const lf   = ctx.createGain(); lf.gain.value = 700;
    lfo.connect(lf); lf.connect(lpf.frequency);

    src.connect(lpf); lpf.connect(wg); wg.connect(master);
    src.start(); lfo.start(); dc_g.start();

    // ── Deep rumble underneath ──
    const bb  = makeBrown(ctx, 8);
    const sub = loopSource(ctx, bb);
    const slpf = ctx.createBiquadFilter(); slpf.type = 'lowpass'; slpf.frequency.value = 60;
    const sg   = ctx.createGain(); sg.gain.value = 0.28;
    sub.connect(slpf); slpf.connect(sg); sg.connect(master);
    sub.start();

    nodes.push(src, lfo, dc_g, sub);
  };

  try {
    const buf = await loadSample(ctx, '/sounds/ocean.mp3');
    waveSrc = loopSource(ctx, buf);
    buildWaveGraph(waveSrc);
  } catch (_) {
    // Fallback: brown noise
    const bb = makeBrown(ctx, 8);
    waveSrc  = loopSource(ctx, bb);
    buildWaveGraph(waveSrc);
  }

  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌿 FOREST — Sample + bird synthesis overlay
// ─────────────────────────────────────────────────────────────────────────────
async function buildForest(ctx, master) {
  const nodes = [];

  try {
    const buf  = await loadSample(ctx, '/sounds/forest.mp3');
    const src  = loopSource(ctx, buf);
    const lpf  = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 5000;
    const g    = ctx.createGain(); g.gain.value = 0.8;
    src.connect(lpf); lpf.connect(g); g.connect(master);
    src.start(); nodes.push(src);
  } catch (_) {
    // Fallback synthesis
    const pb  = makePink(ctx, 6);
    const wind = loopSource(ctx, pb);
    const wbp = ctx.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 1200; wbp.Q.value = 0.4;
    const wg  = ctx.createGain(); wg.gain.value = 0.22;
    const wlfo= ctx.createOscillator(); wlfo.type = 'sine'; wlfo.frequency.value = 0.07;
    const wlg = ctx.createGain(); wlg.gain.value = 0.1;
    wlfo.connect(wlg); wlg.connect(wg.gain);
    wind.connect(wbp); wbp.connect(wg); wg.connect(master);
    wind.start(); wlfo.start(); nodes.push(wind, wlfo);
  }

  // ── Bird song overlay — synthesis always ──
  const BIRDS = [
    [1800, 2200, 1600], [2400, 2000], [1200, 1400, 1200], [3000, 2500, 3000],
  ];
  let alive = true;
  function chirp() {
    if (!alive) return;
    const pat  = BIRDS[Math.floor(Math.random() * BIRDS.length)];
    const wait = 2500 + Math.random() * 7000;
    setTimeout(() => {
      if (!alive) return;
      let t = ctx.currentTime;
      pat.forEach(freq => {
        const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
        osc.frequency.setValueAtTime(freq * 0.88, t);
        osc.frequency.linearRampToValueAtTime(freq, t + 0.14);
        const env = ctx.createGain(); env.gain.value = 0;
        osc.connect(env); env.connect(master);
        osc.start(t);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.06, t + 0.02);
        env.gain.linearRampToValueAtTime(0, t + 0.14);
        osc.stop(t + 0.16);
        t += 0.13;
      });
      chirp();
    }, wait);
  }
  chirp();
  nodes.push({ stop: () => { alive = false; } });

  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎧 BINAURAL BEATS — Pure Synthesis (stereo, precise frequency)
//   Left 180Hz + Right 184Hz = 4Hz Theta beat (relaxation)
// ─────────────────────────────────────────────────────────────────────────────
function buildBinaural(ctx, master) {
  const nodes = [];
  const merger = ctx.createChannelMerger(2);
  merger.connect(master);

  // Left ear
  const oscL = ctx.createOscillator(); oscL.type = 'sine'; oscL.frequency.value = 180;
  const gL   = ctx.createGain(); gL.gain.value = 0.24;
  oscL.connect(gL); gL.connect(merger, 0, 0);

  // Right ear (184Hz → 4Hz beat)
  const oscR = ctx.createOscillator(); oscR.type = 'sine'; oscR.frequency.value = 184;
  const gR   = ctx.createGain(); gR.gain.value = 0.24;
  oscR.connect(gR); gR.connect(merger, 0, 1);

  // Singing bowl harmonics (180, 360, 540 Hz — adds warmth)
  [180, 360, 540].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = 0.05 / (i + 1);
    o.connect(g); g.connect(master); o.start(); nodes.push(o);
  });

  // Soft pink noise bed for presence
  const pb  = makePink(ctx, 4);
  const bed = loopSource(ctx, pb);
  const blpf= ctx.createBiquadFilter(); blpf.type = 'lowpass'; blpf.frequency.value = 300;
  const bg  = ctx.createGain(); bg.gain.value = 0.04;
  bed.connect(blpf); blpf.connect(bg); bg.connect(master);
  bed.start();

  oscL.start(); oscR.start();
  nodes.push(oscL, oscR, bed);
  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌙 DEEP SLEEP — Pure Synthesis
//   40Hz Gamma pulse (Alzheimer's research) + ultra-slow Brown noise
// ─────────────────────────────────────────────────────────────────────────────
function buildDeepSleep(ctx, master) {
  const nodes = [];

  // Ultra-deep brown noise through double lowpass (<100Hz)
  const bb  = makeBrown(ctx, 10);
  const src = loopSource(ctx, bb);
  const lp1 = ctx.createBiquadFilter(); lp1.type = 'lowpass'; lp1.frequency.value = 150;
  const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 80;
  const g   = ctx.createGain(); g.gain.value = 0.12;

  // Very slow swell (7 sec cycle)
  const lfo  = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.143;
  const lfog = ctx.createGain(); lfog.gain.value = 0.1;
  const dc   = ctx.createConstantSource(); dc.offset.value = 0.1;
  dc.connect(g.gain); lfo.connect(lfog); lfog.connect(g.gain);
  src.connect(lp1); lp1.connect(lp2); lp2.connect(g); g.connect(master);
  src.start(); lfo.start(); dc.start(); nodes.push(src, lfo, dc);

  // 40Hz Gamma tone — sub-perceptual but neurologically active
  const gamma  = ctx.createOscillator(); gamma.type = 'sine'; gamma.frequency.value = 40;
  const gammag = ctx.createGain(); gammag.gain.value = 0.03;
  // Pulse gamma at 0.5Hz for gentle beat feel
  const plfo  = ctx.createOscillator(); plfo.type = 'sine'; plfo.frequency.value = 0.5;
  const plfog = ctx.createGain(); plfog.gain.value = 0.025;
  plfo.connect(plfog); plfog.connect(gammag.gain);
  gamma.connect(gammag); gammag.connect(master);
  gamma.start(); plfo.start(); nodes.push(gamma, plfo);

  return nodes;
}

// ─── Theme Registry ───────────────────────────────────────────────────────────
export const SOUND_THEMES = {
  rain:       { label: 'Rain',          icon: 'fa-cloud-rain', builder: buildRain,      type: 'organic' },
  ocean:      { label: 'Ocean',     icon: 'fa-water',      builder: buildOcean,     type: 'organic' },
  forest:     { label: 'Forest',       icon: 'fa-tree',       builder: buildForest,    type: 'organic' },
  binaural:   { label: 'Binaural Beats', icon: 'fa-headphones', builder: buildBinaural,  type: 'neurological' },
  deep_sleep: { label: 'Deep Sleep',     icon: 'fa-moon',       builder: buildDeepSleep, type: 'neurological' },
};

// ─── AudioEngine Class ────────────────────────────────────────────────────────
export class AudioEngine {
  constructor() {
    this.ctx = null; this.masterGain = null; this.nodes = []; this.running = false;
  }

  async start(theme = 'rain', volumePct = 50) {
    this.stop();
    await new Promise(r => setTimeout(r, 60));
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') await this.ctx.resume();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);

      const cfg = SOUND_THEMES[theme] ?? SOUND_THEMES.rain;
      // builder may be async (sample loading) or sync (synthesis)
      this.nodes = await Promise.resolve(cfg.builder(this.ctx, this.masterGain));
      this.running = true;

      const target = (volumePct / 100) * 0.8;
      this.masterGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 2);
    } catch (e) {
      console.warn('AudioEngine.start:', e);
    }
  }

  setVolume(pct) {
    if (!this.masterGain || !this.ctx || !this.running) return;
    const t = (pct / 100) * 0.8;
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(t, this.ctx.currentTime + 0.4);
  }

  stop() {
    this.running = false;
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.6);
      } catch (_) {}
    }
    const snap = [...this.nodes]; const ctxSnap = this.ctx;
    this.nodes = []; this.ctx = null; this.masterGain = null;
    setTimeout(() => {
      snap.forEach(n => { try { n.stop?.(); } catch (_) {} });
      try { ctxSnap?.close(); } catch (_) {}
    }, 700);
  }
}
