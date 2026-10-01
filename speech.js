/* One voice per visit. Resume the audio context inside the camera-button gesture. */
window.RobotSpeech = {
  context: null, buffer: null, cues: null, source: null,
  offset: 0, startedAt: 0, finished: false, loading: null,
  unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return Promise.reject(new Error('הדפדפן אינו תומך בקול. פתח ב-Chrome או ב-Safari.'));
    if (!this.context) this.context = new AudioContext();
    const resumed = this.context.resume();
    // A silent sample inside this gesture unlocks audio output on iOS too.
    const silent = this.context.createBufferSource();
    silent.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
    silent.connect(this.context.destination);
    silent.start();
    return Promise.all([resumed, this.load()]);
  },
  load() {
    if (this.buffer && this.cues) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const [audioResponse, cueResponse] = await Promise.all([
        fetch('./assets/robot-voice.mp3?v=31'),
        fetch('./assets/robot-voice-cues.json?v=31')
      ]);
      if (!audioResponse.ok || !cueResponse.ok) throw new Error('לא ניתן לטעון את ההקלטה. נסה שוב.');
      const [buffer, cues] = await Promise.all([
        audioResponse.arrayBuffer().then(bytes => this.context.decodeAudioData(bytes)),
        cueResponse.json()
      ]);
      this.buffer = buffer;
      this.cues = cues;
    })().catch(error => { this.loading = null; throw error; });
    return this.loading;
  },
  play() {
    if (!this.buffer || this.source || this.finished || this.context.state !== 'running') return false;
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.context.destination);
    this.startedAt = this.context.currentTime - this.offset;
    this.source = source;
    source.onended = () => {
      source.disconnect();
      if (this.source !== source) return;
      this.source = null;
      this.offset = this.buffer.duration;
      this.finished = true;
    };
    source.start(0, this.offset);
    return true;
  },
  position() {
    return this.source ? Math.min(this.context.currentTime - this.startedAt, this.buffer.duration) : this.offset;
  },
  pause() {
    if (!this.source) return;
    this.offset = this.position();
    const source = this.source;
    this.source = null;
    source.stop();
  },
  level() {
    if (!this.source || !this.cues || this.context.state !== 'running') return 0;
    const at = this.position() * this.cues.sampleRate;
    const index = Math.floor(at), mix = at - index;
    const a = this.cues.levels[index] || 0;
    const b = this.cues.levels[index + 1] || 0;
    return a + (b - a) * mix;
  }
};
