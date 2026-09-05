$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
function Resize-Jpeg($inPath, $outPath) {
  $img = [System.Drawing.Image]::FromFile((Resolve-Path $inPath))
  try {
    $width = 512
    $height = [int]($img.Height * $width / $img.Width)
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    try {
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      try { $g.DrawImage($img, 0, 0, $width, $height) } finally { $g.Dispose() }
      $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
      $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]45)
      $bmp.Save($outPath, $codec, $params)
    } finally { $bmp.Dispose() }
  } finally { $img.Dispose() }
}
Resize-Jpeg (Join-Path $PSScriptRoot 'artifacts/screenshots/live_fullscreen_capture.jpg') (Join-Path $PSScriptRoot 'output/vision-probe-full.jpg')
Resize-Jpeg (Join-Path $PSScriptRoot 'artifacts/screenshots/snapshot_live_1788515517791.jpg') (Join-Path $PSScriptRoot 'output/vision-probe-region.jpg')
