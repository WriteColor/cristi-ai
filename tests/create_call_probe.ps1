$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$probeDirectory = Join-Path $PSScriptRoot 'output'
New-Item -ItemType Directory -Path $probeDirectory -Force | Out-Null
$probeSynthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $probeFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $probeSynthesizer.SetOutputToWaveFile((Join-Path $probeDirectory 'call-probe.wav'), $probeFormat)
  $probeSynthesizer.Speak('Please say audio test completed.')
} finally {
  $probeSynthesizer.Dispose()
}
