'use strict';
const { nativeImage, app } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Sizes to persist: 48 (1x), 72 (1.5x), 96 (2x), 144 (3x)
const SIZES = [48, 72, 96, 144];

// PS script: outputs two base64 lines — SHIL_EXTRALARGE(48px) then SHIL_JUMBO(256px)
const PS_SCRIPT = `
param([string]$fp)
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Drawing
Add-Type -Language CSharp -ReferencedAssemblies 'System.Drawing' -TypeDefinition @'
using System; using System.IO; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public class TLIconEx {
  [DllImport("shell32.dll")] static extern int SHGetImageList(int n, ref Guid g, out IImageList v);
  [DllImport("user32.dll")]  static extern bool DestroyIcon(IntPtr h);
  [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
  static extern IntPtr SHGetFileInfo(string p, uint a, ref SHFI s, uint c, uint f);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  struct SHFI { public IntPtr hIcon; public int iIcon; public uint dw;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string dn;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=80)]  public string tn; }
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
  public static string Get(string fp, int shil) {
    try {
      var s = new SHFI();
      SHGetFileInfo(fp, 0, ref s, (uint)Marshal.SizeOf(s), 0x4000);
      var iid = new Guid("46EB5926-582E-4017-9FDF-E8998DAA0950");
      IImageList il; SHGetImageList(shil, ref iid, out il);
      if (il == null) return "null";
      IntPtr h = IntPtr.Zero; il.GetIcon(s.iIcon, 1, ref h);
      if (h == IntPtr.Zero) return "null";
      try {
        using (var ic = Icon.FromHandle(h))
        using (var bmp = ic.ToBitmap())
        using (var ms = new MemoryStream()) {
          bmp.Save(ms, ImageFormat.Png);
          return Convert.ToBase64String(ms.ToArray());
        }
      } finally { DestroyIcon(h); }
    } catch { return "null"; }
  }
}
'@
Write-Output ([TLIconEx]::Get($fp, 2))
Write-Output ([TLIconEx]::Get($fp, 4))
`.trim();

const SCRIPT_PATH = path.join(os.tmpdir(), 'tl-exticon.ps1');
try { fs.writeFileSync(SCRIPT_PATH, PS_SCRIPT, 'utf8'); } catch {}

function runPS(filePath) {
  return new Promise((resolve) => {
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
      '-ExecutionPolicy', 'Bypass',
      '-File', SCRIPT_PATH, filePath,
    ], { timeout: 30000, windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
    (err, stdout) => {
      if (err || !stdout) { resolve({ extra: null, jumbo: null }); return; }
      const lines = stdout.trim().split(/\r?\n/);
      const parse = s => (s && s.trim() !== 'null' && s.trim().length > 4)
        ? Buffer.from(s.trim(), 'base64') : null;
      resolve({ extra: parse(lines[0]), jumbo: parse(lines[1]) });
    });
  });
}

function saveResized(srcBuf, size, outPath) {
  try {
    const img = nativeImage.createFromBuffer(srcBuf);
    if (img.isEmpty()) return false;
    const resized = img.resize({ width: size, height: size, quality: 'best' });
    fs.writeFileSync(outPath, resized.toPNG());
    return true;
  } catch { return false; }
}

/**
 * Extracts icon for filePath and saves PNG variants to iconsDir.
 * Strategy:
 *  - 48px  → SHIL_EXTRALARGE (native 48px), fallback downscale from JUMBO
 *  - 72/96/144px → SHIL_JUMBO (native 256px) downscaled, fallback upscale from EXTRALARGE
 *  - If PS fails entirely → Electron getFileIcon fallback
 */
async function extractAndSaveIcons(filePath, itemId, iconsDir) {
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  const { extra, jumbo } = await runPS(filePath);

  const smallSrc = extra || jumbo;  // prefer native 48, fallback to downscaled 256
  const largeSrc = jumbo || extra;  // prefer native 256, fallback to upscaled 48

  if (!smallSrc) {
    // PS failed — fallback to Electron's getFileIcon
    try {
      const icon = await app.getFileIcon(filePath, { size: 'large' });
      if (!icon.isEmpty()) {
        const buf = icon.toPNG();
        for (const s of SIZES) saveResized(buf, s, path.join(iconsDir, `${itemId}-${s}.png`));
        return true;
      }
    } catch {}
    return false;
  }

  let saved = false;
  for (const s of SIZES) {
    const src = s === 48 ? smallSrc : largeSrc;
    if (saveResized(src, s, path.join(iconsDir, `${itemId}-${s}.png`))) saved = true;
  }
  return saved;
}

/**
 * Delete all PNG variants for an item.
 */
function deleteIcons(itemId, iconsDir) {
  for (const s of SIZES) {
    try { fs.unlinkSync(path.join(iconsDir, `${itemId}-${s}.png`)); } catch {}
  }
}

module.exports = { extractAndSaveIcons, deleteIcons, SIZES };
