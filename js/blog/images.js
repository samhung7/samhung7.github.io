/* Pictures in a post: shrunk on this device to a JPEG (like StoaTalk's photos), named by its SHA-256, and sent to the
   picture service (worker/), which keeps it in R2 behind img.samhungstudio.com. In demo mode it stays in the post as a data: URL. */
import { backend } from "./backend.js";

const EDGE = 2000, MAX = 1.2 * 1024 * 1024;
export async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("no-size");
    return img;
  } finally { URL.revokeObjectURL(url); }
}
// a loaded picture → JPEG bytes no longer than edge on its long side and no bigger than maxBytes, with its size
export async function encode(img, edge = EDGE, maxBytes = MAX) {
  const W = img.naturalWidth, H = img.naturalHeight;
  let q = 0.85;
  for (let n = 0; ; n++) {
    const s = Math.min(1, edge / Math.max(W, H)), w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const cx = cv.getContext("2d");
    cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); // a transparent PNG gets a white background, not a black one
    cx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", q));
    if (!blob) throw new Error("encode");
    if (blob.size <= maxBytes || n >= 6) return { bytes: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
    if (q > 0.7) q -= 0.08; else edge = Math.round(edge * 0.8); // a little lower quality first, then smaller
  }
}
export async function shrink(file, edge = EDGE, maxBytes = MAX) {
  return (await encode(await loadImage(file), edge, maxBytes)).bytes;
}
export async function hashName(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return btoa(String.fromCharCode(...d)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 22) + ".jpg";
}
// a picture file → its address, ready for ![](…)
export async function uploadImage(file) {
  const b = await backend();
  const bytes = await shrink(file, b.demo ? 1200 : EDGE, b.demo ? 250 * 1024 : MAX);
  return b.putImage(bytes, await hashName(bytes));
}
