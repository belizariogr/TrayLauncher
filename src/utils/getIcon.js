'use strict';
const { app } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const cache = new Map();

// ── PowerShell script: extracts 256×256 (SHIL_JUMBO) icons via Windows Shell ──
const PS_SCRIPT = `
param([string]$inputFile)
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -Language CSharp -TypeDefinition @'
using System; using System.IO; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public class TLIcon {
  [DllImport("shell32.dll")] public static extern int SHGetImageList(int n, ref Guid g, out IImageList v);
  [DllImport("user32.dll")]  public static extern bool DestroyIcon(IntPtr h);
  [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
  public static extern IntPtr SHGetFileInfo(string p, uint a, ref SHFI s, uint c, uint f);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct SHFI {
    public IntPtr hIcon; public int iIcon; public uint dw;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string dn;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=80)]  public string tn;
  }
  [ComImport, Guid("46EB5926-582E-4017-9FDF-E8998DAA0950"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IImageList {
    [PreserveSig] int Add(IntPtr a, IntPtr b, ref int c);
    [PreserveSig] int ReplaceIcon(int i, IntPtr h, ref int p);
    [PreserveSig] int SetOverlayImage(int a, int b);
    [PreserveSig] int Replace(int i, IntPtr a, IntPtr b);
    [PreserveSig] int AddMasked(IntPtr a, int c, ref int p);
    [PreserveSig] int Draw(IntPtr p);
    [PreserveSig] int Remove(int i);
    [PreserveSig] int GetIcon(int i, int f, ref IntPtr p);
  }
  public static string Get(string fp) {
    try {
      var s = new SHFI();
      SHGetFileInfo(fp, 0, ref s, (uint)Marshal.SizeOf(s), 0x4000);
      var iid = new Guid("46EB5926-582E-4017-9FDF-E8998DAA0950");
      IImageList il; SHGetImageList(4, ref iid, out il); // 4 = SHIL_JUMBO 256x256
      if (il == null) return null;
      IntPtr h = IntPtr.Zero; il.GetIcon(s.iIcon, 1, ref h);
      if (h == IntPtr.Zero) return null;
      try {
        using (var ic = Icon.FromHandle(h))
        using (var bmp = ic.ToBitmap())
        using (var ms = new MemoryStream()) {
          bmp.Save(ms, ImageFormat.Png);
          return Convert.ToBase64String(ms.ToArray());
        }
      } finally { DestroyIcon(h); }
    } catch { return null; }
  }
}
'@
foreach ($line in [IO.File]::ReadAllLines($inputFile, [Text.Encoding]::UTF8)) {
  if ([string]::IsNullOrWhiteSpace($line)) { Write-Output "null"; continue }
  $b = [TLIcon]::Get($line)
  Write-Output $(if ($b) { $b } else { "null" })
}
`.trim();

const SCRIPT_PATH = path.join(os.tmpdir(), 'tl-geticon.ps1');
const INPUT_PATH  = path.join(os.tmpdir(), 'tl-icon-input.txt');

// Write PS script once to temp dir
try { fs.writeFileSync(SCRIPT_PATH, PS_SCRIPT, 'utf8'); } catch {}

async function fetchViaPS(paths) {
  return new Promise((resolve) => {
    try { fs.writeFileSync(INPUT_PATH, paths.join('\n'), 'utf8'); }
    catch { resolve(null); return; }

    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
      '-ExecutionPolicy', 'Bypass',
      '-File', SCRIPT_PATH, INPUT_PATH,
    ], {
      timeout: 25000,
      windowsHide: true,
      maxBuffer: 150 * 1024 * 1024,
    }, (err, stdout) => {
      if (err || !stdout) { resolve(null); return; }
      const lines = stdout.split(/\r?\n/);
      resolve(paths.map((_, i) => {
        const line = (lines[i] || '').trim();
        return (line && line !== 'null') ? 'data:image/png;base64,' + line : null;
      }));
    });
  });
}

async function fetchViaElectron(filePath) {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'large' });
    return icon.toDataURL();
  } catch { return null; }
}

/**
 * Returns an array of data URLs (or null) for the given file paths.
 * Uses SHIL_JUMBO (256×256) via PowerShell; falls back to Electron's getFileIcon.
 * Results are cached by path.
 */
async function getIconsBatch(filePaths) {
  const uncached = filePaths.filter(p => !cache.has(p));

  if (uncached.length > 0) {
    const psResults = await fetchViaPS(uncached);
    for (let i = 0; i < uncached.length; i++) {
      let icon = psResults && psResults[i];
      if (!icon) icon = await fetchViaElectron(uncached[i]);
      cache.set(uncached[i], icon || null);
    }
  }

  return filePaths.map(p => cache.get(p) || null);
}

module.exports = { getIconsBatch };
