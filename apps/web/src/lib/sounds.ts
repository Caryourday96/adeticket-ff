import type { PublicState } from "@naija/contracts";

export type SoundCue = "buzz" | "reveal" | "strike" | "win" | "start" | "time";
// Consume only consecutive live updates. Loading, reconnecting, undo and admin edits stay silent.
export function soundCue(before: PublicState | null, next: PublicState): SoundCue | null {
  if (!before || before.id !== next.id || next.revision !== before.revision + 1) return null;
  switch (next.lastCommand) {
    case "buzz":
      return "buzz";
    case "miss":
      return next.roundWinner !== null ? "win" : "strike";
    case "answer":
      return next.roundWinner !== null && before.roundWinner === null ? "win" : "reveal";
    case "fastClock":
      return "start";
    case "fastEndTurn":
      // The server is authoritative for expiry. This covers a fast turn ending
      // between two client countdown ticks, when the local clock never observes 0.
      return before.fast?.stage === "running" && next.fast?.stage === "reveal" ? "time" : null;
    case "fastReveal": {
      if (!next.fast) return null;
      const p = next.fast.player;
      const answer = next.fast.entries[p][next.fast.revealed[p] - 1];
      return answer ? (answer.points > 0 ? "reveal" : "strike") : null;
    }
    default:
      return null;
  }
}

// Original synthesized cues. Keep the audience's feedback distinct without using show recordings.
type Tone = {
  at: number;
  frequency: number;
  duration: number;
  level: number;
  shape?: OscillatorType;
  end?: number;
};
const cues: Record<SoundCue, Tone[]> = {
  buzz: [
    { at: 0, frequency: 520, duration: 0.09, level: 0.7, shape: "square", end: 390 },
    { at: 0.1, frequency: 780, duration: 0.13, level: 0.55, shape: "square", end: 590 },
  ],
  reveal: [
    { at: 0, frequency: 587, duration: 0.13, level: 0.5 },
    { at: 0.11, frequency: 740, duration: 0.18, level: 0.65 },
    { at: 0.22, frequency: 988, duration: 0.31, level: 0.6 },
  ],
  strike: [
    { at: 0, frequency: 185, duration: 0.28, level: 0.8, shape: "sawtooth", end: 95 },
    { at: 0.19, frequency: 135, duration: 0.31, level: 0.55, shape: "sawtooth", end: 78 },
  ],
  win: [
    { at: 0, frequency: 523, duration: 0.18, level: 0.45 },
    { at: 0.14, frequency: 659, duration: 0.18, level: 0.5 },
    { at: 0.28, frequency: 784, duration: 0.18, level: 0.55 },
    { at: 0.43, frequency: 523, duration: 0.68, level: 0.38 },
    { at: 0.43, frequency: 659, duration: 0.68, level: 0.38 },
    { at: 0.43, frequency: 1047, duration: 0.68, level: 0.5 },
  ],
  start: [
    { at: 0, frequency: 660, duration: 0.11, level: 0.5 },
    { at: 0.14, frequency: 660, duration: 0.11, level: 0.5 },
    { at: 0.28, frequency: 880, duration: 0.2, level: 0.65 },
  ],
  time: [
    { at: 0, frequency: 330, duration: 0.22, level: 0.6, shape: "triangle", end: 220 },
    { at: 0.25, frequency: 247, duration: 0.22, level: 0.65, shape: "triangle", end: 165 },
    { at: 0.5, frequency: 165, duration: 0.48, level: 0.7, shape: "triangle", end: 110 },
  ],
};
export class GameAudio {
  private context: AudioContext | null = null;
  async enable() {
    this.context ??= new AudioContext();
    await this.context.resume();
    if (this.context.state !== "running")
      throw new Error("Sound is blocked. Enable sound on this screen.");
  }
  play(cue: SoundCue, volume: number) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running") return false;
    const level = Math.max(0, Math.min(1, volume)) * 0.09;
    cues[cue].forEach((tone) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      const start = ctx.currentTime + tone.at;
      oscillator.type = tone.shape ?? "sine";
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      if (tone.end)
        oscillator.frequency.exponentialRampToValueAtTime(tone.end, start + tone.duration);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(level * tone.level, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + tone.duration + 0.01);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
    return true;
  }
  close() {
    void this.context?.close();
    this.context = null;
  }
}
