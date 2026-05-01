'use strict';
const { execFile } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ─── PowerShell script ───────────────────────────────────────────────────────
// Outputs one line per icon: base64png|width|height   or   "null"
const PS_SCRIPT = `
param([string]$fp)
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Drawing
Add-Type -Language CSharp -ReferencedAssemblies 'System.Drawing' -TypeDefinition @'
using System; using System.IO; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices; using System.Collections.Generic;
public static class TLPick {
  [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
  static extern int ExtractIconEx(string f, int i, IntPtr[] lg, IntPtr[] sm, int n);
  [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
  static extern int SHDefExtractIcon(string f, int i, uint flags, out IntPtr hL, out IntPtr hS, uint nSize);
  [DllImport("user32.dll")]
  static extern bool DestroyIcon(IntPtr h);

  static string Encode(Bitmap b) {
    using (var ms = new MemoryStream()) { b.Save(ms, ImageFormat.Png); return Convert.ToBase64String(ms.ToArray()) + "|" + b.Width + "|" + b.Height; }
  }

  // EXE / DLL: count with ExtractIconEx, extract at 256px with SHDefExtractIcon
  // nSize LOWORD=large size, HIWORD=small size  =>  256 | (16 << 16)
  public static string[] ExeDll(string fp) {
    var r = new List<string>();
    int n = ExtractIconEx(fp, -1, null, null, 0);
    if (n <= 0) return r.ToArray();
    for (int i = 0; i < n; i++) {
      IntPtr hL = IntPtr.Zero, hS = IntPtr.Zero;
      SHDefExtractIcon(fp, i, 0, out hL, out hS, (uint)(256 | (16 << 16)));
      IntPtr h = hL != IntPtr.Zero ? hL : hS;
      string e = "null";
      if (h != IntPtr.Zero) {
        try { using (var ic = Icon.FromHandle(h)) using (var b = ic.ToBitmap()) e = Encode(b); }
        catch { }
        finally {
          if (hL != IntPtr.Zero) DestroyIcon(hL);
          if (hS != IntPtr.Zero && hS != hL) DestroyIcon(hS);
        }
      }
      r.Add(e);
    }
    return r.ToArray();
  }

  // ICO: enumerate each embedded image; handles both BMP-based and PNG-compressed entries
  public static string[] Ico(string fp) {
    var r = new List<string>();
    try {
      byte[] d = File.ReadAllBytes(fp);
      if (d.Length < 6) return r.ToArray();
      int cnt = BitConverter.ToInt16(d, 4);
      for (int i = 0; i < cnt; i++) {
        int de = 6 + i * 16;
        if (de + 16 > d.Length) break;
        int w   = d[de] == 0 ? 256 : (int)d[de];
        int h   = d[de+1] == 0 ? 256 : (int)d[de+1];
        int sz  = BitConverter.ToInt32(d, de + 8);
        int ofs = BitConverter.ToInt32(d, de + 12);
        if (ofs < 0 || sz <= 0 || ofs + sz > d.Length) { r.Add("null"); continue; }
        string entry = "null";
        try {
          byte[] img = new byte[sz];
          Array.Copy(d, ofs, img, 0, sz);
          // PNG-compressed entry (PNG signature: 89 50 4E 47)
          if (sz > 8 && img[0]==0x89 && img[1]==0x50 && img[2]==0x4E && img[3]==0x47) {
            using (var ms = new MemoryStream(img)) using (var bmp = (Bitmap)Image.FromStream(ms))
              entry = Encode(bmp);
          } else {
            // BMP-based: wrap in a minimal single-image ICO blob
            using (var ms = new MemoryStream()) {
              ms.Write(new byte[]{0,0,1,0,1,0}, 0, 6);            // header
              ms.Write(d, de, 8);                                   // dir: w,h,colors,res,planes,bpp
              ms.Write(BitConverter.GetBytes(sz), 0, 4);           // bytesInRes
              ms.Write(BitConverter.GetBytes(22), 0, 4);           // imageOffset = 22
              ms.Write(img, 0, sz);
              ms.Position = 0;
              using (var ico = new Icon(ms)) using (var bmp = ico.ToBitmap())
                entry = Encode(bmp);
            }
          }
        } catch { }
        r.Add(entry);
      }
    } catch { }
    return r.ToArray();
  }
}
'@
$ext   = [IO.Path]::GetExtension($fp).ToLower()
$icons = if ($ext -eq '.ico') { [TLPick]::Ico($fp) } else { [TLPick]::ExeDll($fp) }
foreach ($line in $icons) { Write-Output $line }
`.trim();

const SCRIPT_PATH = path.join(os.tmpdir(), 'tl-iconpicker.ps1');
try { fs.writeFileSync(SCRIPT_PATH, PS_SCRIPT, 'utf8'); } catch {}

/**
 * Extract all available icons from a .ico, .exe or .dll file.
 * Returns: Array<{ dataUrl: string, width: number, height: number }>
 */
function extractAllIcons(filePath) {
  return new Promise((resolve) => {
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
      '-ExecutionPolicy', 'Bypass',
      '-File', SCRIPT_PATH, filePath,
    ], {
      timeout: 30000,
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
    }, (err, stdout) => {
      if (err || !stdout) { resolve([]); return; }
      const lines  = stdout.trim().split(/\r?\n/);
      const result = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'null') continue;
        const parts = trimmed.split('|');
        if (parts.length === 3 && parts[0].length > 4) {
          result.push({
            dataUrl: 'data:image/png;base64,' + parts[0],
            width:   parseInt(parts[1], 10) || 32,
            height:  parseInt(parts[2], 10) || 32,
          });
        }
      }
      resolve(result);
    });
  });
}

module.exports = { extractAllIcons };
