/**
 * Lightweight "ting" notification chime synthesised with the Web Audio API.
 * No asset file required — works offline, low latency, fully under user control.
 *
 * Browsers block audio until the user interacts with the page at least once,
 * so we lazily resume the AudioContext when play() is called.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Play a soft two-note "ting" — a quick bright bell-like tone that's pleasant,
 * professional, and obvious without being startling.
 */
export function playTing(volume = 0.18) {
  const audio = getCtx();
  if (!audio) return;
  // Resume if suspended by autoplay policy
  if (audio.state === "suspended") {
    audio.resume().catch(() => {});
  }

  const now = audio.currentTime;
  const master = audio.createGain();
  master.gain.value = volume;
  master.connect(audio.destination);

  const tones = [
    { freq: 1318.51, start: 0, duration: 0.35 }, // E6
    { freq: 1760.0, start: 0.08, duration: 0.45 }, // A6
  ];

  for (const t of tones) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = t.freq;
    // Soft attack-decay envelope for a bell-like tone
    gain.gain.setValueAtTime(0, now + t.start);
    gain.gain.linearRampToValueAtTime(1, now + t.start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.duration);
    osc.connect(gain).connect(master);
    osc.start(now + t.start);
    osc.stop(now + t.start + t.duration + 0.05);
  }
}

const STORAGE_KEY = "autoserve.notifSound";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "off";
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
}
