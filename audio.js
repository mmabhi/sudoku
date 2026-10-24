// Web Audio API Synthesizer for Game Sound Effects (Zero external audio files needed)

class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch(e) {}
  }

  playFlip() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.15);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 0.15);
      filter.Q.setValueAtTime(3, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch(e) {}
  }

  playTraitorSting() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const freqs = [110, 116.54, 155.56, 233.08];
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = i === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(f * 0.96, now + 1.2);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 1.2);
      });

      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(80, now);
      sub.frequency.exponentialRampToValueAtTime(30, now + 1.5);
      subGain.gain.setValueAtTime(0.3, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      sub.connect(subGain);
      subGain.connect(this.ctx.destination);
      sub.start(now);
      sub.stop(now + 1.5);
    } catch(e) {}
  }

  playInnocentChime() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.50];
      notes.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const delay = i * 0.08;
        osc.frequency.setValueAtTime(f, now + delay);

        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(0.15, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.0);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 1.0);
      });
    } catch(e) {}
  }

  playCellClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(560, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.03);
    } catch(e) {}
  }

  playNumberPlaced(num) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const baseFreq = 320 + (num || 1) * 35;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch(e) {}
  }

  playVictory() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // Majestic triumphant fanfare: C5, E5, G5, C6
      const fanfare = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      fanfare.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const start = now + i * 0.12;
        osc.frequency.setValueAtTime(f, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + (i === fanfare.length - 1 ? 1.5 : 0.35));
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + (i === fanfare.length - 1 ? 1.5 : 0.35));
      });
    } catch(e) {}
  }

  playRaceLost() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // Soft gentle two-tone chime to announce race winner without sounding harsh
      const notes = [440, 349.23];
      notes.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const start = now + i * 0.16;
        osc.frequency.setValueAtTime(f, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch(e) {}
  }

  playPuzzleComplete() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [392.00, 523.25, 659.25, 783.99];
      notes.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const start = now + i * 0.1;
        osc.frequency.setValueAtTime(f, start);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.8);
      });
    } catch(e) {}
  }

  playError() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch(e) {}
  }
}

window.soundFx = new SoundFX();
