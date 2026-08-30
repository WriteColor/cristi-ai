/**
 * Cristi AI - Real-Time Audio Signal & Vocal Dynamics Analyzer
 * Extracts multi-band FFT features, RMS energy, spectral centroid (viseme mouth form),
 * and speech rhythm impulses to drive organic Live2D avatar behaviors.
 */

import { eventBus, EVENTS } from './eventBus';

export class AudioAnalysisService {
  constructor(audioContext, sourceNode = null) {
    this.audioContext = audioContext;
    this.sourceNode = sourceNode;

    // Analyser Node setup
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.25; // Quick response for speech

    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainData = new Uint8Array(this.analyser.fftSize);

    this.isRunning = false;
    this.animationFrameId = null;

    // Filtered / smoothed outputs
    this.smoothedVolume = 0;
    this.smoothedMouthOpen = 0;
    this.smoothedMouthForm = 0;
    this.lastSpeechActivityTime = 0;
    this.isSpeaking = false;

    // Rhythmic nod impulse accumulator
    this.energyHistory = [];
    this.maxEnergyHistory = 15;
  }

  /**
   * Connect an audio source node (e.g. gainNode or bufferSource) to the analyser
   * @param {AudioNode} sourceNode 
   */
  connectSource(sourceNode) {
    this.sourceNode = sourceNode;
    try {
      this.sourceNode.connect(this.analyser);
    } catch (e) {
      console.warn('[AudioAnalysis] Could not connect source node to analyser:', e);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.analyzeLoop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.smoothedVolume = 0;
    this.smoothedMouthOpen = 0;
    this.smoothedMouthForm = 0;
    this.isSpeaking = false;
  }

  analyzeLoop = () => {
    if (!this.isRunning) return;

    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getByteTimeDomainData(this.timeDomainData);

    const metrics = this.computeMetrics();

    // Emit analysis event on EventBus
    eventBus.emit(EVENTS.AUDIO_ANALYSIS, metrics);

    this.animationFrameId = requestAnimationFrame(this.analyzeLoop);
  };

  computeMetrics() {
    const binCount = this.frequencyData.length; // 256 bins for fftSize 512
    const sampleRate = this.audioContext.sampleRate; // usually 24000 or 48000
    const binWidth = (sampleRate / 2) / binCount;

    // 1. Time-domain RMS Volume calculation
    let sumSquares = 0;
    for (let i = 0; i < this.timeDomainData.length; i++) {
      const normalized = (this.timeDomainData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rawRms = Math.sqrt(sumSquares / this.timeDomainData.length);
    const volume = Math.min(Math.max(rawRms * 2.8, 0), 1);

    // Exponential smoothing for smooth mouth animation
    const attack = 0.65;
    const decay = 0.25;
    if (volume > this.smoothedVolume) {
      this.smoothedVolume = this.smoothedVolume + (volume - this.smoothedVolume) * attack;
    } else {
      this.smoothedVolume = this.smoothedVolume + (volume - this.smoothedVolume) * decay;
    }

    // 2. Multi-band frequency breakdown (Bass / Speech Formants / Treble)
    let lowEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;
    let totalWeightedFreq = 0;
    let totalFreqEnergy = 0;

    for (let i = 0; i < binCount; i++) {
      const freq = i * binWidth;
      const mag = this.frequencyData[i] / 255;

      totalFreqEnergy += mag;
      totalWeightedFreq += freq * mag;

      if (freq < 400) {
        lowEnergy += mag;
      } else if (freq < 2800) {
        midEnergy += mag; // Core vowel formant range
      } else {
        highEnergy += mag; // Sibilance and bright consonants
      }
    }

    // Normalize bands
    const lowBand = lowEnergy / Math.max(1, Math.floor(400 / binWidth));
    const midBand = midEnergy / Math.max(1, Math.floor(2400 / binWidth));
    const highBand = highEnergy / Math.max(1, binCount - Math.floor(2800 / binWidth));

    // 3. Spectral Centroid for Viseme / Mouth Shape (ParamMouthForm: -1.0 narrow to +1.0 wide/smile)
    const spectralCentroid = totalFreqEnergy > 0.05 ? totalWeightedFreq / totalFreqEnergy : 1000;
    // Maps ~800Hz (O/U) to -0.6 and ~2500Hz+ (A/I/E) to +0.8
    const rawMouthForm = Math.min(Math.max((spectralCentroid - 1400) / 1100, -1), 1);
    this.smoothedMouthForm = this.smoothedMouthForm + (rawMouthForm - this.smoothedMouthForm) * 0.15;

    // 4. Proportional Mouth Opening (non-linear boost for speech clarity)
    const rawMouthOpen = Math.pow(this.smoothedVolume, 0.75) * 1.35;
    this.smoothedMouthOpen = Math.min(Math.max(rawMouthOpen, 0), 1);

    // 5. Voice Activity Detection (VAD)
    const wasSpeaking = this.isSpeaking;
    this.isSpeaking = this.smoothedVolume > 0.04;
    if (this.isSpeaking) {
      this.lastSpeechActivityTime = Date.now();
    }

    if (!wasSpeaking && this.isSpeaking) {
      eventBus.emit(EVENTS.SPEECH_START);
    } else if (wasSpeaking && !this.isSpeaking) {
      eventBus.emit(EVENTS.SPEECH_END);
    }

    // 6. Speech Peak / Nod Impulse Detection
    this.energyHistory.push(this.smoothedVolume);
    if (this.energyHistory.length > this.maxEnergyHistory) {
      this.energyHistory.shift();
    }

    const avgRecentEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const isPeak = this.smoothedVolume > 0.35 && (this.smoothedVolume - avgRecentEnergy) > 0.15;

    return {
      volume: this.smoothedVolume,
      mouthOpen: this.smoothedMouthOpen,
      mouthForm: this.smoothedMouthForm,
      isSpeaking: this.isSpeaking,
      isPeakEnergy: isPeak,
      spectralCentroid,
      bands: {
        low: lowBand,
        mid: midBand,
        high: highBand
      }
    };
  }
}
