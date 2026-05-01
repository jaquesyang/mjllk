class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    play(type, combo) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const t = this.ctx.currentTime;

        switch (type) {
            case 'click': {
                const o = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                o.connect(g); g.connect(this.ctx.destination);
                g.gain.setValueAtTime(0.08, t);
                o.frequency.setValueAtTime(800, t);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
                o.start(t); o.stop(t + 0.08);
                break;
            }
            case 'match': {
                const o = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                o.connect(g); g.connect(this.ctx.destination);
                g.gain.setValueAtTime(0.1, t);
                o.frequency.setValueAtTime(523.25, t);
                o.frequency.setValueAtTime(659.25, t + 0.1);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
                o.start(t); o.stop(t + 0.3);
                break;
            }
            case 'wrong': {
                const o = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                o.connect(g); g.connect(this.ctx.destination);
                o.type = 'sawtooth';
                o.frequency.setValueAtTime(150, t);
                g.gain.setValueAtTime(0.08, t);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
                o.start(t); o.stop(t + 0.4);
                break;
            }
            case 'win': {
                const o = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                o.connect(g); g.connect(this.ctx.destination);
                g.gain.setValueAtTime(0.15, t);
                o.frequency.setValueAtTime(523.25, t);
                o.frequency.setValueAtTime(659.25, t + 0.15);
                o.frequency.setValueAtTime(783.99, t + 0.3);
                o.frequency.setValueAtTime(1046.5, t + 0.45);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
                o.start(t); o.stop(t + 0.8);
                break;
            }
            case 'combo': {
                const c = Math.min(combo || 2, 10);
                const baseFreq = 400 + c * 60; // 音调随 combo 升高
                const voices = c >= 5 ? 3 : c >= 3 ? 2 : 1;

                for (let v = 0; v < voices; v++) {
                    const o = this.ctx.createOscillator();
                    const g = this.ctx.createGain();
                    o.connect(g); g.connect(this.ctx.destination);
                    o.type = v === 0 ? 'square' : v === 1 ? 'sawtooth' : 'triangle';
                    const freq = baseFreq + v * 120;
                    o.frequency.setValueAtTime(freq, t + v * 0.03);
                    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.15 + v * 0.02);
                    g.gain.setValueAtTime(0.06 - v * 0.02, t + v * 0.03);
                    g.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
                    o.start(t + v * 0.03); o.stop(t + 0.35);
                }
                break;
            }
        }
    }
}
