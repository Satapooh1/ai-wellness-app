import { useState, useRef, useCallback } from 'react';

const SOUND_CONFIGS = {
  rain: {
    // Procedurally generated rain using Web Audio API
    type: 'noise',
    label: 'Rain',
    filterFreq: 800,
    gainValue: 0.08,
  },
  white_noise: {
    type: 'noise',
    label: 'White Noise',
    filterFreq: 3000,
    gainValue: 0.06,
  },
  nature: {
    type: 'noise',
    label: 'Nature',
    filterFreq: 500,
    gainValue: 0.07,
  },
};

export function useSmartEnvironment() {
  const [isActive, setIsActive] = useState(false);
  const [lightMode, setLightMode] = useState(null);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const audioCtxRef = useRef(null);
  const noiseNodeRef = useRef(null);
  const gainNodeRef = useRef(null);

  const createNoise = useCallback((audioCtx, config) => {
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = config.filterFreq;

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0;

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Fade in
    gainNode.gain.linearRampToValueAtTime(config.gainValue, audioCtx.currentTime + 2);

    source.start();
    return { source, gainNode };
  }, []);

  const activate = useCallback((persona) => {
    setIsActive(true);
    setLightMode(persona.smart_home.light_mode);

    // Start audio
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const soundTheme = persona.smart_home.sound_theme;
      const config = SOUND_CONFIGS[soundTheme] || SOUND_CONFIGS.white_noise;
      const { source, gainNode } = createNoise(audioCtx, config);

      noiseNodeRef.current = source;
      gainNodeRef.current = gainNode;
      setSoundPlaying(true);
    } catch (e) {
      console.warn('Audio not available:', e);
    }
  }, [createNoise]);

  const toggleSound = useCallback(() => {
    if (!gainNodeRef.current || !audioCtxRef.current) return;
    const currentGain = gainNodeRef.current.gain.value;
    if (currentGain > 0) {
      gainNodeRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.5);
      setSoundPlaying(false);
    } else {
      gainNodeRef.current.gain.linearRampToValueAtTime(0.07, audioCtxRef.current.currentTime + 0.5);
      setSoundPlaying(true);
    }
  }, []);

  const deactivate = useCallback(() => {
    setIsActive(false);
    setLightMode(null);
    if (noiseNodeRef.current) {
      try { noiseNodeRef.current.stop(); } catch (_) { /* ignore */ }
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
    setSoundPlaying(false);
  }, []);

  return { isActive, lightMode, soundPlaying, activate, deactivate, toggleSound };
}
