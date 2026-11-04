/* A small Markdown subset rendered to an HTML string, the same in the browser and in Node (tools/build-blog.mjs).
   Every piece of the author's text is escaped; only the tags below are ever produced, and links/images
   keep only http(s), mailto and same-site addresses. Like StoaTalk's long posts, plus ### headings,
   *italics*, `code`, ``` code blocks, [links](url) and ![pictures](url).
   Blocks: # ## ### headings, > quotes, - and 1. lists, --- rules, ``` fences, ![alt](url) on its own line, else paragraphs.
   A picture on its own line may end with its size and place: ![alt](url){50% left} — 30%, 50% or 75% of the column
   (else all of it), and left, center (the default) or right. */

// a picture line: alt, url, and the {…} after it
export const PIC_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)(?:\{([^}]*)\})?$/;
export function picOpts(spec) {
  const w = String(spec || "").match(/\b(30|50|75)%/)?.[1] || null, a = String(spec || "").match(/\b(left|center|right)\b/)?.[1] || "center";
  return { w, a: w ? a : "center" };
}
export const picSpec = ({ w, a }) => (w ? `{${w}%${a !== "center" ? " " + a : ""}}` : "");

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

// a picture may also be a data: image (demo mode keeps pictures inside the post); an <img> never runs it
const safeImg = (u) => (/^data:image\/(jpeg|png|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(String(u).trim()) ? String(u).trim() : safeUrl(u));
const safeUrl = (u) => {
  u = String(u || "").trim();
  if (/^(https?:|mailto:)/i.test(u) || /^\/(?!\/)/.test(u) || /^#/.test(u)) return u;
  return null;
};

// inside a line: `code`, ![alt](url), [text](url), **bold**, *italic*, bare links
export function inline(src) {
  let out = "", s = String(src);
  const re = /`([^`]+)`|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(?!\s)([^*]+?)\*|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"」。，])/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    out += esc(s.slice(last, m.index));
    if (m[1] != null) out += `<code>${esc(m[1])}</code>`;
    else if (m[3] != null) { const u = safeImg(m[3]); out += u ? `<img src="${esc(u)}" alt="${esc(m[2])}" loading="lazy">` : esc(m[0]); }
    else if (m[5] != null) { const u = safeUrl(m[5]); out += u ? `<a href="${esc(u)}"${/^https?:/i.test(u) ? ' target="_blank" rel="noopener"' : ""}>${inline(m[4])}</a>` : esc(m[0]); }
    else if (m[6] != null) out += `<strong>${inline(m[6])}</strong>`;
    else if (m[7] != null) out += `<em>${inline(m[7])}</em>`;
    else if (m[8] != null) out += `<a href="${esc(m[8])}" target="_blank" rel="noopener">${esc(m[8])}</a>`;
    last = re.lastIndex;
  }
  return out + esc(s.slice(last));
}

export function render(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let para = null, list = null, quote = null;
  const end = () => {
    if (para) out.push(`<p>${para.join("<br>")}</p>`);
    if (list) out.push(`<${list.tag}${list.start > 1 ? ` start="${list.start}"` : ""}>${list.items.map((x) => `<li>${x}</li>`).join("")}</${list.tag}>`);
    if (quote) out.push(`<blockquote><p>${quote.join("<br>")}</p></blockquote>`);
    para = list = quote = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd(), m = line.trim();
    let x;
    if (/^```/.test(m)) {
      end();
      const code = [];
      while (++i < lines.length && !/^```\s*$/.test(lines[i].trim())) code.push(lines[i]);
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }
    if (!m) { end(); continue; }
    if ((x = m.match(/^(#{1,3})\s+(.*)$/))) { end(); const h = x[1].length + 1; out.push(`<h${h}>${inline(x[2])}</h${h}>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(m)) { end(); out.push("<hr>"); continue; }
    if ((x = m.match(PIC_LINE))) {
      end(); const u = safeImg(x[2]), o = picOpts(x[3]);
      if (u) out.push(`<figure${o.w ? ` class="w${o.w} al-${o.a}"` : ""}><img src="${esc(u)}" alt="${esc(x[1])}" loading="lazy">${x[1] ? `<figcaption>${esc(x[1])}</figcaption>` : ""}</figure>`);
      continue;
    }
    if ((x = m.match(/^>\s?(.*)$/))) {
      if (!quote) { end(); quote = []; }
      quote.push(inline(x[1])); continue;
    }
    const li = m.match(/^[-*]\s+(.*)$/), ol = !li && m.match(/^(\d{1,3})[.)]\s+(.*)$/);
    if (li || ol) {
      const tag = li ? "ul" : "ol";
      // a numbered list counts on from its first number, so one picked up after a picture or a paragraph keeps its numbers
      if (!list || list.tag !== tag) { end(); list = { tag, items: [], start: ol ? +ol[1] : 1 }; }
      list.items.push(inline(li ? li[1] : ol[2])); continue;
    }
    if (!para) { end(); para = []; }
    para.push(inline(line));
  }
  end();
  return out.join("\n");
}

// the words without the marks: for excerpts, share text and meta descriptions
export const plain = (text) => String(text || "").replace(/```[\s\S]*?```/g, " ").split("\n").map((l) => l.trim())
  .filter((l) => l && !PIC_LINE.test(l) && !/^(-{3,}|\*{3,})$/.test(l))
  .map((l) => l.replace(/^(#{1,3}\s+|>\s?|[-*]\s+|\d{1,3}[.)]\s+)/, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1"))
  .join(" ").replace(/\s+/g, " ").trim();

export const excerpt = (text, n = 120) => { const p = plain(text); return p.length > n ? p.slice(0, n).trimEnd() + "…" : p; };

// minutes to read: ~400 CJK characters or ~220 words a minute
export function readMinutes(text) {
  const p = plain(text), cjk = (p.match(/[㐀-鿿豈-﫿]/g) || []).length;
  const words = p.replace(/[㐀-鿿豈-﫿]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}
