class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    play(type) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.connect(g);
        g.connect(this.ctx.destination);
        const t = this.ctx.currentTime;
        g.gain.setValueAtTime(0.1, t);

        switch (type) {
            case 'click':
                o.frequency.setValueAtTime(800, t);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
                o.start(t);
                o.stop(t + 0.1);
                break;
            case 'match':
                o.frequency.setValueAtTime(523.25, t);
                o.frequency.setValueAtTime(659.25, t + 0.1);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
                o.start(t);
                o.stop(t + 0.3);
                break;
            case 'wrong':
                o.type = 'sawtooth';
                o.frequency.setValueAtTime(150, t);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
                o.start(t);
                o.stop(t + 0.4);
                break;
            case 'win':
                o.frequency.setValueAtTime(523.25, t);
                o.frequency.setValueAtTime(659.25, t + 0.2);
                o.frequency.setValueAtTime(783.99, t + 0.4);
                g.gain.setValueAtTime(0.2, t);
                g.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
                o.start(t);
                o.stop(t + 0.8);
                break;
        }
    }
}
