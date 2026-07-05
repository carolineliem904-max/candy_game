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

  /** Short blip on a successful swap — pitched up and shortened for
   * SLICE 7's cuter vehicle theme. */
  swap(): void {
    this.playTone(560, 0.06, { type: "triangle", gain: 0.14 });
  }

  /** Low buzz on a rejected swap. */
  invalid(): void {
    this.playTone(150, 0.14, { type: "sawtooth", gain: 0.1 });
  }

  /** Clear pop — pitch rises with cascade depth (the classic "juicy" touch). */
  pop(cascadeStepNumber: number): void {
    const freq = 380 + (cascadeStepNumber - 1) * 100;
    this.playTone(freq, 0.1, { type: "square", gain: 0.11 });
  }

  /** Short ascending arpeggio. */
  win(): void {
    [659.25, 783.99, 987.77, 1318.5].forEach((freq, i) =>
      this.playTone(freq, 0.15, { type: "sine", gain: 0.14, startDelay: i * 0.08 }),
    );
  }

  /** Short descending phrase. */
  lose(): void {
    [587.33, 466.16, 392.0].forEach((freq, i) =>
      this.playTone(freq, 0.18, { type: "triangle", gain: 0.13, startDelay: i * 0.1 }),
    );
  }

  /** Quick rising "whoosh" for a striped vehicle's lane sweep. */
  striped(): void {
    this.playSweep(600, 1050, 0.13, { type: "sawtooth", gain: 0.12 });
  }

  /** Low "boom" for a wrapped vehicle's puff-cloud burst. */
  wrapped(): void {
    this.playTone(170, 0.2, { type: "sine", gain: 0.2 });
    this.playTone(260, 0.14, { type: "triangle", gain: 0.12, startDelay: 0.03 });
  }

  /** Bigger dramatic boom for the traffic-light bomb's board-wide clear. */
  bomb(): void {
    this.playTone(100, 0.26, { type: "sawtooth", gain: 0.2 });
    this.playSweep(800, 140, 0.22, { type: "square", gain: 0.1, startDelay: 0.02 });
  }

  /** A soft two-note "beep beep" car-horn honk when a special candy is
   * created — replaces the old plain sparkle per SLICE 7's theme pass. */
  specialCreated(): void {
    [740, 740].forEach((freq, i) =>
      this.playTone(freq, 0.08, { type: "square", gain: 0.12, startDelay: i * 0.13 }),
    );
  }

  /** A quick wet "splat" for jelly clearing — a short downward pitch glide,
   * distinct from the drier candy `pop()`. */
  jellySplat(): void {
    this.playSweep(500, 220, 0.14, { type: "sine", gain: 0.16 });
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

  /** Like playTone, but the frequency glides from `from` to `to` — used for
   * the striped "whoosh" and the bomb's descending sweep. */
  private playSweep(
    from: number,
    to: number,
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
    oscillator.frequency.setValueAtTime(from, startTime);
    oscillator.frequency.linearRampToValueAtTime(to, startTime + duration);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gainNode).connect(ctx.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }
}
