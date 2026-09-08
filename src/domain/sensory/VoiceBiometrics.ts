/**
 * Cristi AI - Voice Biometrics Engine
 * High-precision voice authentication & speaker verification using:
 * - Pre-emphasis, Hamming windowing & Radix-2 FFT power spectrum analysis.
 * - Triangular Log-Mel filterbank energy extraction (32-40 Mel bands).
 * - Normalized autocorrelation fundamental frequency (F0/pitch) estimation.
 * - Spectral flatness, centroid, and Voice Activity Detection (VAD).
 * - Acoustic centroid speaker fingerprinting & Cosine Distance verification
 *   to distinguish the authorized user from background voices, TV audio, or ambient noise.
 */

import type {
  LogMelConfig,
  VoiceBiometricsProfile,
  VoiceprintSample,
  VoiceVerificationResult
} from '@/types';

const STORAGE_KEY_VOICE_PROFILE = 'cristi_voice_biometrics_v2';

export interface VoiceBiometricsOptions {
  sampleRate?: number;
  fftSize?: number;
  hopSize?: number;
  numMelBands?: number;
  minFrequencyHz?: number;
  maxFrequencyHz?: number;
  confidenceThreshold?: number;
  vadEnergyThreshold?: number;
}

export class VoiceBiometrics {
  private config: LogMelConfig;
  private confidenceThreshold: number = 0.76;
  private vadEnergyThreshold: number = 0.015;

  private melFilterbanks: Float32Array[] = [];
  private hammingWindow: Float32Array;

  private profile: VoiceBiometricsProfile = {
    userId: 'owner_user',
    userName: 'Usuario Autorizado',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    samples: [],
    centroid: [],
    referencePitch: 160,
    confidenceThreshold: 0.76
  };

  constructor(options: VoiceBiometricsOptions = {}) {
    const sampleRate = options.sampleRate ?? 16000;
    const fftSize = options.fftSize ?? 512;
    const hopSize = options.hopSize ?? 256;
    const numMelBands = options.numMelBands ?? 32;
    const minFrequencyHz = options.minFrequencyHz ?? 80;
    const maxFrequencyHz = options.maxFrequencyHz ?? Math.min(7600, sampleRate / 2);

    this.config = {
      sampleRate,
      fftSize,
      hopSize,
      numMelBands,
      minFrequencyHz,
      maxFrequencyHz,
      preEmphasisCoeff: 0.97
    };

    this.confidenceThreshold = options.confidenceThreshold ?? 0.76;
    this.vadEnergyThreshold = options.vadEnergyThreshold ?? 0.015;

    // Precompute Hamming window
    this.hammingWindow = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      this.hammingWindow[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
    }

    // Precompute triangular Mel filterbank matrix
    this.constructMelFilterbanks();

    // Load persisted voice profile
    this.loadProfile();
  }

  /**
   * Hertz to Mel scale converter:
   * Mel = 2595 * log10(1 + f / 700)
   */
  private hzToMel(f: number): number {
    return 2595 * Math.log10(1 + f / 700);
  }

  /**
   * Mel to Hertz scale converter:
   * f = 700 * (10^(Mel / 2595) - 1)
   */
  private melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  /**
   * Constructs triangular overlapping Mel filterbanks spanning minFrequencyHz to maxFrequencyHz.
   */
  private constructMelFilterbanks(): void {
    const { sampleRate, fftSize, numMelBands, minFrequencyHz, maxFrequencyHz } = this.config;
    const numBins = Math.floor(fftSize / 2) + 1;
    this.melFilterbanks = [];

    const minMel = this.hzToMel(minFrequencyHz);
    const maxMel = this.hzToMel(maxFrequencyHz);
    const melStep = (maxMel - minMel) / (numMelBands + 1);

    // Calculate Mel boundary points
    const melPoints: number[] = [];
    const binPoints: number[] = [];

    for (let i = 0; i <= numMelBands + 1; i++) {
      const mel = minMel + i * melStep;
      const hz = this.melToHz(mel);
      const bin = Math.floor(((fftSize + 1) * hz) / sampleRate);
      melPoints.push(mel);
      binPoints.push(Math.min(numBins - 1, bin));
    }

    // Construct triangular filters
    for (let m = 1; m <= numMelBands; m++) {
      const filter = new Float32Array(numBins);
      const left = binPoints[m - 1];
      const center = binPoints[m];
      const right = binPoints[m + 1];

      for (let k = left; k < center; k++) {
        filter[k] = (k - left) / Math.max(1, center - left);
      }
      for (let k = center; k <= right; k++) {
        filter[k] = (right - k) / Math.max(1, right - center);
      }

      // Triangular area normalization
      const sum = filter.reduce((a, b) => a + b, 0);
      if (sum > 0) {
        for (let k = 0; k < numBins; k++) {
          filter[k] /= sum;
        }
      }

      this.melFilterbanks.push(filter);
    }
  }

  /**
   * Applies pre-emphasis filter to boost high-frequency speech formants:
   * s[n] = x[n] - alpha * x[n - 1]
   */
  private applyPreEmphasis(samples: Float32Array): Float32Array {
    const alpha = this.config.preEmphasisCoeff;
    const output = new Float32Array(samples.length);
    if (samples.length === 0) return output;
    output[0] = samples[0];
    for (let i = 1; i < samples.length; i++) {
      output[i] = samples[i] - alpha * samples[i - 1];
    }
    return output;
  }

  /**
   * Fast In-Place Radix-2 Cooley-Tukey FFT.
   */
  private fftRadix2(real: Float32Array, imag: Float32Array): void {
    const n = real.length;
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        const tr = real[i]; real[i] = real[j]; real[j] = tr;
        const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1;
      const angle = (-2 * Math.PI) / len;
      const wStepR = Math.cos(angle);
      const wStepI = Math.sin(angle);

      for (let i = 0; i < n; i += len) {
        let wR = 1.0;
        let wI = 0.0;
        for (let m = 0; m < halfLen; m++) {
          const uR = real[i + m];
          const uI = imag[i + m];
          const vR = real[i + m + halfLen] * wR - imag[i + m + halfLen] * wI;
          const vI = real[i + m + halfLen] * wI + imag[i + m + halfLen] * wR;

          real[i + m] = uR + vR;
          imag[i + m] = uI + vI;
          real[i + m + halfLen] = uR - vR;
          imag[i + m + halfLen] = uI - vI;

          const nextWR = wR * wStepR - wI * wStepI;
          wI = wR * wStepI + wI * wStepR;
          wR = nextWR;
        }
      }
    }
  }

  /**
   * Calculates the power spectrum of a single framed audio chunk.
   */
  private computeFramePowerSpectrum(frame: Float32Array): Float32Array {
    const N = this.config.fftSize;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);

    // Apply Hamming window
    for (let i = 0; i < N; i++) {
      real[i] = frame[i] * this.hammingWindow[i];
      imag[i] = 0.0;
    }

    this.fftRadix2(real, imag);

    const halfN = Math.floor(N / 2) + 1;
    const power = new Float32Array(halfN);
    for (let k = 0; k < halfN; k++) {
      power[k] = (real[k] * real[k] + imag[k] * imag[k]) / N;
    }

    return power;
  }

  /**
   * Applies triangular Mel filterbanks to power spectrum and takes natural logarithm:
   * LogMel[m] = ln(max(1e-6, sum(Power * H_m)))
   */
  private computeLogMelFrame(powerSpectrum: Float32Array): Float32Array {
    const numBands = this.melFilterbanks.length;
    const logMel = new Float32Array(numBands);

    for (let m = 0; m < numBands; m++) {
      const filter = this.melFilterbanks[m];
      let sum = 0;
      for (let k = 0; k < filter.length; k++) {
        sum += powerSpectrum[k] * filter[k];
      }
      logMel[m] = Math.log(Math.max(1e-6, sum));
    }

    return logMel;
  }

  /**
   * Fundamental frequency (F0) estimation via normalized autocorrelation over speech lag range (75 Hz to 450 Hz).
   */
  private estimatePitch(samples: Float32Array): number {
    const fs = this.config.sampleRate;
    const minLag = Math.floor(fs / 450); // 450 Hz max human vocal fundamental
    const maxLag = Math.floor(fs / 75);  // 75 Hz min human vocal fundamental

    if (samples.length < maxLag * 2) return 0;

    let bestLag = 0;
    let maxCorr = -1;

    // Normalization energy factor
    let baseEnergy = 0;
    for (let i = 0; i < maxLag; i++) {
      baseEnergy += samples[i] * samples[i];
    }
    if (baseEnergy < 1e-4) return 0;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      let shiftedEnergy = 0;
      for (let i = 0; i < maxLag; i++) {
        sum += samples[i] * samples[i + lag];
        shiftedEnergy += samples[i + lag] * samples[i + lag];
      }

      const denom = Math.sqrt(baseEnergy * Math.max(1e-6, shiftedEnergy));
      const normCorr = sum / denom;

      if (normCorr > maxCorr) {
        maxCorr = normCorr;
        bestLag = lag;
      }
    }

    // A clear periodic pitch has correlation > 0.42
    if (maxCorr > 0.42 && bestLag > 0) {
      return Math.round(fs / bestLag);
    }

    return 0;
  }

  /**
   * Computes Root Mean Square (RMS) energy.
   */
  private computeRms(samples: Float32Array): number {
    if (samples.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  /**
   * Computes spectral centroid (vocal brightness) and spectral flatness.
   */
  private computeSpectralMetrics(powerSpectrum: Float32Array): { centroid: number; flatness: number } {
    const fs = this.config.sampleRate;
    const N = this.config.fftSize;
    let weightedSum = 0;
    let totalPower = 0;
    let sumLog = 0;
    const count = powerSpectrum.length;

    for (let k = 0; k < count; k++) {
      const freq = (k * fs) / N;
      const p = Math.max(1e-9, powerSpectrum[k]);
      weightedSum += freq * p;
      totalPower += p;
      sumLog += Math.log(p);
    }

    const centroid = totalPower > 0 ? weightedSum / totalPower : 0;
    const geometricMean = Math.exp(sumLog / count);
    const arithmeticMean = totalPower / count;
    const flatness = arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;

    return { centroid, flatness };
  }

  /**
   * Extracts compact, invariant biometric embedding vector from audio frames.
   */
  public extractAcousticEmbedding(rawSamples: Float32Array): {
    embedding: number[];
    isSpeech: boolean;
    energyRms: number;
    pitchHz: number;
    centroid: number;
    flatness: number;
    snrDb: number;
  } {
    const samples = this.applyPreEmphasis(rawSamples);
    const { fftSize, hopSize, numMelBands } = this.config;
    const rms = this.computeRms(rawSamples);
    const pitch = this.estimatePitch(rawSamples);

    // Quick VAD check
    if (rms < this.vadEnergyThreshold && pitch === 0) {
      return {
        embedding: new Array(numMelBands + 2).fill(0),
        isSpeech: false,
        energyRms: rms,
        pitchHz: 0,
        centroid: 0,
        flatness: 1.0,
        snrDb: 0
      };
    }

    const numFrames = Math.floor((samples.length - fftSize) / hopSize) + 1;
    if (numFrames <= 0) {
      return {
        embedding: new Array(numMelBands + 2).fill(0),
        isSpeech: false,
        energyRms: rms,
        pitchHz: pitch,
        centroid: 0,
        flatness: 1.0,
        snrDb: 0
      };
    }

    const melAccum = new Float32Array(numMelBands);
    let speechFrameCount = 0;
    let avgCentroid = 0;
    let avgFlatness = 0;

    for (let f = 0; f < numFrames; f++) {
      const offset = f * hopSize;
      const frameSlice = samples.subarray(offset, offset + fftSize);
      const framePower = this.computeFramePowerSpectrum(frameSlice);
      const frameMel = this.computeLogMelFrame(framePower);
      const { centroid, flatness } = this.computeSpectralMetrics(framePower);

      // Frame Voice Activity Gate (formants must have tonal structure)
      if (flatness < 0.65) {
        speechFrameCount++;
        avgCentroid += centroid;
        avgFlatness += flatness;
        for (let m = 0; m < numMelBands; m++) {
          melAccum[m] += frameMel[m];
        }
      }
    }

    // Require voice activity (tonal formants and/or harmonic pitch)
    const isHumanVocal = speechFrameCount >= 2 && (pitch > 0 || avgFlatness < 0.55);

    if (!isHumanVocal || speechFrameCount === 0) {
      return {
        embedding: new Array(numMelBands + 2).fill(0),
        isSpeech: false,
        energyRms: rms,
        pitchHz: pitch,
        centroid: 0,
        flatness: 1.0,
        snrDb: 0
      };
    }

    // Mean Log-Mel across speech frames
    const meanMel = new Float32Array(numMelBands);
    let melSum = 0;
    for (let m = 0; m < numMelBands; m++) {
      meanMel[m] = melAccum[m] / speechFrameCount;
      melSum += meanMel[m];
    }
    const melMean = melSum / numMelBands;

    // Cepstral Mean Subtraction (CMS): zero-center to isolate vocal tract shape from overall gain
    const normalizedMel = new Float32Array(numMelBands);
    for (let m = 0; m < numMelBands; m++) {
      normalizedMel[m] = meanMel[m] - melMean;
    }

    avgCentroid /= speechFrameCount;
    avgFlatness /= speechFrameCount;

    // Approximate SNR: ratio of speech energy to noise floor
    const noiseFloor = Math.max(1e-4, this.vadEnergyThreshold * 0.5);
    const snrDb = Math.max(0, Math.round(20 * Math.log10(rms / noiseFloor)));

    // Assemble biometric feature vector: [Zero-Mean Log-Mel (32D), pitch factor, spectral brightness]
    const rawVector: number[] = [];
    for (let m = 0; m < numMelBands; m++) {
      rawVector.push(normalizedMel[m]);
    }
    // Normalized pitch factor (0-1 for 75-450Hz)
    rawVector.push(pitch > 0 ? (pitch - 75) / 375 : 0.5);
    // Normalized spectral centroid feature
    rawVector.push(avgCentroid / 4000);

    // L2-Normalize vector for cosine distance stability
    let norm = 0;
    for (let i = 0; i < rawVector.length; i++) {
      norm += rawVector[i] * rawVector[i];
    }
    norm = Math.sqrt(norm);
    const normalizedEmbedding = norm > 0 ? rawVector.map((v) => v / norm) : rawVector;

    return {
      embedding: normalizedEmbedding,
      isSpeech: true,
      energyRms: rms,
      pitchHz: pitch,
      centroid: Math.round(avgCentroid),
      flatness: avgFlatness,
      snrDb
    };
  }

  /**
   * Calculates Cosine Similarity between two L2-normalized biometric embeddings:
   * similarity = dot(A, B)
   */
  private computeCosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return Math.max(-1.0, Math.min(1.0, dot));
  }

  /**
   * Verifies an incoming audio buffer against the authorized speaker profile.
   * Identifies whether the speaker is the registered owner, an imposter/background voice, or noise.
   */
  public verifySpeaker(audioData: Float32Array): VoiceVerificationResult {
    const timestamp = Date.now();
    const { embedding, isSpeech, energyRms, pitchHz, centroid, flatness, snrDb } =
      this.extractAcousticEmbedding(audioData);

    // If silence or ambient noise without human vocal formants
    if (!isSpeech || energyRms < this.vadEnergyThreshold) {
      return {
        isAuthorizedUser: false,
        confidence: 0.0,
        similarityScore: 0.0,
        isSpeechDetected: false,
        isBackgroundNoise: true,
        isImposterOrBackgroundVoice: false,
        estimatedPitchHz: 0,
        snrDb,
        energyRms,
        spectralCentroid: centroid,
        spectralFlatness: flatness,
        logMelFingerprint: embedding,
        timestamp
      };
    }

    // If no owner profile is enrolled, accept as default with baseline confidence
    if (!this.isEnrolled()) {
      return {
        isAuthorizedUser: true,
        confidence: 0.8,
        similarityScore: 1.0,
        isSpeechDetected: true,
        isBackgroundNoise: false,
        isImposterOrBackgroundVoice: false,
        estimatedPitchHz: pitchHz,
        snrDb,
        energyRms,
        spectralCentroid: centroid,
        spectralFlatness: flatness,
        logMelFingerprint: embedding,
        timestamp
      };
    }

    // Compare with owner centroid
    const similarity = this.computeCosineSimilarity(embedding, this.profile.centroid);
    const isAuthorized = similarity >= this.confidenceThreshold;

    // Distinguish imposter / background TV voice
    const isImposterOrBackgroundVoice = isSpeech && !isAuthorized;

    // Confidence curve: maps [threshold, 1.0] to [0.65, 1.0]
    let confidence = 0.0;
    if (isAuthorized) {
      confidence = Math.min(1.0, 0.65 + ((similarity - this.confidenceThreshold) / (1.0 - this.confidenceThreshold)) * 0.35);
    } else {
      confidence = Math.max(0.0, (similarity / this.confidenceThreshold) * 0.5);
    }

    return {
      isAuthorizedUser: isAuthorized,
      confidence: Math.round(confidence * 100) / 100,
      similarityScore: Math.round(similarity * 1000) / 1000,
      isSpeechDetected: true,
      isBackgroundNoise: false,
      isImposterOrBackgroundVoice,
      estimatedPitchHz: pitchHz,
      snrDb,
      energyRms,
      spectralCentroid: centroid,
      spectralFlatness: flatness,
      logMelFingerprint: embedding,
      timestamp
    };
  }

  /**
   * Enrolls an authorized user voice sample (e.g. 2-5 seconds of speech).
   */
  public enrollVoiceSample(audioData: Float32Array, label: string = 'Voz del Dueño'): VoiceprintSample {
    const { embedding, isSpeech, energyRms, pitchHz, snrDb } = this.extractAcousticEmbedding(audioData);

    if (!isSpeech || snrDb < 6) {
      throw new Error('La muestra de voz es demasiado tenue o tiene demasiado ruido ambiental. Habla con claridad al micrófono.');
    }

    const sample: VoiceprintSample = {
      id: `voice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label,
      timestamp: Date.now(),
      vector: embedding,
      pitchMean: pitchHz,
      energyRms
    };

    this.profile.samples.push(sample);
    this.recomputeCentroid();
    this.saveProfile();

    return sample;
  }

  /**
   * Recalculates the cluster centroid embedding from all enrolled voice samples.
   */
  private recomputeCentroid(): void {
    if (this.profile.samples.length === 0) {
      this.profile.centroid = [];
      return;
    }

    const dim = this.profile.samples[0].vector.length;
    const sumVector = new Float32Array(dim);

    for (const s of this.profile.samples) {
      for (let i = 0; i < dim; i++) {
        sumVector[i] += s.vector[i];
      }
    }

    const count = this.profile.samples.length;
    let norm = 0;
    const centroid: number[] = [];

    for (let i = 0; i < dim; i++) {
      const val = sumVector[i] / count;
      centroid.push(val);
      norm += val * val;
    }

    norm = Math.sqrt(norm);
    this.profile.centroid = norm > 0 ? centroid.map((v) => v / norm) : centroid;

    // Reference pitch
    const avgPitch =
      this.profile.samples.reduce((acc, s) => acc + s.pitchMean, 0) / count;
    this.profile.referencePitch = Math.round(avgPitch);
    this.profile.updatedAt = Date.now();
  }

  public isEnrolled(): boolean {
    return this.profile.samples.length > 0 && this.profile.centroid.length > 0;
  }

  public getProfile(): VoiceBiometricsProfile {
    return { ...this.profile };
  }

  public clearProfile(): void {
    this.profile = {
      userId: 'owner_user',
      userName: 'Usuario Autorizado',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      samples: [],
      centroid: [],
      referencePitch: 160,
      confidenceThreshold: this.confidenceThreshold
    };
    this.saveProfile();
  }

  private loadProfile(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VOICE_PROFILE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.samples && Array.isArray(parsed.samples)) {
          this.profile = parsed;
          this.recomputeCentroid();
        }
      }
    } catch (e) {
      console.error('[VoiceBiometrics] Error loading voice profile:', e);
    }
  }

  private saveProfile(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_VOICE_PROFILE, JSON.stringify(this.profile));
    } catch (e) {
      console.error('[VoiceBiometrics] Error saving voice profile:', e);
    }
  }

  public setThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0.4, Math.min(0.95, threshold));
    this.profile.confidenceThreshold = this.confidenceThreshold;
    this.saveProfile();
  }
}
