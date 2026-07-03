/** Procedural sound effects via Web Audio API — no downloaded assets, so
 * nothing to license and nothing to keep in the repo. Mute state lives only
 * in this instance's field (no persistence, per spec). */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  /** Short blip on a successful swap. */
  swap(): void {
    this.playTone(440, 0.08, { type: "triangle", gain: 0.14 });
  }

  /** Low buzz on a rejected swap. */
  invalid(): void {
    this.playTone(130, 0.16, { type: "sawtooth", gain: 0.1 });
  }

  /** Clear pop — pitch rises with cascade depth (the classic "juicy" touch). */
  pop(cascadeStepNumber: number): void {
    const freq = 300 + (cascadeStepNumber - 1) * 90;
    this.playTone(freq, 0.13, { type: "square", gain: 0.11 });
  }

  /** Short ascending arpeggio. */
  win(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      this.playTone(freq, 0.18, { type: "sine", gain: 0.14, startDelay: i * 0.09 }),
    );
  }

  /** Short descending phrase. */
  lose(): void {
    [523.25, 415.3, 349.23].forEach((freq, i) =>
      this.playTone(freq, 0.22, { type: "triangle", gain: 0.13, startDelay: i * 0.12 }),
    );
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(
    frequency: number,
    duration: number,
    opts: { type?: OscillatorType; gain?: number; startDelay?: number } = {},
  ): void {
    if (this.muted) {
      return;
    }
    const ctx = this.getContext();
    const startTime = ctx.currentTime + (opts.startDelay ?? 0);
    const peakGain = opts.gain ?? 0.15;

    const oscillator = ctx.createOscillator();
    oscillator.type = opts.type ?? "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gainNode).connect(ctx.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }
}
