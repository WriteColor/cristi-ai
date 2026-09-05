import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import os from 'os';

let currentAudioProc = null;

/**
 * Converts an array of 24000Hz 16-bit Mono PCM Buffers into a valid RIFF/WAVE file Buffer
 */
export function pcmToWavBuffer(pcmBuffers, sampleRate = 24000) {
  const totalPcmLength = pcmBuffers.reduce((acc, b) => acc + b.length, 0);
  const wavHeader = Buffer.alloc(44);

  // RIFF chunk descriptor
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + totalPcmLength, 4);
  wavHeader.write('WAVE', 8);

  // "fmt " sub-chunk
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  wavHeader.writeUInt16LE(1, 20);  // AudioFormat: 1 = PCM
  wavHeader.writeUInt16LE(1, 22);  // NumChannels: 1 (mono)
  wavHeader.writeUInt32LE(sampleRate, 24); // SampleRate (24000)
  wavHeader.writeUInt32LE(sampleRate * 2, 28); // ByteRate (24000 * 1 * 16/8)
  wavHeader.writeUInt16LE(2, 32);  // BlockAlign (1 * 16/8)
  wavHeader.writeUInt16LE(16, 34); // BitsPerSample: 16

  // "data" sub-chunk
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(totalPcmLength, 40);

  return Buffer.concat([wavHeader, ...pcmBuffers]);
}

/**
 * Stops any audio currently playing through the player
 */
export function stopCurrentAudio() {
  if (currentAudioProc) {
    try {
      currentAudioProc.kill('SIGKILL');
    } catch (_) {}
    currentAudioProc = null;
  }
}

/**
 * Kills any orphaned sound player powershell processes
 */
export function killAllAudioPlayback() {
  stopCurrentAudio();
  try {
    execSync('powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like \'*play_sound*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"', {
      timeout: 5000
    });
  } catch (_) {}
}

/**
 * Plays a .wav file exclusively through Windows speakers.
 * Automatically stops any previously playing audio so multiple voices NEVER overlap.
 */
export function playWavFile(wavFilePath, onFinished = null) {
  stopCurrentAudio();

  const fullPath = path.resolve(wavFilePath);
  if (!fs.existsSync(fullPath)) return null;

  const scriptPath = path.join(os.tmpdir(), `play_sound_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.ps1`);
  const psContent = `
$player = New-Object System.Media.SoundPlayer("${fullPath.replace(/\\/g, '\\\\')}")
$player.PlaySync()
$player.Dispose()
`;

  try {
    fs.writeFileSync(scriptPath, psContent, 'utf8');
    const proc = exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, () => {
      try { fs.unlinkSync(scriptPath); } catch (_) {}
      if (currentAudioProc === proc) {
        currentAudioProc = null;
      }
      if (typeof onFinished === 'function') onFinished();
    });
    currentAudioProc = proc;
    return proc;
  } catch (err) {
    console.warn('[AudioPlayer] Error playing audio:', err.message);
    if (typeof onFinished === 'function') onFinished();
    return null;
  }
}
