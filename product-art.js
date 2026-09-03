// Illustrated packaging art for each product. There's no camera or photo
// library on kiosk hardware, so instead of a plain repeated icon, each
// product gets a small generated illustration — bottle, box, tube, spray,
// patch, pouch, or test-kit shaped — with gradient shading, a soft blurred
// ground shadow, a diagonal glass/plastic sheen, and a rounded cap
// highlight, so it reads as a little product photo rather than a flat
// icon tile. Colored by category, stamped with the product's own line
// icon in a white badge on the label.

const CATEGORY_TINTS = {
  emergency: { band: "#F87171", cap: "#DC2626" },
  pain: { band: "#60A5FA", cap: "#2563EB" },
  coldallergy: { band: "#2DD4BF", cap: "#0D9488" },
  stomach: { band: "#34D399", cap: "#059669" },
  wellness: { band: "#F472B6", cap: "#DB2777" },
};
const DEFAULT_TINT = { band: "#94A3B8", cap: "#64748B" };

// Lighten (positive) or darken (negative) a #rrggbb color by `percent` (-1..1).
function shade(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + Math.round(255 * percent));
  const g = clamp(((num >> 8) & 0xff) + Math.round(255 * percent));
  const b = clamp((num & 0xff) + Math.round(255 * percent));
  return "#" + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

function iconBadge(cx, cy, r, cap, inner) {
  const s = ((r * 2) / 24) * 0.62;
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${shade(cap, -0.1)}" stroke-width="1" opacity="0.22"/>
    <g transform="translate(${cx - r * 0.62},${cy - r * 0.62}) scale(${s})" fill="none" stroke="${shade(cap, -0.15)}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
  `;
}

// Returns just the blur <filter> definition (for use inside <defs>); the
// shadow ellipse itself is drawn separately by each shape so its size can
// vary with the shape's footprint.
function shadowFilter(uid) {
  return `<filter id="blur-${uid}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.8"/></filter>`;
}

// Diagonal glass/plastic sheen overlay, clipped to a rounded rect matching
// the body it's laid over.
function sheen(uid, x, y, w, h, rx) {
  const id = `sheen-${uid}-${x}-${y}`;
  return `
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.6"/>
      <stop offset="0.35" stop-color="#fff" stop-opacity="0.05"/>
      <stop offset="0.36" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#${id})"/>
  `;
}

function labelLines(x, y, w, color) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="2.6" rx="1.3" fill="${color}" opacity="0.4"/>
    <rect x="${x + w * 0.2}" y="${y + 6}" width="${w * 0.6}" height="2.2" rx="1.1" fill="${color}" opacity="0.3"/>
  `;
}

const PRODUCT_ART_SHAPES = {
  bottle: (band, cap, inner, uid) => `
    <defs>
      <linearGradient id="cap-${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${shade(cap, -0.25)}"/>
        <stop offset="0.5" stop-color="${shade(cap, 0.15)}"/>
        <stop offset="1" stop-color="${shade(cap, -0.2)}"/>
      </linearGradient>
      <linearGradient id="body-${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#e7ecf2"/>
        <stop offset="0.45" stop-color="#ffffff"/>
        <stop offset="1" stop-color="#dbe2ea"/>
      </linearGradient>
      <linearGradient id="band-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shade(band, 0.1)}"/>
        <stop offset="1" stop-color="${shade(band, -0.12)}"/>
      </linearGradient>
      ${shadowFilter(uid)}
    </defs>
    <ellipse cx="50" cy="122" rx="28" ry="5.5" fill="#0f172a" opacity="0.16" filter="url(#blur-${uid})"/>
    <rect x="19" y="25" width="62" height="93" rx="12" fill="url(#body-${uid})" stroke="${shade(cap, -0.1)}" stroke-width="1.5"/>
    <rect x="76" y="27" width="4" height="88" rx="2" fill="#0f172a" opacity="0.06"/>
    <rect x="30" y="8" width="40" height="15" rx="4" fill="url(#cap-${uid})"/>
    <ellipse cx="50" cy="9" rx="17" ry="1.8" fill="#fff" opacity="0.45"/>
    <rect x="30" y="14" width="40" height="2" fill="#000" opacity="0.08"/>
    <rect x="34" y="21" width="32" height="6" fill="${shade(cap, -0.22)}"/>
    <rect x="19" y="57" width="62" height="38" fill="url(#band-${uid})"/>
    <rect x="19" y="57" width="62" height="2" fill="#fff" opacity="0.3"/>
    ${sheen(uid, 19, 25, 62, 93, 12)}
    ${iconBadge(50, 71, 15, cap, inner)}
    ${labelLines(33, 88, 34, "#fff")}
  `,

  box: (band, cap, inner, uid) => `
    <defs>
      <linearGradient id="lid-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shade(cap, 0.1)}"/>
        <stop offset="1" stop-color="${shade(cap, -0.18)}"/>
      </linearGradient>
      <linearGradient id="boxbody-${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="1" stop-color="#e7ecf2"/>
      </linearGradient>
      ${shadowFilter(uid)}
    </defs>
    <ellipse cx="50" cy="122" rx="28" ry="5.5" fill="#0f172a" opacity="0.16" filter="url(#blur-${uid})"/>
    <rect x="13" y="19" width="74" height="98" rx="9" fill="url(#boxbody-${uid})" stroke="${shade(cap, -0.12)}" stroke-width="1.5"/>
    <rect x="82" y="21" width="4" height="94" rx="2" fill="#0f172a" opacity="0.06"/>
    <path d="M13 27a9 9 0 0 1 9-9h56a9 9 0 0 1 9 9v20H13V27Z" fill="url(#lid-${uid})"/>
    <rect x="13" y="19" width="74" height="6" rx="3" fill="#fff" opacity="0.35"/>
    <rect x="13" y="43" width="74" height="4" fill="${shade(cap, -0.25)}" opacity="0.5"/>
    ${sheen(uid, 13, 19, 74, 98, 9)}
    ${iconBadge(50, 33, 12, cap, inner)}
    ${labelLines(29, 68, 42, band)}
    <rect x="29" y="84" width="42" height="20" rx="4" fill="${band}" opacity="0.15"/>
  `,

  tube: (band, cap, inner, uid) => `
    <defs>
      <linearGradient id="tubecap-${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${shade(cap, -0.22)}"/>
        <stop offset="0.5" stop-color="${shade(cap, 0.13)}"/>
        <stop offset="1" stop-color="${shade(cap, -0.18)}"/>
      </linearGradient>
      <linearGradient id="tubebody-${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#e7ecf2"/>
        <stop offset="0.5" stop-color="#ffffff"/>
        <stop offset="1" stop-color="#dbe2ea"/>
      </linearGradient>
      ${shadowFilter(uid)}
    </defs>
    <ellipse cx="50" cy="122" rx="24" ry="5" fill="#0f172a" opacity="0.16" filter="url(#blur-${uid})"/>
    <path d="M30 23h40l6 74a9 9 0 0 1-9 9H33a9 9 0 0 1-9-9l6-74Z" fill="url(#tubebody-${uid})" stroke="${shade(cap, -0.1)}" stroke-width="1.5"/>
    <path d="M38 9h24l4 13H34l4-13Z" fill="url(#tubecap-${uid})"/>
    <ellipse cx="50" cy="10" rx="11" ry="1.6" fill="#fff" opacity="0.45"/>
    <rect x="35" y="14" width="30" height="2" fill="#000" opacity="0.08"/>
    <rect x="24" y="66" width="52" height="32" fill="${band}"/>
    <rect x="24" y="66" width="52" height="2" fill="#fff" opacity="0.3"/>
    <rect x="24" y="66" width="52" height="32" fill="url(#tubecap-${uid})" opacity="0.1"/>
    ${sheen(uid, 30, 23, 40, 80, 9)}
    ${iconBadge(50, 80, 14, cap, inner)}
    <path d="M33 100q17 8 34 0l-2 8a30 12 0 0 1-30 0Z" fill="${shade(cap, -0.12)}" opacity="0.55"/>
  `,

  spray: (band, cap, inner, uid) => `
    <defs>
      <linearGradient id="spraycap-${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${shade(cap, -0.22)}"/>
        <stop offset="0.5" stop-color="${shade(cap, 0.13)}"/>
        <stop offset="1" stop-color="${shade(cap, -0.18)}"/>
      </linearGradient>
      <linearGradient id="spraybody-${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#e7ecf2"/>
        <stop offset="0.5" stop-color="#ffffff"/>
        <stop offset="1" stop-color="#dbe2ea"/>
      </linearGradient>
      ${shadowFilter(uid)}
    </defs>
    <ellipse cx="45" cy="122" rx="24" ry="5" fill="#0f172a" opacity="0.16" filter="url(#blur-${uid})"/>
    <rect x="23" y="33" width="44" height="80" rx="9" fill="url(#spraybody-${uid})" stroke="${shade(cap, -0.1)}" stroke-width="1.5"/>
    <rect x="61" y="35" width="4" height="76" rx="2" fill="#0f172a" opacity="0.06"/>
    <rect x="41" y="3" width="8" height="17" rx="2" fill="url(#spraycap-${uid})"/>
    <path d="M27 19h36l8 13H19l8-13Z" fill="url(#spraycap-${uid})"/>
    <ellipse cx="45" cy="4" rx="3.5" ry="1.2" fill="#fff" opacity="0.5"/>
    <rect x="23" y="61" width="44" height="30" fill="${band}"/>
    <rect x="23" y="61" width="44" height="2" fill="#fff" opacity="0.3"/>
    ${sheen(uid, 23, 33, 44, 80, 9)}
    ${iconBadge(45, 76, 13, cap, inner)}
    ${labelLines(31, 92, 28, "#fff")}
  `,

  patch: (band, cap, inner, uid) => `
    <defs>
      <linearGradient id="patchbg-${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${shade(band, 0.18)}" stop-opacity="0.4"/>
        <stop offset="1" stop-color="${shade(band, -0.05)}" stop-opacity="0.5"/>
      </linearGradient>
      ${shadowFilter(uid)}
    </defs>
    <ellipse cx="50" cy="120" rx="28" ry="5" fill="#0f172a" opacity="0.14" filter="url(#blur-${uid})"/>
    <rect x="13" y="19" width="74" height="94" rx="18" fill="url(#patchbg-${uid})"/>
    <rect x="13" y="19" width="74" height="94" rx="18" fill="none" stroke="${cap}" stroke-width="2"/>
    ${sheen(uid, 13, 19, 74, 94, 18)}
    <circle cx="26" cy="32" r="2.4" fill="${cap}" opacity="0.5"/><circle cx="74" cy="32" r="2.4" fill="${cap}" opacity="0.5"/>
    <circle cx="26" cy="100" r="2.4" fill="${cap}" opacity="0.5"/><circle cx="74" cy="100" r="2.4" fill="${cap}" opacity="0.5"/>
    ${iconBadge(50, 66, 17, cap, inner)}
  `,

  pack: (band, cap, inner, uid) => `
    <defs>
      <linearGradient id="packbg-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shade(band, 0.12)}"/>
        <stop offset="1" stop-color="${shade(band, -0.15)}"/>
      </linearGradient>
      <linearGradient id="packseal-${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${shade(cap, -0.18)}"/>
        <stop offset="0.5" stop-color="${shade(cap, 0.1)}"/>
        <stop offset="1" stop-color="${shade(cap, -0.18)}"/>
      </linearGradient>
      ${shadowFilter(uid)}
    </defs>
    <ellipse cx="50" cy="122" rx="27" ry="5" fill="#0f172a" opacity="0.16" filter="url(#blur-${uid})"/>
    <path d="M17 21h66v83a7 7 0 0 1-7 7H24a7 7 0 0 1-7-7V21Z" fill="url(#packbg-${uid})" stroke="${shade(cap, -0.18)}" stroke-width="1.2"/>
    <path d="M17 21 23 7h54l6 14Z" fill="url(#packseal-${uid})"/>
    <path d="M23 7h4l-5 14h-4Z" fill="#fff" opacity="0.3"/>
    <rect x="17" y="50" width="66" height="34" rx="3" fill="#fff" opacity="0.95"/>
    ${sheen(uid, 17, 21, 66, 63, 4)}
    ${iconBadge(50, 67, 15, cap, inner)}
    <path d="M22 21q28 6 56 0" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.45"/>
  `,

  test: (band, cap, inner, uid) => `
    <defs>
      <linearGradient id="testbg-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shade(band, 0.15)}"/>
        <stop offset="1" stop-color="${shade(band, -0.15)}"/>
      </linearGradient>
      ${shadowFilter(uid)}
    </defs>
    <ellipse cx="50" cy="122" rx="27" ry="5" fill="#0f172a" opacity="0.16" filter="url(#blur-${uid})"/>
    <rect x="15" y="15" width="70" height="100" rx="9" fill="url(#testbg-${uid})" stroke="${shade(cap, -0.18)}" stroke-width="1.2"/>
    <rect x="15" y="15" width="70" height="10" rx="5" fill="#fff" opacity="0.35"/>
    <rect x="26" y="30" width="48" height="58" rx="7" fill="#fff"/>
    <rect x="26" y="30" width="48" height="58" rx="7" fill="none" stroke="${shade(cap, -0.12)}" stroke-width="1"/>
    ${sheen(uid, 15, 15, 70, 100, 9)}
    ${iconBadge(50, 59, 16, cap, inner)}
    ${labelLines(33, 96, 34, "#fff")}
  `,
};

let artUidCounter = 0;

function productArtSvg(product) {
  const palette = CATEGORY_TINTS[product.category] || DEFAULT_TINT;
  const inner = ICONS[product.icon] || ICONS.pill;
  const builder = PRODUCT_ART_SHAPES[product.shape] || PRODUCT_ART_SHAPES.bottle;
  const uid = (product.id || "art") + "-" + (artUidCounter++);
  return `<svg class="product-art" viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg">${builder(palette.band, palette.cap, inner, uid)}</svg>`;
}
