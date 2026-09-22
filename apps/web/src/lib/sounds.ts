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

// Original synthesized effects; no show recordings or external audio requests.
const notes: Record<SoundCue, number[]> = {
  buzz: [440, 660],
  reveal: [660, 880],
  strike: [140, 110],
  win: [523, 659, 784, 1047],
  start: [660, 880, 1100],
  time: [220, 165, 110],
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
    const level = Math.max(0, Math.min(1, volume)) * 0.12;
    notes[cue].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      const start = ctx.currentTime + index * 0.12;
      oscillator.type = cue === "strike" ? "sawtooth" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(level, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.23);
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
