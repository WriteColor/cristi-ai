import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Captures the TRUE, REAL Windows desktop or full-screen game/app.
 * Uses WinSta0\\Default desktop attachment via dedicated clean STA thread.
 * Works even when exclusive full-screen 3D games (DirectX / OpenGL / Vulkan) are running.
 */
export function captureRealScreenNative(region = null, saveFilePath = null) {
  const tmpScript = path.join(os.tmpdir(), `cristi_true_capture_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.ps1`);
  const psCode = `
Add-Type -ReferencedAssemblies "System.Drawing.dll" -TypeDefinition @"
using System;
using System.Threading;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public class TrueScreenGrabber {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessWindowStation(IntPtr hWinSta);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    public const uint MAXIMUM_ALLOWED = 0x02000000;
    public const int SM_CXSCREEN = 0;
    public const int SM_CYSCREEN = 1;

    public static string CaptureBase64(double xPct, double yPct, double wPct, double hPct, string savePath) {
        IntPtr hWinsta = OpenWindowStation("WinSta0", false, MAXIMUM_ALLOWED);
        if (hWinsta != IntPtr.Zero) {
            SetProcessWindowStation(hWinsta);
        }

        IntPtr hDesk = OpenDesktop("Default", 0, false, MAXIMUM_ALLOWED);
        if (hDesk == IntPtr.Zero) return null;

        string b64Result = null;
        Thread t = new Thread(() => {
            if (SetThreadDesktop(hDesk)) {
                try {
                    SetProcessDPIAware();
                    int screenW = GetSystemMetrics(SM_CXSCREEN);
                    int screenH = GetSystemMetrics(SM_CYSCREEN);
                    if (screenW <= 0) screenW = 2560;
                    if (screenH <= 0) screenH = 1600;

                    int cropX = (int)Math.Max(0, Math.Min(screenW - 1, (xPct / 100.0) * screenW));
                    int cropY = (int)Math.Max(0, Math.Min(screenH - 1, (yPct / 100.0) * screenH));
                    int cropW = (int)Math.Max(1, Math.Min(screenW - cropX, (wPct / 100.0) * screenW));
                    int cropH = (int)Math.Max(1, Math.Min(screenH - cropY, (hPct / 100.0) * screenH));

                    using (Bitmap fullBmp = new Bitmap(screenW, screenH)) {
                        using (Graphics g = Graphics.FromImage(fullBmp)) {
                            g.CopyFromScreen(0, 0, 0, 0, new Size(screenW, screenH));
                        }

                        Bitmap finalBmp = fullBmp;
                        bool disposeFinal = false;

                        if (cropW != screenW || cropH != screenH) {
                            Rectangle rect = new Rectangle(cropX, cropY, cropW, cropH);
                            finalBmp = fullBmp.Clone(rect, fullBmp.PixelFormat);
                            disposeFinal = true;
                        }

                        // Resize to 1280 max width for ultra-fast Gemini Live streaming
                        int targetW = Math.Min(1280, finalBmp.Width);
                        int targetH = (int)(((double)finalBmp.Height / finalBmp.Width) * targetW);

                        using (Bitmap scaledBmp = new Bitmap(targetW, targetH)) {
                            using (Graphics gScaled = Graphics.FromImage(scaledBmp)) {
                                gScaled.InterpolationMode = InterpolationMode.HighQualityBicubic;
                                gScaled.DrawImage(finalBmp, 0, 0, targetW, targetH);
                            }

                            if (!string.IsNullOrEmpty(savePath)) {
                                string dir = Path.GetDirectoryName(savePath);
                                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) {
                                    Directory.CreateDirectory(dir);
                                }
                                scaledBmp.Save(savePath, ImageFormat.Jpeg);
                            }

                            using (MemoryStream ms = new MemoryStream()) {
                                scaledBmp.Save(ms, ImageFormat.Jpeg);
                                b64Result = Convert.ToBase64String(ms.ToArray());
                            }
                        }

                        if (disposeFinal) finalBmp.Dispose();
                    }
                } catch (Exception ex) {
                    Console.Error.WriteLine("[TrueScreenGrabber] Exception: " + ex.Message);
                }
            }
        });

        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();

        CloseDesktop(hDesk);
        return b64Result;
    }
}
"@

$x = ${region && typeof region === 'object' && region.x_pct !== undefined ? Number(region.x_pct) : 0}
$y = ${region && typeof region === 'object' && region.y_pct !== undefined ? Number(region.y_pct) : 0}
$w = ${region && typeof region === 'object' && region.w_pct !== undefined ? Number(region.w_pct) : 100}
$h = ${region && typeof region === 'object' && region.h_pct !== undefined ? Number(region.h_pct) : 100}
$save = "${(saveFilePath || '').replace(/\\/g, '\\\\')}"

$res = [TrueScreenGrabber]::CaptureBase64($x, $y, $w, $h, $save)
if ($res) {
    [Console]::Out.Write($res)
}
`;

  try {
    fs.writeFileSync(tmpScript, psCode, 'utf8');
    const result = execSync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}"`, {
      encoding: 'utf8',
      maxBuffer: 25 * 1024 * 1024
    }).trim();
    try { fs.unlinkSync(tmpScript); } catch (_) {}
    return result || null;
  } catch (err) {
    try { fs.unlinkSync(tmpScript); } catch (_) {}
    console.error('[TrueScreenCapture] Error capturing screen:', err.message);
    return null;
  }
}
