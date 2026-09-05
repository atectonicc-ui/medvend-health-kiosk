// Small inline SVG icon set used throughout the kiosk UI — product
// pictograms, header controls, modal chrome — so nothing depends on
// external image assets or a network connection.

const ICONS = {
  // Product pictograms
  pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  bandage: '<rect x="2" y="8" width="20" height="8" rx="4"/><path d="M12 8v8"/><path d="M9 12h6"/>',
  tube: '<path d="M9 3h6l1 4H8l1-4Z"/><path d="M8 7h8l1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L8 7Z"/>',
  drop: '<path d="M12 3s7 7.5 7 12a7 7 0 1 1-14 0c0-4.5 7-12 7-12Z"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"/>',
  test: '<path d="M9 2h6"/><path d="M10 2v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 8.5V2"/><path d="M7 15h10"/>',
  logo: '<path d="M12 6v12"/><path d="M6 12h12"/>',

  // UI chrome
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/><path d="M8 22h8"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-6-4-9s1.5-6.5 4-9Z"/>',
  access: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="8.2" r="1.4"/><path d="M8 12.3h8"/><path d="M12 12.3v4"/><path d="M9.3 20l2.7-4 2.7 4"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  cart: '<circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"/><path d="M12 17h.01"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  idCard: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M13 10h6"/><path d="M13 14h6"/><path d="M5.3 16.8c.6-1.4 2-2.2 2.7-2.2s2.1.8 2.7 2.2"/>',
  nfc: '<path d="M6 8a8 8 0 0 1 0 8"/><path d="M9.5 5a12 12 0 0 1 0 14"/><rect x="13" y="9" width="8" height="6" rx="1.5"/>',
  card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chat: '<path d="M4 4h16v12H8l-4 4V4Z"/><path d="M8 9h8"/><path d="M8 12.5h5"/>',
  star: '<path d="m12 3 2.6 5.6 6.1.6-4.6 4.2 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.2 6.1-.6Z"/>',
  flame: '<path d="M12 2c1 3-3 4.5-3 8a3 3 0 0 0 6 0c1 1.2 1.5 2.6 1.5 4a4.5 4.5 0 0 1-9 0C7.5 9.5 10 7 12 2Z"/>',
  thermometer: '<path d="M12 14.5V4.5a2 2 0 1 0-4 0v10a4 4 0 1 0 4 0Z"/><path d="M10 8h3"/>',
  wrench: '<path d="M14.7 3.3a4 4 0 0 0-5.3 4.9L3 14.5 5.5 17l6.3-6.4a4 4 0 0 0 4.9-5.3l-2.5 2.5-2-2Z"/>',
  pulse: '<path d="M3 12h4l2-8 4 16 2-8h6"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-4h6v4"/><path d="M9 7h.01"/><path d="M15 7h.01"/><path d="M9 11h.01"/><path d="M15 11h.01"/>',
  pin: '<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
};

function iconSvg(kind, extraClass) {
  const inner = ICONS[kind] || ICONS.pill;
  const cls = extraClass ? ` class="${extraClass}"` : "";
  return `<svg${cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
