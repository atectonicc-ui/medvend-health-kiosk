// Real, scannable QR codes — generated fully offline in the browser with the
// vendored qrcode-generator library (vendor/qrcode.js, MIT). Returns an inline
// SVG string; modules are always black on white (with the standard 4-module
// quiet zone) regardless of light/dark/high-contrast theme, because phone
// scanners need dark-on-light.

function qrSvg(text, opts) {
  const ecc = (opts && opts.ecc) || "M";
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"] || qrcode.stringToBytesFuncs["default"];
  const qr = qrcode(0, ecc); // typeNumber 0 = smallest version that fits
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  const size = n + quiet * 2;
  let path = "";
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!qr.isDark(r, c)) { c++; continue; }
      let run = 1;
      while (c + run < n && qr.isDark(r, c + run)) run++;
      path += `M${c + quiet} ${r + quiet}h${run}v1h-${run}z`;
      c += run;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

// Where the phone-side "what you bought" page lives. Fixed to the deployed
// site (not location.origin) so a QR shown while the kiosk is run from
// localhost or a file still points somewhere a phone can actually reach.
const FACTS_PAGE_URL = "https://atectonicc-ui.github.io/medvend-health-kiosk/facts.html";

function factsUrlFor(productIds, lang) {
  return `${FACTS_PAGE_URL}?i=${productIds.join(",")}&l=${lang === "es" ? "es" : "en"}`;
}
