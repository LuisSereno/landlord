type FeedbackKind = "accepted" | "rejected" | "saved";

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContextConstructor = globalThis.AudioContext;
  if (!AudioContextConstructor) return null;
  audioContext = new AudioContextConstructor();
  return audioContext;
}

/** Small original UI cues; no external audio source is loaded or persisted. */
export async function playFeedback(kind: FeedbackKind) {
  const context = getAudioContext();
  if (!context) return;
  await context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  const frequency = kind === "rejected" ? 160 : kind === "saved" ? 520 : 380;
  oscillator.type = kind === "rejected" ? "sawtooth" : "triangle";
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(
    kind === "rejected" ? 110 : frequency * 1.25,
    now + 0.09,
  );
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.13);
}
