function randn(mean = 0, std = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round1(value) {
  return parseFloat(value.toFixed(1));
}

function pickScenario(persona) {
  const stress = persona.metrics.stress_level;
  if (stress >= 70) {
    return {
      name: 'Evening stress spike',
      trigger: 'work stress + late screen time',
      startHrBoost: 8,
      startBreath: 15.2,
      startStressBoost: 10,
      targetHrDrop: 20,
      targetStressDrop: 52,
      targetHrvGain: 20,
    };
  }

  if (stress >= 45) {
    return {
      name: 'Restless wind-down',
      trigger: 'mental load before sleep',
      startHrBoost: 4,
      startBreath: 14.2,
      startStressBoost: 6,
      targetHrDrop: 14,
      targetStressDrop: 34,
      targetHrvGain: 14,
    };
  }

  return {
    name: 'Sleep readiness tuning',
    trigger: 'fine-tuning calm environment',
    startHrBoost: 2,
    startBreath: 13.2,
    startStressBoost: 4,
    targetHrDrop: 8,
    targetStressDrop: 18,
    targetHrvGain: 10,
  };
}

export class SensorSimulator {
  constructor(persona) {
    this.scenario = pickScenario(persona);

    this.hr = clamp(persona.metrics.heart_rate_avg + this.scenario.startHrBoost, 52, 112);
    this.breath = this.scenario.startBreath;
    this.stress = clamp(persona.metrics.stress_level + this.scenario.startStressBoost, 18, 92);
    this.spo2 = 96.8;
    this.hrv = clamp(persona.metrics.hrv - 4, 18, 70);

    this.baseline = {
      hr: Math.round(this.hr),
      breath: round1(this.breath),
      stress: Math.round(this.stress),
      spo2: round1(this.spo2),
      hrv: Math.round(this.hrv),
    };

    this.target = {
      hr: clamp(this.hr - this.scenario.targetHrDrop, 50, 66),
      breath: 6.2,
      stress: clamp(this.stress - this.scenario.targetStressDrop, 8, 28),
      spo2: 98.4,
      hrv: clamp(this.hrv + this.scenario.targetHrvGain, 32, 82),
    };

    this.tickMs = 3500;
    this.elapsed = 0;
    this.listeners = [];
    this._timer = null;
  }

  _phase() {
    if (this.elapsed < 18) {
      return {
        key: 'detect',
        label: 'Stress spike detected',
        agentState: 'reading sensors',
        progress: 0.12,
        speed: 0.012,
      };
    }

    if (this.elapsed < 70) {
      return {
        key: 'adjust',
        label: 'Smart home adjusting',
        agentState: 'lights + speaker syncing',
        progress: 0.42,
        speed: 0.04,
      };
    }

    if (this.elapsed < 150) {
      return {
        key: 'recover',
        label: 'Recovery trend',
        agentState: 'monitoring response',
        progress: 0.72,
        speed: 0.026,
      };
    }

    return {
      key: 'ready',
      label: 'Sleep-ready state',
      agentState: 'maintaining environment',
      progress: 0.94,
      speed: 0.018,
    };
  }

  _drift(current, target, speed, noise) {
    return current + (target - current) * speed + randn(0, noise);
  }

  tick() {
    this.elapsed += this.tickMs / 1000;
    const phase = this._phase();
    const recovery = clamp((this.elapsed - 18) / 150, 0, 1);

    const targetHr = phase.key === 'detect'
      ? this.baseline.hr + 2
      : this.target.hr;
    const targetStress = phase.key === 'detect'
      ? this.baseline.stress + 2
      : this.target.stress;
    const targetBreath = phase.key === 'detect'
      ? this.baseline.breath + 0.4
      : this.target.breath;
    const targetHrv = phase.key === 'detect'
      ? this.baseline.hrv - 2
      : this.target.hrv;

    const circadianWave = Math.sin(this.elapsed / 22) * 0.35;
    const microArousal = this.elapsed > 95 && this.elapsed < 110 ? 1.8 : 0;

    this.hr = clamp(this._drift(this.hr, targetHr, phase.speed, 0.45) + microArousal, 44, 120);
    this.breath = clamp(this._drift(this.breath, targetBreath, phase.speed * 0.8, 0.12), 4.5, 20);
    this.stress = clamp(this._drift(this.stress, targetStress, phase.speed, 0.9) + microArousal * 0.8, 0, 100);
    this.spo2 = clamp(this._drift(this.spo2, this.target.spo2, 0.018, 0.05), 92, 100);
    this.hrv = clamp(this._drift(this.hrv, targetHrv, phase.speed * 0.75, 0.65) + circadianWave, 16, 90);

    const snapshot = {
      hr: Math.round(this.hr),
      breath: round1(this.breath),
      stress: Math.round(this.stress),
      spo2: round1(this.spo2),
      hrv: Math.round(this.hrv),
      elapsed: this.elapsed,
      phase: phase.key,
      phaseLabel: phase.label,
      agentState: phase.agentState,
      progress: phase.progress,
      scenarioName: this.scenario.name,
      scenarioTrigger: this.scenario.trigger,
      baseline: this.baseline,
      impact: {
        hrDelta: this.baseline.hr - Math.round(this.hr),
        stressDelta: this.baseline.stress - Math.round(this.stress),
        hrvDelta: Math.round(this.hrv) - this.baseline.hrv,
        recovery: Math.round(recovery * 100),
      },
    };

    this.listeners.forEach(fn => fn(snapshot));
    return snapshot;
  }

  start(onTick) {
    if (onTick) this.listeners.push(onTick);
    this._timer = setInterval(() => this.tick(), this.tickMs);
    setTimeout(() => this.tick(), 100);
    return this;
  }

  stop() {
    clearInterval(this._timer);
    this.listeners = [];
  }

  subscribe(fn) {
    this.listeners.push(fn);
  }
}
