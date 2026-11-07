/* The few things a photo's EXIF says that the gallery shows: when it was taken, the camera, the lens and the settings.
   Read straight from the JPEG's APP1 segment (a small TIFF structure: directories of 12-byte entries), so no library is
   needed. Anything that isn't a JPEG with EXIF gives {}; the editor lets every field be typed by hand anyway. */

const MAKE = 0x010f, MODEL = 0x0110, EXIF_IFD = 0x8769, EXPOSURE = 0x829a, FNUMBER = 0x829d, ISO = 0x8827,
  TAKEN = 0x9003, FOCAL = 0x920a, LENS = 0xa434;

export async function readExif(file) {
  try {
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer()); // EXIF sits at the very start
    if (v.getUint16(0) !== 0xffd8) return {};
    for (let p = 2; p + 10 <= v.byteLength; p += 2 + v.getUint16(p + 2)) {
      const marker = v.getUint16(p);
      if (marker === 0xffe1 && v.getUint32(p + 4) === 0x45786966) return describe(tiff(v, p + 10)); // "Exif"
      if (marker === 0xffda) break; // the picture itself starts: no EXIF before it
    }
  } catch (e) { console.warn("exif", e); }
  return {};
}

// every entry of the first directory and of the EXIF directory, as { tag: value }
function tiff(v, t) {
  const le = v.getUint16(t) === 0x4949; // "II": little-endian
  const u16 = (o) => v.getUint16(t + o, le), u32 = (o) => v.getUint32(t + o, le);
  const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const tags = {};
  function read(type, count, at) {
    const o = (SIZE[type] || 1) * count > 4 ? u32(at) : at; // bigger than 4 bytes: the entry holds where it is
    if (type === 2) { let s = ""; for (let i = 0; i < count; i++) s += String.fromCharCode(v.getUint8(t + o + i)); return s.replace(/\0.*$/, "").trim(); }
    if (type === 3) return u16(o);
    if (type === 4) return u32(o);
    if (type === 5) return u32(o + 4) ? u32(o) / u32(o + 4) : 0;
    return null;
  }
  function dir(off) {
    for (let i = 0, n = u16(off); i < n; i++) { const e = off + 2 + i * 12; tags[u16(e)] = read(u16(e + 2), u32(e + 4), e + 8); }
  }
  dir(u32(4));
  if (tags[EXIF_IFD]) dir(tags[EXIF_IFD]);
  return tags;
}

const num = (x) => String(Math.round(x * 10) / 10);
function describe(x) {
  const make = x[MAKE] || "", model = x[MODEL] || "";
  // "Canon" + "Canon EOS R5" → "Canon EOS R5"; "FUJIFILM" + "X100V" → "FUJIFILM X100V"
  const camera = model.toLowerCase().startsWith(make.split(" ")[0].toLowerCase()) ? model : [make, model].filter(Boolean).join(" ");
  const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(x[TAKEN] || "");
  const s = x[EXPOSURE];
  return {
    takenAt: m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null,
    camera,
    lens: x[LENS] || "",
    focal: x[FOCAL] ? num(x[FOCAL]) + "mm" : "",
    aperture: x[FNUMBER] ? "f/" + num(x[FNUMBER]) : "",
    shutter: !s ? "" : s >= 1 ? num(s) + "s" : "1/" + Math.round(1 / s) + "s",
    iso: x[ISO] ? "ISO " + x[ISO] : "",
  };
}
