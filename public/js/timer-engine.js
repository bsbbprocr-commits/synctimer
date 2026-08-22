/**
 * Timer Engine & Server Clock Sync Module
 * Drift-free, requestAnimationFrame tabanlı zamanlama ve Web Audio API ses motoru
 */

class ServerClock {
  constructor(socket) {
    this.socket = socket;
    this.serverOffset = 0;
    this.isSynced = false;
    this.latency = 0;
  }

  sync() {
    if (!this.socket) return;
    const sendTime = Date.now();
    this.socket.emit('sync-time', sendTime);

    this.socket.once('sync-time-response', (data) => {
      const recvTime = Date.now();
      this.latency = Math.max(0, (recvTime - data.clientSendTime) / 2);
      this.serverOffset = data.serverTime - (data.clientSendTime + this.latency);
      this.isSynced = true;
      // Periyodik olarak 30 saniyede bir hafif sync tazele
      setTimeout(() => this.sync(), 30000);
    });
  }

  now() {
    return Date.now() + this.serverOffset;
  }
}

class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.enabled = true;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playBeep(freq = 440, type = 'sine', duration = 0.15, gain = 0.15) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gainNode.gain.setValueAtTime(gain, this.audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio kısıtlaması durumunda sessiz kal
    }
  }

  playStart() {
    this.playBeep(587.33, 'triangle', 0.1, 0.2); // D5
    setTimeout(() => this.playBeep(880, 'triangle', 0.18, 0.2), 100); // A5
  }

  playPause() {
    this.playBeep(659.25, 'sine', 0.12, 0.18); // E5
    setTimeout(() => this.playBeep(440, 'sine', 0.15, 0.18), 110); // A4
  }

  playReset() {
    this.playBeep(349.23, 'sine', 0.15, 0.18); // F4
  }

  playLap() {
    this.playBeep(783.99, 'triangle', 0.08, 0.18); // G5
  }

  playCountdownTick() {
    this.playBeep(523.25, 'sine', 0.08, 0.15); // C5
  }

  playAlarm() {
    const playChord = (delay, f1, f2) => {
      setTimeout(() => {
        this.playBeep(f1, 'sawtooth', 0.25, 0.2);
        this.playBeep(f2, 'sawtooth', 0.25, 0.2);
      }, delay);
    };

    // 3'lü güçlü alarm melodisi
    playChord(0, 880, 1174.66);
    playChord(300, 880, 1174.66);
    playChord(600, 880, 1174.66);
    playChord(1000, 987.77, 1318.51);
  }
}

class TimerEngine {
  constructor(serverClock, onTick, onFinish) {
    this.serverClock = serverClock;
    this.onTick = onTick || (() => {});
    this.onFinish = onFinish || (() => {});

    this.mode = 'stopwatch'; // 'stopwatch' | 'countdown'
    this.state = 'idle';     // 'idle' | 'running' | 'paused' | 'finished'
    this.startTimestamp = null;
    this.elapsedBeforePause = 0;
    this.countdownDuration = 300000; // 5 dk varsayılan

    this.rafId = null;
  }

  updateState(roomState) {
    if (!roomState) return;

    this.mode = roomState.mode || 'stopwatch';
    this.state = roomState.state || 'idle';
    this.startTimestamp = roomState.startTimestamp;
    this.elapsedBeforePause = roomState.elapsedBeforePause || 0;
    if (roomState.countdownDuration) {
      this.countdownDuration = roomState.countdownDuration;
    }

    this.checkLoop();
    this.tick(); // Anında arayüzü güncelle
  }

  startLoop() {
    if (this.rafId) return;
    const loop = () => {
      this.tick();
      if (this.state === 'running') {
        this.rafId = requestAnimationFrame(loop);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  checkLoop() {
    if (this.state === 'running') {
      if (!this.rafId) this.startLoop();
    } else {
      this.stopLoop();
      this.tick();
    }
  }

  getElapsed() {
    if (this.state === 'idle') {
      return 0;
    }
    let elapsed = this.elapsedBeforePause;
    if (this.state === 'running' && this.startTimestamp) {
      const now = this.serverClock.now();
      elapsed += Math.max(0, now - this.startTimestamp);
    }
    return elapsed;
  }

  tick() {
    const elapsed = this.getElapsed();

    if (this.mode === 'stopwatch') {
      const formatted = TimerEngine.formatTime(elapsed);
      this.onTick({
        formatted,
        rawMs: elapsed,
        mode: 'stopwatch',
        state: this.state,
        percent: 0
      });
    } else {
      // Countdown modu
      const remaining = Math.max(0, this.countdownDuration - elapsed);
      const percent = this.countdownDuration > 0 ? (remaining / this.countdownDuration) * 100 : 0;
      const formatted = TimerEngine.formatTime(remaining);

      // Süre bitti mi kontrolü
      if (this.state === 'running' && remaining <= 0) {
        this.state = 'finished';
        this.stopLoop();
        this.onFinish();
      }

      this.onTick({
        formatted,
        rawMs: remaining,
        mode: 'countdown',
        state: this.state,
        percent
      });
    }
  }

  static formatTime(ms) {
    if (isNaN(ms) || ms < 0) ms = 0;

    const totalSeconds = Math.floor(ms / 1000);
    const hundredths = Math.floor((ms % 1000) / 10);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    const pad = (n) => (n < 10 ? '0' + n : n.toString());

    return {
      hours: pad(hours),
      minutes: pad(minutes),
      seconds: pad(seconds),
      hundredths: pad(hundredths),
      fullString: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`,
      shortString: hours > 0 
        ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` 
        : `${pad(minutes)}:${pad(seconds)}`
    };
  }

  static parseDuration(hours, minutes, seconds) {
    const h = parseInt(hours, 10) || 0;
    const m = parseInt(minutes, 10) || 0;
    const s = parseInt(seconds, 10) || 0;
    return (h * 3600 + m * 60 + s) * 1000;
  }
}

// Global olarak tarayıcı ortamına sun
window.ServerClock = ServerClock;
window.TimerEngine = TimerEngine;
window.SoundEngine = SoundEngine;
