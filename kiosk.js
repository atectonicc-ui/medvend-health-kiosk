// MediVend kiosk app logic. Vanilla JS, no build step, no network
// dependency — everything (product matching, translations, icons) is
// loaded from local <script> tags so this runs on offline kiosk hardware.

// ============================================================
// Icon injection (static, one-time)
// ============================================================

function setIcon(id, kind) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = iconSvg(kind);
}

[
  ["headerLogo", "logo"], ["callNurseIcon", "phone"], ["headerCartIcon", "cart"], ["langIcon", "globe"],
  ["a11yIcon", "access"], ["idleLogo", "logo"], ["searchIcon", "search"],
  ["micIcon", "mic"], ["helperIcon", "help"], ["bannerIcon", "alert"],
  ["cartIcon", "cart"], ["reviewPayArrow", "chevronRight"], ["pdCloseIcon", "close"],
  ["pdMinusIcon", "minus"], ["pdPlusIcon", "plus"], ["symCloseIcon", "close"],
  ["checkoutBackIcon", "chevronLeft"], ["reviewContinueIcon", "chevronRight"], ["termsAgreeIcon", "chevronRight"],
  ["verifyIcon", "idCard"], ["scanIdIcon", "idCard"], ["payIcon", "nfc"],
  ["nfcIcon", "nfc"], ["cardIcon2", "card"], ["fsaIcon", "card"],
  ["resetClockIcon", "clock"], ["emergencyIcon", "alert"],
  ["judgesToggleIcon", "star"], ["judgesCloseIcon", "close"],
  ["thermalOverrideIcon", "thermometer"], ["disasterModeIcon", "flame"], ["dispenserJamIcon", "wrench"],
  ["interactionDemoIcon", "pulse"], ["redFlagIcon", "pulse"], ["interactionIcon", "alert"],
  ["disasterAlertIcon", "alert"], ["disasterAiIcon", "chat"], ["disasterEmergencyIcon", "pulse"], ["disasterCartIcon", "cart"],
  ["disasterLangIcon", "globe"], ["disasterA11yIcon", "access"],
  ["toastIcon", "check"], ["dispenseIcon", "pill"],
  ["aabIcon", "chat"], ["aabChevron", "chevronRight"], ["aiChatCloseIcon", "close"],
  ["chatMicIcon", "mic"], ["chatSendIcon", "chevronRight"], ["careBackIcon", "chevronLeft"],
].forEach(([id, kind]) => setIcon(id, kind));

// ============================================================
// Scale-to-fit: the kiosk is a fixed 1080x1920 canvas, scaled down to fit
// whatever browser window it's previewed in (real hardware is 1080x1920,
// so scale lands at ~1 there).
// ============================================================

const scaler = document.getElementById("kioskScaler");
const kiosk = document.getElementById("kiosk");

function fitKiosk() {
  const margin = 24;
  const scale = Math.min(
    (window.innerWidth - margin * 2) / 1080,
    (window.innerHeight - margin * 2) / 1920,
    1
  );
  kiosk.style.transform = `scale(${scale})`;
  scaler.style.width = 1080 * scale + "px";
  scaler.style.height = 1920 * scale + "px";
}
window.addEventListener("resize", fitKiosk);
fitKiosk();

// ============================================================
// Clock
// ============================================================

const headerClock = document.getElementById("headerClock");
headerClock.innerHTML = iconSvg("clock") + '<span id="clockTime"></span>';
const clockTimeEl = document.getElementById("clockTime");
function updateClock() {
  clockTimeEl.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
updateClock();
setInterval(updateClock, 1000);

// ============================================================
// Toast
// ============================================================

const toastEl = document.getElementById("toast");
const toastTextEl = document.getElementById("toastText");
let toastTimer = null;
function showToast(text) {
  toastTextEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

// ============================================================
// Cart state
// ============================================================

const TAX_RATE = 0.07;
let cart = []; // [{ id, qty }]

// ============================================================
// Judges-panel demo scenario state
// ============================================================
// Liquid/gel items a cabinet over-temperature would chemically degrade.
const HEAT_SENSITIVE_IDS = ["ointment", "decongestant", "sanitizer", "sunscreen", "coldpack"];

let cabinetOverheated = false; // Thermal Stability Override
let disasterMode = false; // Disaster Relief Mode
let simulateDispenserJam = false; // one-shot: consumed by the next dispense

// ---- Disaster Relief Mode: symptom-first triage, zero-cost dispensing, ration engine ----
// Mapped to the closest real items this catalog actually carries — items
// like insect repellent or water-purification tablets aren't stocked, so
// they're intentionally left out rather than inventing products.
const TRIAGE_GROUPS = [
  { id: "hydration", labelEn: "Hydration & Heat Exhaustion", labelEs: "Hidratación y Agotamiento por Calor", icon: "drop", max: 2, productIds: ["electrolyte", "coldpack"] },
  { id: "wound", labelEn: "Wound Care & Trauma", labelEs: "Cuidado de Heridas y Trauma", icon: "bandage", max: 1, productIds: ["bandaid", "gauze", "ointment"] },
  { id: "burn", labelEn: "Burn & Environmental", labelEs: "Quemaduras y Ambiental", icon: "flame", max: 1, productIds: ["ointment", "sunscreen"] },
  { id: "fever", labelEn: "Fever & Pain Relief", labelEs: "Fiebre y Alivio del Dolor", icon: "pill", max: 1, productIds: ["acetaminophen", "ibuprofen"] },
];
const DISASTER_RATION_MAX_TOTAL = 2; // per "person" (per cooldown cycle)
const DISASTER_COOLDOWN_SECONDS = 30;

let disasterUiState = "triage"; // "triage" | "items" | "guidance" | "cooldown"
let disasterActiveGroupId = null;
let disasterDispensedTotal = 0;
let disasterCategoryCounts = {}; // groupId -> count dispensed this cycle
let disasterCooldownInterval = null;

function isTempLocked(product) {
  return cabinetOverheated && HEAT_SENSITIVE_IDS.includes(product.id);
}
// null | "temp" | "stock" — why a product can't be added right now, if at all.
function unavailableReason(product) {
  if (isTempLocked(product)) return "temp";
  if (!product.inStock) return "stock";
  return null;
}
function isAvailable(product) { return unavailableReason(product) === null; }

// If the top match in a result list is unavailable, find the first other
// match that IS available, so the AI can proactively suggest it instead of
// just apologizing.
function findInStockAlternative(products) {
  if (!products.length || isAvailable(products[0])) return null;
  return products.find(isAvailable) || null;
}

function money(n) { return "$" + n.toFixed(2); }
function findProduct(id) { return PRODUCTS.find((p) => p.id === id); }
function cartItems() { return cart.map((c) => ({ product: findProduct(c.id), qty: c.qty })).filter((c) => c.product); }
function cartCount() { return cart.reduce((sum, c) => sum + c.qty, 0); }
function cartSubtotal() { return cartItems().reduce((sum, c) => sum + c.product.price * c.qty, 0); }

function addToCart(product, qty) {
  const existing = cart.find((c) => c.id === product.id);
  if (existing) existing.qty += qty;
  else cart.push({ id: product.id, qty });
  updateCartFooter();
}

function setCartQty(id, qty) {
  const entry = cart.find((c) => c.id === id);
  if (!entry) return;
  if (qty <= 0) cart = cart.filter((c) => c.id !== id);
  else entry.qty = qty;
  updateCartFooter();
}

const cartCountNum = document.getElementById("cartCountNum");
const cartCountLabel = document.getElementById("cartCountLabel");
const cartTotalValue = document.getElementById("cartTotalValue");
const reviewPayBtn = document.getElementById("reviewPayBtn");

function itemsSelectedLabel(n) {
  if (currentLang === "es") return n === 1 ? "1 artículo seleccionado" : `${n} artículos seleccionados`;
  return n === 1 ? "1 item selected" : `${n} items selected`;
}

function updateCartFooter() {
  const n = cartCount();
  cartCountNum.textContent = String(n);
  cartCountLabel.textContent = itemsSelectedLabel(n);
  cartTotalValue.textContent = money(cartSubtotal());
  reviewPayBtn.disabled = n === 0;
  const headerCartBadge = document.getElementById("headerCartBadge");
  headerCartBadge.textContent = String(n);
  headerCartBadge.classList.toggle("hidden", n === 0);
  updateDisasterCartButton();
}

// ============================================================
// Filter bar + catalog grid
// ============================================================

const filterBarEl = document.getElementById("filterBar");
const productGridEl = document.getElementById("productGrid");
const noResultsEl = document.getElementById("noResults");
const searchBannerEl = document.getElementById("searchBanner");
const bannerTextEl = document.getElementById("bannerText");
const bannerIconEl = document.getElementById("bannerIcon");
const searchInput = document.getElementById("searchInput");

let currentCategory = "all";
let lastMode = { type: "category", value: "all" }; // remembers what to re-render on language change

function renderFilterBar() {
  filterBarEl.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.className = "filter-pill" + (currentCategory === "all" ? " active" : "");
  allBtn.textContent = CATEGORY_LABELS[currentLang].all;
  allBtn.addEventListener("click", () => selectCategory("all"));
  filterBarEl.appendChild(allBtn);

  CATEGORIES.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "filter-pill" + (cat.id === "emergency" ? " emergency-pill" : "") + (currentCategory === cat.id ? " active" : "");
    btn.innerHTML = iconSvg(cat.icon) + `<span></span>`;
    btn.querySelector("span").textContent = CATEGORY_LABELS[currentLang][cat.id];
    btn.addEventListener("click", () => selectCategory(cat.id));
    filterBarEl.appendChild(btn);
  });
}

function selectCategory(catId) {
  currentCategory = catId;
  searchInput.value = "";
  hideBanner();
  lastMode = { type: "category", value: catId };
  renderFilterBar();
  const list = catId === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === catId);
  renderGrid(list);
  document.getElementById("catalogScroll").scrollTop = 0;
}

function hideBanner() { searchBannerEl.classList.remove("show"); }
function showBanner(text, variant) {
  variant = variant || "warn";
  bannerTextEl.textContent = text;
  bannerIconEl.innerHTML = iconSvg(variant === "info" ? "chevronRight" : "alert");
  searchBannerEl.classList.remove("warn", "info");
  searchBannerEl.classList.add(variant, "show");
}

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  const reason = unavailableReason(product);

  const badges = [];
  if (reason === "temp") {
    badges.push(`<div class="card-badge templocked">${iconSvg("thermometer")}<span>${t("tempLocked")}</span></div>`);
  } else if (product.ageRestricted) {
    badges.push(`<div class="card-badge age">${iconSvg("alert")}<span>${t("idRequired")}</span></div>`);
  }
  if (reason === "stock") {
    badges.push(`<div class="card-badge oos"><span>${t("outOfStock")}</span></div>`);
  }

  card.innerHTML = `
    <div class="card-art">${badges.join("")}${productArtSvg(product)}</div>
    <div class="card-title"></div>
    <div class="card-dosage"></div>
    ${product.activeIngredient ? `<div class="ingredient-tag"></div>` : ""}
    <div class="card-bottom-row">
      <div class="card-price"></div>
      <div class="stock-text"></div>
    </div>
  `;
  card.querySelector(".card-title").textContent = product.name;
  card.querySelector(".card-dosage").textContent = product.dosage;
  if (product.activeIngredient) card.querySelector(".ingredient-tag").textContent = product.activeIngredient;
  card.querySelector(".card-price").textContent = money(product.price);

  const stockEl = card.querySelector(".stock-text");
  if (reason === "temp") { stockEl.textContent = t("tempLocked"); stockEl.classList.add("out"); }
  else if (reason === "stock") { stockEl.textContent = t("outOfStock"); stockEl.classList.add("out"); }
  else if (product.ageRestricted) { stockEl.textContent = t("idRequired"); stockEl.classList.add("age"); }
  else { stockEl.textContent = t("inStock"); stockEl.classList.add("in"); }

  const addBtn = document.createElement("button");
  addBtn.className = "add-btn";
  addBtn.innerHTML = iconSvg("plus") + `<span>${currentLang === "es" ? "Agregar" : "Add"}</span>`;
  if (reason) { addBtn.disabled = true; addBtn.querySelector("span").textContent = reason === "temp" ? t("tempLocked") : t("outOfStock"); }
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    quickAdd(product, addBtn);
  });
  card.appendChild(addBtn);

  card.addEventListener("click", () => openProductModal(product));
  return card;
}

function renderGrid(products) {
  productGridEl.innerHTML = "";
  if (products.length === 0) {
    noResultsEl.classList.add("show");
    return;
  }
  noResultsEl.classList.remove("show");
  products.forEach((p) => productGridEl.appendChild(createProductCard(p)));
}

function quickAdd(product, btnEl) {
  addToCart(product, 1);
  showToast(`${product.name} ${currentLang === "es" ? "agregado a su pedido" : "added to your order"}`);
  const label = btnEl.querySelector("span");
  const prevText = label.textContent;
  btnEl.classList.add("added");
  btnEl.innerHTML = iconSvg("check") + `<span>${t("added")}</span>`;
  setTimeout(() => {
    btnEl.classList.remove("added");
    btnEl.innerHTML = iconSvg("plus") + `<span>${prevText}</span>`;
  }, 900);
}

// ============================================================
// Search (hooks into ai.js triage: emergency / prescription-only / match)
// ============================================================

let searchDebounce = null;
function onSearchInput() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => runSearch(searchInput.value), 350);
}
searchInput.addEventListener("input", onSearchInput);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { clearTimeout(searchDebounce); runSearch(searchInput.value); }
});

function runSearch(query) {
  const q = query.trim();
  hideBanner();

  if (q === "") {
    lastMode = { type: "category", value: currentCategory };
    const list = currentCategory === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === currentCategory);
    renderGrid(list);
    return;
  }

  const result = classify(q);
  lastMode = { type: "search", value: q };

  if (result.type === "emergency") {
    triggerEmergency();
    return;
  }
  if (result.type === "not_equipped") {
    renderGrid([]);
    noResultsEl.classList.remove("show");
    showBanner(t("notEquippedText"));
    return;
  }
  if (result.type === "unclear") {
    renderGrid([]);
    return;
  }

  // Top match unavailable (out of stock or temp-locked)? Lead with a safe,
  // available alternative instead of just showing a dead end.
  const alt = findInStockAlternative(result.products);
  if (alt) {
    const primary = result.products[0];
    const reasonText = unavailableReason(primary) === "temp"
      ? (currentLang === "es" ? "está bloqueado temporalmente por temperatura" : "is temporarily temperature-locked")
      : (currentLang === "es" ? "está agotado" : "is out of stock");
    showBanner(
      currentLang === "es"
        ? `${primary.name} ${reasonText} ahora mismo — mostrando ${alt.name} como alternativa segura.`
        : `${primary.name} ${reasonText} right now — showing ${alt.name} as a safe alternative.`,
      "info"
    );
    renderGrid([alt, ...result.products.filter((p) => p !== alt)]);
    return;
  }
  renderGrid(result.products);
}

document.getElementById("bannerCareBtn").addEventListener("click", () => openCareScreen());
document.getElementById("noResultsCareBtn").addEventListener("click", () => openCareScreen());

// Voice input — shared between the catalog search mic and the AI chat mic.
const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let listening = false;
let voiceTarget = "search"; // "search" | "chat"
let activeMicBtn = null;
const micBtn = document.getElementById("micBtn");
const chatMicBtn = document.getElementById("chatMicBtn");

function stopListeningUI() {
  listening = false;
  if (activeMicBtn) activeMicBtn.classList.remove("listening");
  activeMicBtn = null;
}

if (SpeechRecognitionImpl) {
  recognizer = new SpeechRecognitionImpl();
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;
  recognizer.addEventListener("result", (e) => {
    const transcript = e.results[0][0].transcript;
    if (voiceTarget === "chat") {
      chatInput.value = transcript;
      handleChatSend(transcript);
    } else {
      searchInput.value = transcript;
      runSearch(transcript);
    }
  });
  recognizer.addEventListener("end", stopListeningUI);
  recognizer.addEventListener("error", stopListeningUI);
} else {
  micBtn.title = "Voice input not supported in this browser";
  chatMicBtn.title = "Voice input not supported in this browser";
}

function startListening(target, btnEl) {
  if (!recognizer) return;
  if (listening) { recognizer.stop(); return; }
  voiceTarget = target;
  activeMicBtn = btnEl;
  recognizer.lang = currentLang === "es" ? "es-ES" : "en-US";
  listening = true;
  btnEl.classList.add("listening");
  recognizer.start();
}
micBtn.addEventListener("click", () => startListening("search", micBtn));
chatMicBtn.addEventListener("click", () => startListening("chat", chatMicBtn));

// ============================================================
// AI Assistant chat modal
// ============================================================

const aiChatOverlay = document.getElementById("aiChatOverlay");
const chatLog = document.getElementById("chatLog");
const chatInput = document.getElementById("chatInput");
let chatStarted = false;
// The most recent product this conversation was about, so a bare
// follow-up like "how do I use it?" still resolves to the right item.
let lastDiscussedProduct = null;

function addChatMessage(text, cls) {
  const div = document.createElement("div");
  div.className = "chat-msg " + cls;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

function addChatProductCards(products) {
  const wrap = document.createElement("div");
  wrap.className = "chat-products";
  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "chat-product-card";
    card.innerHTML = `
      <div class="cp-icon">${iconSvg(p.icon)}</div>
      <div class="cp-info">
        <div class="cp-name"></div>
        <div class="cp-meta"></div>
      </div>
    `;
    card.querySelector(".cp-name").textContent = p.name;
    card.querySelector(".cp-meta").textContent = `${money(p.price)} · ${p.inStock ? t("inStock") : t("outOfStock")}`;

    const btn = document.createElement("button");
    btn.className = "cp-add";
    const addLabel = currentLang === "es" ? "Agregar" : "Add";
    btn.textContent = addLabel;
    if (!p.inStock) btn.disabled = true;
    btn.addEventListener("click", () => {
      if (!p.inStock) return;
      addToCart(p, 1);
      showToast(`${p.name} ${currentLang === "es" ? "agregado a su pedido" : "added to your order"}`);
      btn.classList.add("added");
      btn.textContent = t("chatAdded");
      setTimeout(() => { btn.classList.remove("added"); btn.textContent = addLabel; }, 900);
    });
    card.appendChild(btn);
    wrap.appendChild(card);
  });
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight;
  if (products.length) lastDiscussedProduct = products[0];
}

function addNearbyCareCard() {
  const card = document.createElement("div");
  card.className = "chat-care-card";
  card.innerHTML = `
    <div class="cc-icon-wrap">${iconSvg("pin")}</div>
    <div class="cc-text"></div>
    <button class="cc-btn"></button>
  `;
  card.querySelector(".cc-text").textContent = t("chatCareLine");
  card.querySelector(".cc-btn").textContent = t("chatCareBtn");
  card.querySelector(".cc-btn").addEventListener("click", () => {
    closeAiChat();
    openCareScreen();
  });
  chatLog.appendChild(card);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function handleChatSend(raw) {
  const text = raw.trim();
  if (!text) return;
  addChatMessage(text, "user");
  chatInput.value = "";

  const result = classify(text);
  const qa = answerMedQuestion(text, lastDiscussedProduct);

  setTimeout(() => {
    if (result.type === "emergency") {
      addChatMessage(t("emergencyText"), "warn");
      closeAiChat();
      setTimeout(triggerEmergency, 400);
      return;
    }

    // Direct drug-facts question about a specific item ("what are the
    // warnings for ibuprofen?") — answer from that product's own record
    // (which mirrors its FDA Drug Facts label) rather than just
    // re-recommending it. Only cite the label when the answer actually
    // came from it (`sourced`) — price/prescription/pregnancy/onset
    // answers aren't label text, so they skip the citation.
    if (qa) {
      addChatMessage(qa.reply, "ai");
      addChatMessage(qa.sourced ? `${t("qaSourceNote")} ${t("qaDisclaimer")}` : t("qaDisclaimer"), "system");
      addChatProductCards([qa.product]);
      return;
    }

    // The kiosk genuinely can't help (prescription-only, or nothing in
    // the catalog matches) — point them to real nearby options instead of
    // leaving them stuck.
    if (result.type === "not_equipped") {
      addChatMessage(t("notEquippedText"), "warn");
      addNearbyCareCard();
      return;
    }
    if (result.type === "unclear") {
      addChatMessage(isQuestionLike(text) ? t("qaNoMatch") : t("chatUnclear"), "ai");
      addNearbyCareCard();
      return;
    }
    // Top match unavailable (out of stock or temp-locked)? Suggest a safe,
    // available alternative explicitly rather than just showing it dead.
    const alt = findInStockAlternative(result.products);
    if (alt) {
      const primary = result.products[0];
      const reasonText = unavailableReason(primary) === "temp"
        ? (currentLang === "es" ? "está bloqueado temporalmente por temperatura" : "is temporarily temperature-locked")
        : (currentLang === "es" ? "está agotado" : "is out of stock");
      const ingredientNote = alt.activeIngredient
        ? (currentLang === "es" ? ` (ingrediente activo: ${alt.activeIngredient})` : ` (active ingredient: ${alt.activeIngredient})`)
        : "";
      addChatMessage(
        currentLang === "es"
          ? `${primary.name} ${reasonText} ahora mismo. Una alternativa segura: ${alt.name}${ingredientNote}.`
          : `${primary.name} ${reasonText} right now. A safe alternative: ${alt.name}${ingredientNote}.`,
        "warn"
      );
      addChatProductCards([alt, ...result.products.filter((p) => p !== alt)]);
      return;
    }

    addChatMessage(friendlyIntro(result.products), "ai");
    addChatProductCards(result.products);
  }, 450);
}

function openAiChat() {
  if (!chatStarted) {
    chatStarted = true;
    addChatMessage(t("chatGreeting"), "ai");
    addChatMessage(t("chatGreetingSub"), "system");
  }
  aiChatOverlay.classList.add("show");
}
function closeAiChat() { aiChatOverlay.classList.remove("show"); }

document.getElementById("aiAssistantBtn").addEventListener("click", openAiChat);
document.getElementById("aiChatClose").addEventListener("click", closeAiChat);
aiChatOverlay.addEventListener("click", (e) => { if (e.target === aiChatOverlay) closeAiChat(); });
document.getElementById("chatSendBtn").addEventListener("click", () => handleChatSend(chatInput.value));
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleChatSend(chatInput.value); });

// ============================================================
// Nearby Care & Pharmacy directory
// ============================================================
// Real facility data for the area nearest this kiosk (Library & Active
// Living Center at Afton Ridge, 6095 Glen Afton Blvd, Concord, NC 28027).
// Names/addresses are proper nouns, so they're not run through t().

const FACILITIES = {
  er: [
    { name: "Atrium Health Cabarrus Emergency Department", address: "920 Church St N, Concord, NC 28025", phone: "(704) 403-3000", hours: null, open24: true },
    { name: "Atrium Health Concord Emergency Department", address: "5350 John Q Hammons Dr, Concord, NC 28027", phone: "(704) 403-3000", hours: null, open24: true },
  ],
  urgent: [
    { name: "FastMed Urgent Care – Concord", address: "391 George W Liles Pkwy NW, Concord, NC 28027", phone: "(704) 886-1780", hours: "Mon–Fri 8am–8pm · Sat–Sun 8am–4pm", open24: false },
  ],
  pharmacy: [
    { name: "CVS Pharmacy", address: "6150 Bayfield Pkwy, Concord, NC 28027", phone: "(704) 262-6081", hours: "Mon–Fri 9am–9pm · Sat–Sun 9am–6pm", open24: false },
    { name: "Walgreens Pharmacy", address: "5230 Poplar Tent Rd, Concord, NC 28027", phone: "(704) 784-1977", hours: "Mon–Fri 9am–9pm · Sat 9am–6pm · Sun 10am–6pm", open24: false },
  ],
};

function careCardHtml(f, kind) {
  const emergencyClass = kind === "er" ? " emergency" : "";
  const icon = kind === "pharmacy" ? "logo" : "building";
  return `
    <div class="care-card${emergencyClass}">
      <div class="cc-icon">${iconSvg(icon)}</div>
      <div class="cc-info">
        <div class="cc-name">${f.name}</div>
        <div class="cc-row"><strong>${t("careAddress")}:</strong> ${f.address}</div>
        <div class="cc-row"><strong>${t("carePhone")}:</strong> ${f.phone}</div>
        ${f.hours ? `<div class="cc-row"><strong>${t("careHours")}:</strong> ${f.hours}</div>` : ""}
        ${f.open24 ? `<span class="cc-open24">${t("careOpen24")}</span>` : ""}
      </div>
    </div>
  `;
}

function renderCareScreen() {
  const careBody = document.getElementById("careBody");
  careBody.innerHTML = `
    <div class="care-intro">${iconSvg("pin")}<div>${t("careIntro")}</div></div>
    <div class="care-section-title emergency">${iconSvg("alert")}<span>${t("careEr")}</span></div>
    ${FACILITIES.er.map((f) => careCardHtml(f, "er")).join("")}
    <div class="care-section-title">${iconSvg("building")}<span>${t("careUrgentCare")}</span></div>
    ${FACILITIES.urgent.map((f) => careCardHtml(f, "urgent")).join("")}
    <div class="care-section-title">${iconSvg("logo")}<span>${t("carePharmacies")}</span></div>
    ${FACILITIES.pharmacy.map((f) => careCardHtml(f, "pharmacy")).join("")}
  `;
}

const careScreen = document.getElementById("careScreen");
function openCareScreen() { renderCareScreen(); careScreen.classList.add("show"); }
function closeCareScreen() { careScreen.classList.remove("show"); }
document.getElementById("careBackBtn").addEventListener("click", closeCareScreen);

// ============================================================
// Symptom selector modal
// ============================================================

const symptomModalOverlay = document.getElementById("symptomModalOverlay");
const symptomGridEl = document.getElementById("symptomGrid");

function renderSymptomGrid() {
  symptomGridEl.innerHTML = "";
  SYMPTOMS.forEach((s) => {
    const chip = document.createElement("button");
    chip.className = "symptom-chip";
    chip.textContent = s[currentLang] || s.en;
    chip.addEventListener("click", () => {
      closeSymptomModal();
      searchInput.value = s[currentLang] || s.en;
      runSearch(s.query);
      document.getElementById("catalogScroll").scrollTop = 0;
    });
    symptomGridEl.appendChild(chip);
  });
}

function openSymptomModal() { renderSymptomGrid(); symptomModalOverlay.classList.add("show"); }
function closeSymptomModal() { symptomModalOverlay.classList.remove("show"); }
document.getElementById("helperBtn").addEventListener("click", openSymptomModal);
document.getElementById("symptomModalClose").addEventListener("click", closeSymptomModal);
symptomModalOverlay.addEventListener("click", (e) => { if (e.target === symptomModalOverlay) closeSymptomModal(); });

// ============================================================
// Product detail modal
// ============================================================

const productModalOverlay = document.getElementById("productModalOverlay");
const productModalBody = document.getElementById("productModalBody");
const pdQtyValue = document.getElementById("pdQtyValue");
let modalProduct = null;
let modalQty = 1;

function openProductModal(product) {
  modalProduct = product;
  modalQty = 1;
  pdQtyValue.textContent = "1";

  const ageBanner = product.ageRestricted
    ? `<div class="age-banner">${iconSvg("alert")}<span>${t("ageBanner")}</span></div>`
    : "";
  const ingredientBlock = product.activeIngredient
    ? `<div class="fact-block"><div class="fact-label">${t("factIngredient")}</div><div class="fact-value"></div></div>`
    : "";
  const langNote = currentLang === "es"
    ? `<div class="verify-demo-note" style="margin-top:14px;">${t("medInfoEnglishNote")}</div>`
    : "";

  productModalBody.innerHTML = `
    <div class="pd-art">${productArtSvg(product)}</div>
    ${ageBanner}
    <div class="card-title" style="font-size:1.4rem;margin-bottom:4px;"></div>
    <div class="card-dosage" style="margin-bottom:10px;"></div>
    ${ingredientBlock}
    <div class="fact-block"><div class="fact-label">${t("factUses")}</div><div class="fact-value" id="pdUses"></div></div>
    <div class="fact-block"><div class="fact-label">${t("factDosage")}</div><div class="fact-value" id="pdInstructions"></div></div>
    <div class="fact-block"><div class="fact-label">${t("factWarnings")}</div><div class="fact-value" id="pdWarnings"></div></div>
    <div class="fact-block"><div class="fact-label">${t("factAllergy")}</div><div class="fact-value" id="pdAllergy"></div></div>
    ${langNote}
  `;
  productModalBody.querySelector(".card-title").textContent = product.name;
  productModalBody.querySelector(".card-dosage").textContent = `${product.dosage} · ${money(product.price)}`;
  if (product.activeIngredient) productModalBody.querySelector(".fact-block .fact-value").textContent = product.activeIngredient;
  document.getElementById("pdUses").textContent = product.uses;
  document.getElementById("pdInstructions").textContent = product.instructions;
  document.getElementById("pdWarnings").textContent = product.warnings;
  document.getElementById("pdAllergy").textContent = product.allergyAlert;

  const addBtn = document.getElementById("pdAddBtn");
  addBtn.disabled = !product.inStock;
  addBtn.querySelector("span").textContent = product.inStock ? t("addToOrder") : t("outOfStock");

  productModalOverlay.classList.add("show");
}

function closeProductModal() { productModalOverlay.classList.remove("show"); }
document.getElementById("productModalClose").addEventListener("click", closeProductModal);
productModalOverlay.addEventListener("click", (e) => { if (e.target === productModalOverlay) closeProductModal(); });

document.getElementById("pdQtyMinus").addEventListener("click", () => {
  modalQty = Math.max(1, modalQty - 1);
  pdQtyValue.textContent = String(modalQty);
});
document.getElementById("pdQtyPlus").addEventListener("click", () => {
  modalQty = Math.min(10, modalQty + 1);
  pdQtyValue.textContent = String(modalQty);
});
document.getElementById("pdAddBtn").addEventListener("click", () => {
  if (!modalProduct || !modalProduct.inStock) return;
  addToCart(modalProduct, modalQty);
  showToast(`${modalProduct.name} ${currentLang === "es" ? "agregado a su pedido" : "added to your order"}`);
  closeProductModal();
});

// ============================================================
// Checkout flow
// ============================================================

const checkoutScreen = document.getElementById("checkoutScreen");
const checkoutTitle = document.getElementById("checkoutTitle");
const stepDotsEl = document.getElementById("stepDots");
const reviewListEl = document.getElementById("reviewList");

let activeSteps = ["review", "terms", "pay"];
let stepIndex = 0;
let idVerified = false;
let termsAgreed = false;

function needsAgeVerification() {
  return cartItems().some((c) => c.product.ageRestricted);
}

// Known-risk combinations, detected generically by shared active-ingredient
// class rather than a hardcoded product-pair list, so it also catches
// unnamed future items (e.g. any two items both containing acetaminophen).
function checkCartInteractions() {
  const items = cartItems().map((c) => c.product);
  const es = currentLang === "es";
  const nsaid = items.filter((p) => p.activeIngredient && p.activeIngredient.includes("NSAID"));
  const acet = items.filter((p) => p.activeIngredient && p.activeIngredient.includes("Acetaminophen"));
  const warnings = [];
  if (nsaid.length >= 2) {
    warnings.push({
      names: nsaid.map((p) => p.name),
      title: es ? "Riesgo de Sangrado Estomacal" : "Stomach Bleeding Risk",
      detail: es
        ? "Combinar varios AINE (como ibuprofeno y aspirina) aumenta el riesgo de sangrado estomacal."
        : "Combining multiple NSAIDs (like ibuprofen and aspirin) increases the risk of stomach bleeding.",
    });
  }
  if (acet.length >= 2) {
    warnings.push({
      names: acet.map((p) => p.name),
      title: es ? "Riesgo de Daño Hepático" : "Liver Damage Risk",
      detail: es
        ? "Estos artículos contienen acetaminofén — tomarlos juntos puede exceder el límite diario seguro y causar daño hepático."
        : "These items both contain acetaminophen — taking them together can exceed the safe daily limit and cause liver damage.",
    });
  }
  return warnings;
}

function computeActiveSteps() {
  const steps = [];
  if (checkCartInteractions().length) steps.push("interaction");
  steps.push("review", "terms");
  if (needsAgeVerification()) steps.push("verify");
  steps.push("pay");
  return steps;
}

function openCheckout() {
  if (cartCount() === 0) return;
  activeSteps = computeActiveSteps();
  stepIndex = 0;
  idVerified = false;
  termsAgreed = false;
  renderReviewList();
  checkoutScreen.classList.add("show");
  renderCheckoutStep();
}

function closeCheckout() { checkoutScreen.classList.remove("show"); }

const stepTitleKey = { interaction: "interactionStepTitle", review: "orderReview", terms: "termsTitle", verify: "ageVerification", pay: "payment" };

function renderCheckoutStep() {
  document.querySelectorAll(".checkout-step").forEach((el) => el.classList.remove("active"));
  const stepName = activeSteps[stepIndex];
  document.getElementById("step" + stepName[0].toUpperCase() + stepName.slice(1)).classList.add("active");
  checkoutTitle.textContent = t(stepTitleKey[stepName]);

  stepDotsEl.innerHTML = "";
  activeSteps.forEach((_, i) => {
    const dot = document.createElement("div");
    dot.className = "step-dot" + (i === stepIndex ? " active" : i < stepIndex ? " done" : "");
    stepDotsEl.appendChild(dot);
  });

  if (stepName === "interaction") renderInteractionStep();
  if (stepName === "terms") resetTermsStep();
  if (stepName === "verify") resetVerifyStep();
  if (stepName === "pay") resetPayStep();
}

function renderInteractionStep() {
  const list = document.getElementById("interactionList");
  list.innerHTML = checkCartInteractions().map((w) => `
    <div class="interaction-card">
      <div class="ic-title">${w.title}</div>
      <div class="ic-items">${w.names.join(" + ")}</div>
      <div class="ic-detail">${w.detail}</div>
    </div>
  `).join("");
}
document.getElementById("interactionBackBtn").addEventListener("click", closeCheckout);
document.getElementById("interactionContinueBtn").addEventListener("click", () => {
  stepIndex++;
  renderCheckoutStep();
});

document.getElementById("checkoutBackBtn").addEventListener("click", () => {
  if (stepIndex === 0) { closeCheckout(); return; }
  stepIndex--;
  renderCheckoutStep();
});

// ---- Step 1: order review ----

function renderReviewList() {
  reviewListEl.innerHTML = "";
  cartItems().forEach(({ product, qty }) => {
    const row = document.createElement("div");
    row.className = "review-item";
    row.innerHTML = `
      <div class="ri-icon">${iconSvg(product.icon)}</div>
      <div class="ri-info">
        <div class="ri-name"></div>
        <div class="ri-dosage"></div>
      </div>
      <div class="ri-price"></div>
      <div class="ri-remove">${iconSvg("close")}</div>
    `;
    row.querySelector(".ri-name").textContent = product.name;
    row.querySelector(".ri-dosage").textContent = `${product.dosage} · Qty ${qty}`;
    row.querySelector(".ri-price").textContent = money(product.price * qty);
    row.querySelector(".ri-remove").addEventListener("click", () => {
      setCartQty(product.id, 0);
      if (cartCount() === 0) { closeCheckout(); return; }
      renderReviewList();
      updateReviewSummary();
      activeSteps = computeActiveSteps();
    });
    reviewListEl.appendChild(row);
  });
  updateReviewSummary();
}

function updateReviewSummary() {
  const subtotal = cartSubtotal();
  const tax = subtotal * TAX_RATE;
  document.getElementById("sumSubtotal").textContent = money(subtotal);
  document.getElementById("sumTax").textContent = money(tax);
  document.getElementById("sumTotal").textContent = money(subtotal + tax);
}

document.getElementById("reviewContinueBtn").addEventListener("click", () => {
  stepIndex++;
  renderCheckoutStep();
});

// ---- Step: terms & liability ----

const termsCheckbox = document.getElementById("termsCheckbox");
const termsAgreeBtn = document.getElementById("termsAgreeBtn");

function resetTermsStep() {
  termsAgreed = false;
  termsCheckbox.classList.remove("checked");
  termsCheckbox.innerHTML = "";
  termsAgreeBtn.disabled = true;
  document.getElementById("stepTerms").querySelector(".step-scroll").scrollTop = 0;
}

function toggleTermsCheckbox() {
  termsAgreed = !termsAgreed;
  termsCheckbox.classList.toggle("checked", termsAgreed);
  termsCheckbox.innerHTML = termsAgreed ? iconSvg("check") : "";
  termsAgreeBtn.disabled = !termsAgreed;
}
termsCheckbox.addEventListener("click", toggleTermsCheckbox);
document.getElementById("termsCheckRow").addEventListener("click", (e) => {
  if (e.target === termsCheckbox) return; // avoid double-toggle from the child click
  toggleTermsCheckbox();
});

termsAgreeBtn.addEventListener("click", () => {
  if (!termsAgreed) return;
  stepIndex++;
  renderCheckoutStep();
});

// ---- Step 2: age verification ----

const verifyIconWrap = document.getElementById("verifyIconWrap");
const scanProgress = document.getElementById("scanProgress");
const scanProgressBar = document.getElementById("scanProgressBar");
const scanIdBtn = document.getElementById("scanIdBtn");

function resetVerifyStep() {
  idVerified = false;
  verifyIconWrap.classList.remove("verified");
  verifyIconWrap.innerHTML = iconSvg("idCard");
  document.getElementById("verifyTitle").textContent = t("verifyTitle");
  document.getElementById("verifySub").textContent = t("verifySub");
  scanProgress.classList.remove("show");
  scanProgressBar.style.width = "0%";
  scanIdBtn.disabled = false;
  scanIdBtn.innerHTML = iconSvg("idCard") + `<span id="scanIdLabel">${t("scanIdBtn")}</span>`;
}

scanIdBtn.addEventListener("click", () => {
  if (idVerified) { stepIndex++; renderCheckoutStep(); return; }
  scanIdBtn.disabled = true;
  scanProgress.classList.add("show");
  document.getElementById("verifyTitle").textContent = t("scanning");
  requestAnimationFrame(() => { scanProgressBar.style.width = "100%"; });

  setTimeout(() => {
    idVerified = true;
    verifyIconWrap.classList.add("verified");
    verifyIconWrap.innerHTML = iconSvg("check");
    document.getElementById("verifyTitle").textContent = t("verified");
    document.getElementById("verifySub").textContent = t("verifiedSub");
    scanIdBtn.disabled = false;
    scanIdBtn.innerHTML = iconSvg("chevronRight") + `<span>${t("continueToPayment")}</span>`;
    setTimeout(() => { stepIndex++; renderCheckoutStep(); }, 900);
  }, 1700);
});

// ---- Step 3: payment ----

const payProcessing = document.getElementById("payProcessing");
const simulatePayBtn = document.getElementById("simulatePayBtn");

function resetPayStep() {
  const total = cartSubtotal() * (1 + TAX_RATE);
  document.getElementById("payAmountLine").textContent =
    (currentLang === "es" ? "Total a pagar: " : "Total due: ") + money(total);
  payProcessing.classList.remove("show");
  simulatePayBtn.disabled = false;
  simulatePayBtn.querySelector("span").textContent = t("simulatePay");
}

simulatePayBtn.addEventListener("click", () => {
  simulatePayBtn.disabled = true;
  payProcessing.classList.add("show");
  setTimeout(() => {
    payProcessing.classList.remove("show");
    closeCheckout();
    startDispense();
  }, 1500);
});

reviewPayBtn.addEventListener("click", openCheckout);
document.getElementById("headerCartBtn").addEventListener("click", () => {
  if (cartCount() > 0) openCheckout();
  else showToast(currentLang === "es" ? "Su carrito está vacío" : "Your cart is empty");
});

// ============================================================
// Dispense & safety screen
// ============================================================

const dispenseScreen = document.getElementById("dispenseScreen");
const dispenseAnim = document.getElementById("dispenseAnim");
const dispenseStatus = document.getElementById("dispenseStatus");
const dispenseSub = document.getElementById("dispenseSub");
const receiptCard = document.getElementById("receiptCard");
const safetyCard = document.getElementById("safetyCard");
const doneNowBtn = document.getElementById("doneNowBtn");
const autoResetNote = document.getElementById("autoResetNote");
const autoResetText = document.getElementById("autoResetText");

let resetCountdownInterval = null;

function startDispense() {
  const jam = simulateDispenserJam;
  simulateDispenserJam = false; // one-shot, consumed now regardless of outcome

  const items = cartItems();
  const orderSnapshot = items.map((i) => ({ name: i.product.name, qty: i.qty, price: i.product.price }));
  const orderTotal = cartSubtotal() * (1 + TAX_RATE);

  receiptCard.classList.remove("show");
  safetyCard.classList.remove("show");
  doneNowBtn.classList.remove("show");
  autoResetNote.classList.remove("show");
  dispenseAnim.classList.remove("failed");
  dispenseAnim.classList.add("working");
  dispenseAnim.innerHTML = iconSvg("pill");
  dispenseStatus.textContent = t("dispensing");
  dispenseSub.textContent = "";
  dispenseScreen.classList.add("show");

  if (jam) {
    // Hardware fails before anything physically drops — nothing dispensed,
    // charge reversed, cart preserved isn't needed since the transaction
    // itself is voided.
    setTimeout(() => failDispense(), 1400);
    return;
  }

  let idx = 0;
  function nextItem() {
    if (idx >= items.length) { finishDispense(orderSnapshot, orderTotal); return; }
    const { product, qty } = items[idx];
    dispenseSub.textContent = `${idx + 1} / ${items.length} — ${product.name}${qty > 1 ? " x" + qty : ""}`;
    const drop = document.createElement("span");
    drop.className = "drop-icon";
    drop.innerHTML = iconSvg(product.icon);
    dispenseAnim.appendChild(drop);
    setTimeout(() => drop.remove(), 1000);
    idx++;
    setTimeout(nextItem, 1100);
  }
  nextItem();
}

function failDispense() {
  dispenseAnim.classList.remove("working");
  dispenseAnim.classList.add("failed");
  dispenseAnim.innerHTML = iconSvg("alert");
  dispenseStatus.textContent = t("dispenseFailTitle");
  dispenseSub.textContent = t("dispenseFailSub");

  receiptCard.innerHTML = `<div class="receipt-row"><span>${t("receiptReversed")}</span><span>$0.00</span></div>`;
  receiptCard.classList.add("show");
  doneNowBtn.classList.add("show");

  cart = [];
  updateCartFooter();

  startResetCountdown(20);
}

function finishDispense(orderSnapshot, orderTotal) {
  dispenseAnim.classList.remove("working");
  dispenseAnim.innerHTML = iconSvg("check");
  dispenseStatus.textContent = t("orderComplete");
  dispenseSub.textContent = t("orderCompleteSub");

  receiptCard.innerHTML = orderSnapshot
    .map((i) => `<div class="receipt-row"><span>${i.name}${i.qty > 1 ? " × " + i.qty : ""}</span><span>${money(i.price * i.qty)}</span></div>`)
    .join("") + `<div class="receipt-row"><span><strong>${t("total")}</strong></span><span><strong>${money(orderTotal)}</strong></span></div>`;
  receiptCard.classList.add("show");
  safetyCard.classList.add("show");
  doneNowBtn.classList.add("show");

  cart = [];
  updateCartFooter();

  startResetCountdown(20);
}

function startResetCountdown(seconds) {
  let remaining = seconds;
  autoResetNote.classList.add("show");
  const render = () => {
    autoResetText.textContent = currentLang === "es"
      ? `Volviendo al inicio en ${remaining}s...`
      : `Returning to home screen in ${remaining}s...`;
  };
  render();
  clearInterval(resetCountdownInterval);
  resetCountdownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) { clearInterval(resetCountdownInterval); resetKiosk(); return; }
    render();
  }, 1000);
}

doneNowBtn.addEventListener("click", () => { clearInterval(resetCountdownInterval); resetKiosk(); });

// ============================================================
// Emergency overlay
// ============================================================

const emergencyOverlay = document.getElementById("emergencyOverlay");
function triggerEmergency() {
  const erListEl = document.getElementById("emergencyErList");
  erListEl.innerHTML = FACILITIES.er.map((f) => `
    <div class="emergency-er-card">
      <div class="er-name">${f.name}</div>
      <div class="er-detail">${f.address} · ${f.phone}${f.open24 ? " · " + t("careOpen24") : ""}</div>
    </div>
  `).join("");
  emergencyOverlay.classList.add("show");
}
document.getElementById("emergencyReset").addEventListener("click", () => {
  emergencyOverlay.classList.remove("show");
  resetKiosk();
});

document.getElementById("callNurseBtn").addEventListener("click", openCareScreen);

// ============================================================
// Idle / attract loop + inactivity auto-reset
// ============================================================

const idleOverlay = document.getElementById("idleOverlay");
const idleTipEl = document.getElementById("idleTip");
let idleTipInterval = null;
let idleTipIdx = 0;

function showIdle() {
  idleOverlay.classList.remove("hide");
  idleTipIdx = 0;
  const tips = STRINGS[currentLang].idleTips || STRINGS.en.idleTips;
  idleTipEl.textContent = tips[0];
  clearInterval(idleTipInterval);
  idleTipInterval = setInterval(() => {
    idleTipIdx = (idleTipIdx + 1) % tips.length;
    idleTipEl.textContent = tips[idleTipIdx];
  }, 5000);
  clearTimeout(inactivityTimer);
}

function hideIdle() {
  idleOverlay.classList.add("hide");
  clearInterval(idleTipInterval);
  bumpActivity();
}

document.getElementById("idleCta").addEventListener("click", hideIdle);
idleOverlay.addEventListener("click", hideIdle);

let inactivityTimer = null;
const INACTIVITY_MS = 120000;
function bumpActivity() {
  if (!idleOverlay.classList.contains("hide")) return; // idle already showing
  if (dispenseScreen.classList.contains("show")) return; // dispense has its own countdown
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(returnToIdleFromInactivity, INACTIVITY_MS);
}
function returnToIdleFromInactivity() {
  if (emergencyOverlay.classList.contains("show")) return;
  resetKiosk();
}
// Tapping/clicking was the only thing that counted as "activity" before,
// so typing a chat message, reading the Terms box, or scrolling with a
// mouse wheel (none of which fire pointerdown) could silently run out the
// clock and bounce someone back to the idle screen mid-use. Listen for
// the full range of real interaction instead. `scroll` doesn't bubble, so
// it's caught in the capture phase to still hear it from any inner
// scrollable panel (chat log, terms box, checkout steps, etc.).
["pointerdown", "keydown", "input", "wheel", "touchmove"].forEach((evt) => {
  kiosk.addEventListener(evt, bumpActivity, { passive: true });
});
kiosk.addEventListener("scroll", bumpActivity, true);

function resetKiosk() {
  cart = [];
  updateCartFooter();
  closeCheckout();
  dispenseScreen.classList.remove("show");
  clearInterval(resetCountdownInterval);
  closeProductModal();
  closeSymptomModal();
  closeAiChat();
  closeCareScreen();
  searchInput.value = "";
  hideBanner();
  selectCategory("all");
  // Fresh customer, fresh conversation.
  chatLog.innerHTML = "";
  chatStarted = false;
  lastDiscussedProduct = null;
  showIdle();
}

// ============================================================
// Header dropdowns: language + accessibility
// ============================================================

const langDropdown = document.getElementById("langDropdown");
const a11yDropdown = document.getElementById("a11yDropdown");

function toggleLangDropdown(e) {
  e.stopPropagation();
  a11yDropdown.classList.remove("show");
  langDropdown.classList.toggle("show");
}
function toggleA11yDropdown(e) {
  e.stopPropagation();
  langDropdown.classList.remove("show");
  a11yDropdown.classList.toggle("show");
}
document.getElementById("langBtn").addEventListener("click", toggleLangDropdown);
document.getElementById("a11yBtn").addEventListener("click", toggleA11yDropdown);
// Disaster Relief Mode is a full-screen takeover that covers the normal
// header (and its lang/a11y buttons), so it gets its own pair of buttons
// wired to the exact same dropdowns rather than a duplicate settings UI.
document.getElementById("disasterLangBtn").addEventListener("click", toggleLangDropdown);
document.getElementById("disasterA11yBtn").addEventListener("click", toggleA11yDropdown);
const DROPDOWN_OPEN_IDS = new Set(["langBtn", "a11yBtn", "disasterLangBtn", "disasterA11yBtn"]);
kiosk.addEventListener("pointerdown", (e) => {
  if (!langDropdown.contains(e.target) && !DROPDOWN_OPEN_IDS.has(e.target.id)) langDropdown.classList.remove("show");
  if (!a11yDropdown.contains(e.target) && !DROPDOWN_OPEN_IDS.has(e.target.id)) a11yDropdown.classList.remove("show");
});

document.getElementById("langEnBtn").addEventListener("click", () => setLanguage("en"));
document.getElementById("langEsBtn").addEventListener("click", () => setLanguage("es"));

function setLanguage(lang) {
  currentLang = lang;
  document.getElementById("langCode").textContent = lang.toUpperCase();
  document.getElementById("disasterLangCode").textContent = lang.toUpperCase();
  document.getElementById("langEnBtn").classList.toggle("active", lang === "en");
  document.getElementById("langEsBtn").classList.toggle("active", lang === "es");

  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.getAttribute("data-i18n-placeholder")); });

  renderFilterBar();
  updateCartFooter();
  renderScenarioBanners();
  if (careScreen.classList.contains("show")) renderCareScreen();
  if (judgesOverlay.classList.contains("show")) { renderJudgesStockList(); updateJudgesToggleButtons(); }
  if (disasterMode) renderDisasterScreen();
  if (lastMode.type === "search") runSearch(lastMode.value);
  else selectCategory(lastMode.value);
}

// Accessibility toggles
function wireToggle(btnId, onChange) {
  const el = document.getElementById(btnId);
  el.addEventListener("click", () => {
    const on = !el.classList.contains("on");
    el.classList.toggle("on", on);
    onChange(on);
  });
}
wireToggle("largeTextToggle", (on) => {
  kiosk.classList.toggle("a11y-large", on);
  // `rem` is always relative to <html>, not to .kiosk, so the class has to
  // land on the real root too or every rem-sized font-size in the app
  // (including the disaster screen) silently ignores this toggle.
  document.documentElement.classList.toggle("a11y-large", on);
});
wireToggle("highContrastToggle", (on) => kiosk.classList.toggle("high-contrast", on));
wireToggle("darkModeToggle", (on) => { kiosk.dataset.theme = on ? "dark" : "light"; });

// ============================================================
// Judges panel — quick demo controls for presenting the kiosk live
// (simulate real-world scenarios, flip any item's stock on the fly)
// rather than exposing raw source. Directly mutates PRODUCTS' inStock
// flags and re-renders whatever view is currently open.
// ============================================================

const judgesOverlay = document.getElementById("judgesOverlay");
const judgesStockListEl = document.getElementById("judgesStockList");

function refreshCurrentView() {
  if (lastMode.type === "search") runSearch(lastMode.value);
  else selectCategory(lastMode.value);
}

function setProductStock(id, inStock) {
  const p = findProduct(id);
  if (!p || p.inStock === inStock) return;
  p.inStock = inStock;
  renderJudgesStockList();
  refreshCurrentView();
}

function renderJudgesStockList() {
  judgesStockListEl.innerHTML = "";
  PRODUCTS.forEach((p) => {
    const row = document.createElement("div");
    row.className = "judges-row";
    row.innerHTML = `
      <div class="jr-icon">${iconSvg(p.icon)}</div>
      <div class="jr-name"></div>
      <span class="jr-status"></span>
      <button class="jr-toggle"></button>
    `;
    row.querySelector(".jr-name").textContent = p.name;
    const statusEl = row.querySelector(".jr-status");
    const locked = isTempLocked(p);
    if (locked) { statusEl.textContent = t("tempLocked"); statusEl.classList.add("out"); }
    else { statusEl.textContent = p.inStock ? t("inStock") : t("outOfStock"); statusEl.classList.add(p.inStock ? "in" : "out"); }
    const btn = row.querySelector(".jr-toggle");
    if (locked) {
      btn.textContent = currentLang === "es" ? "Bloqueado" : "Locked";
      btn.disabled = true;
    } else {
      btn.textContent = p.inStock
        ? (currentLang === "es" ? "Agotar" : "Mark Out")
        : (currentLang === "es" ? "Reponer" : "Mark In");
      btn.addEventListener("click", () => setProductStock(p.id, !p.inStock));
    }
    judgesStockListEl.appendChild(row);
  });
}

// ---- Scenario 1: Thermal Stability Override ----

function renderScenarioBanners() {
  const el = document.getElementById("scenarioBanners");
  const banners = [];
  if (cabinetOverheated) {
    banners.push(`
      <div class="scenario-banner temp">
        ${iconSvg("thermometer")}
        <span class="sb-text">${t("thermalBannerText")}</span>
        <button id="resolveThermalBtn">${currentLang === "es" ? "Resolver" : "Resolve"}</button>
      </div>
    `);
  }
  el.innerHTML = banners.join("");
  const resolveThermal = document.getElementById("resolveThermalBtn");
  if (resolveThermal) resolveThermal.addEventListener("click", toggleThermalOverride);
}

function updateJudgesToggleButtons() {
  const thermalLabel = document.getElementById("thermalOverrideLabel");
  thermalLabel.textContent = cabinetOverheated
    ? (currentLang === "es" ? "Borrar Bloqueo Térmico" : "Clear Thermal Lockout")
    : (currentLang === "es" ? "Activar Bloqueo Térmico" : "Trigger Thermal Stability Override");
  document.getElementById("thermalOverrideBtn").classList.toggle("active-state", cabinetOverheated);

  const disasterLabel = document.getElementById("disasterModeLabel");
  disasterLabel.textContent = disasterMode
    ? (currentLang === "es" ? "Salir del Modo de Desastre" : "Exit Disaster Relief Mode")
    : (currentLang === "es" ? "Activar Modo de Desastre" : "Activate Disaster Relief Mode");
  document.getElementById("disasterModeBtn").classList.toggle("active-state", disasterMode);

  const jamLabel = document.getElementById("dispenserJamLabel");
  jamLabel.textContent = simulateDispenserJam
    ? (currentLang === "es" ? "Atasco Armado — Listo" : "Jam Armed — Ready")
    : (currentLang === "es" ? "Armar Atasco del Dispensador (Próximo Pedido)" : "Arm Dispenser Jam (Next Order)");
  document.getElementById("dispenserJamBtn").classList.toggle("active-state", simulateDispenserJam);
}

function toggleThermalOverride() {
  cabinetOverheated = !cabinetOverheated;
  updateJudgesToggleButtons();
  renderScenarioBanners();
  refreshCurrentView();
  if (cabinetOverheated) showToast(currentLang === "es" ? "🌡️ Anulación de estabilidad térmica activada" : "🌡️ Thermal stability override triggered");
}

// ---- Disaster Relief Mode: full-screen off-grid triage terminal ----

function toggleDisasterMode() {
  disasterMode = !disasterMode;
  updateJudgesToggleButtons();
  if (disasterMode) {
    closeJudgesPanel();
    disasterUiState = "triage";
    disasterActiveGroupId = null;
    disasterDispensedTotal = 0;
    disasterCategoryCounts = {};
    clearInterval(disasterCooldownInterval);
    renderDisasterScreen();
    document.getElementById("disasterScreen").classList.add("show");
  } else {
    clearInterval(disasterCooldownInterval);
    document.getElementById("disasterScreen").classList.remove("show");
  }
}

function disasterGroupCount(groupId) { return disasterCategoryCounts[groupId] || 0; }

// Everything NOT designated an emergency-triage item stays available in
// Disaster Relief Mode too — just at normal price, through the regular
// cart/checkout, not the free rationed dispense path.
function disasterEmergencyIds() { return new Set(TRIAGE_GROUPS.flatMap((g) => g.productIds)); }
function disasterOtherProducts() {
  const emergencyIds = disasterEmergencyIds();
  return PRODUCTS.filter((p) => !emergencyIds.has(p.id));
}

function updateDisasterCartButton() {
  const btn = document.getElementById("disasterCartBtn");
  const label = document.getElementById("disasterCartLabel");
  const n = cartCount();
  label.textContent = `${currentLang === "es" ? "Carrito" : "Cart"} (${n})${n ? " · " + money(cartSubtotal()) : ""}`;
  btn.disabled = n === 0;
}

function renderDisasterScreen() {
  if (disasterUiState === "triage") renderDisasterTriage();
  else if (disasterUiState === "items") renderDisasterItems(disasterActiveGroupId);
  // "guidance" and "cooldown" states render themselves directly when entered.
}

function renderDisasterTriage() {
  disasterUiState = "triage";
  const es = currentLang === "es";
  const body = document.getElementById("disasterBody");
  const atTotalCap = disasterDispensedTotal >= DISASTER_RATION_MAX_TOTAL;
  const tiles = TRIAGE_GROUPS.map((g) => {
    const used = disasterGroupCount(g.id);
    const groupFull = used >= g.max || atTotalCap;
    return `
      <div class="disaster-tile${groupFull ? " disabled" : ""}" data-group="${g.id}">
        <div class="dt-icon">${iconSvg(g.icon)}</div>
        <div class="dt-label">${es ? g.labelEs : g.labelEn}</div>
        <div class="dt-ration">${es ? "Ración" : "Ration"}: ${used}/${g.max}</div>
      </div>
    `;
  }).join("");
  body.innerHTML = `
    <div class="disaster-triage-wrap">
      <div class="disaster-triage-grid">${tiles}</div>
      <div class="disaster-tile other" data-group="other">
        <div class="dt-icon">${iconSvg("shield")}</div>
        <div class="dt-label">${es ? "Otros Suministros" : "Other Supplies"}</div>
        <div class="dt-ration">${es ? "Precio normal · sin ración" : "Standard price · not rationed"}</div>
      </div>
    </div>
  `;
  body.querySelectorAll(".disaster-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      disasterActiveGroupId = tile.dataset.group;
      renderDisasterItems(disasterActiveGroupId);
    });
  });
  updateDisasterCartButton();
}

function renderDisasterItems(groupId) {
  disasterUiState = "items";
  disasterActiveGroupId = groupId;
  const body = document.getElementById("disasterBody");
  const es = currentLang === "es";

  if (groupId === "other") {
    const items = disasterOtherProducts();
    body.innerHTML = `
      <div class="disaster-item-header">
        <button class="disaster-back-btn" id="disasterItemsBack">${iconSvg("chevronLeft")}</button>
        <div class="disaster-item-title">${es ? "Otros Suministros (Precio Normal)" : "Other Supplies (Standard Price)"}</div>
      </div>
      ${items.map((p) => `
        <div class="disaster-item-card standard">
          <div class="di-icon standard">${iconSvg(p.icon)}</div>
          <div class="di-info">
            <div class="di-name standard">${p.name}</div>
            <div class="di-price standard">${money(p.price)}</div>
          </div>
          <button class="di-dispense-btn standard" data-id="${p.id}" ${!p.inStock ? "disabled" : ""}>
            ${!p.inStock ? t("outOfStock") : (es ? "Agregar" : "Add to Cart")}
          </button>
        </div>
      `).join("")}
    `;
    document.getElementById("disasterItemsBack").addEventListener("click", renderDisasterTriage);
    body.querySelectorAll(".di-dispense-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = findProduct(btn.dataset.id);
        addToCart(p, 1);
        showToast(`${p.name} ${es ? "agregado a su pedido" : "added to your order"}`);
        updateDisasterCartButton();
      });
    });
    return;
  }

  const group = TRIAGE_GROUPS.find((g) => g.id === groupId);
  const atTotalCap = disasterDispensedTotal >= DISASTER_RATION_MAX_TOTAL;
  const groupFull = disasterGroupCount(groupId) >= group.max;
  const items = group.productIds.map(findProduct).filter(Boolean);

  body.innerHTML = `
    <div class="disaster-item-header">
      <button class="disaster-back-btn" id="disasterItemsBack">${iconSvg("chevronLeft")}</button>
      <div class="disaster-item-title">${es ? group.labelEs : group.labelEn}</div>
    </div>
    ${items.map((p) => `
      <div class="disaster-item-card">
        <div class="di-icon">${iconSvg(p.icon)}</div>
        <div class="di-info">
          <div class="di-name">${p.name}</div>
          <div class="di-price">$0.00 — ${es ? "Crédito de Emergencia" : "Emergency Relief Credit"}</div>
        </div>
        <button class="di-dispense-btn" data-id="${p.id}" ${(atTotalCap || groupFull || !p.inStock) ? "disabled" : ""}>
          ${!p.inStock ? t("outOfStock") : (es ? "Entregar Ahora" : "Dispense Now")}
        </button>
      </div>
    `).join("")}
  `;
  document.getElementById("disasterItemsBack").addEventListener("click", renderDisasterTriage);
  body.querySelectorAll(".di-dispense-btn").forEach((btn) => {
    btn.addEventListener("click", () => dispenseDisasterItem(findProduct(btn.dataset.id), group));
  });
}

function dispenseDisasterItem(product, group) {
  disasterDispensedTotal++;
  disasterCategoryCounts[group.id] = disasterGroupCount(group.id) + 1;
  renderDisasterGuidance(product);
}

function buildEmergencyGuidance(product) {
  const es = currentLang === "es";
  const parts = [product.instructions];
  if (product.warnings) parts.push(product.warnings);
  const closing = es
    ? "Si la persona está confundida, con dolor severo o inconsciente, busque refugio médico de inmediato."
    : "If the person is confused, in severe pain, or unconscious, seek immediate medical shelter.";
  return parts.join(" ") + " " + closing;
}

function renderDisasterGuidance(product) {
  disasterUiState = "guidance";
  const es = currentLang === "es";
  const body = document.getElementById("disasterBody");
  body.innerHTML = `
    <div class="disaster-guidance">
      <div class="dg-icon">${iconSvg("check")}</div>
      <div class="dg-title">${es ? "ENTREGANDO" : "DISPENSING"}: ${product.name}</div>
      <div class="dg-text">${es ? "Guía de Emergencia" : "Emergency Guidance"}: ${buildEmergencyGuidance(product)}</div>
      <div class="dg-qr-row">
        <div class="qr-placeholder"></div>
        <div class="dg-qr-text">${es
          ? "Escanee para guardar las pautas de tratamiento sin conexión en su teléfono — no requiere datos móviles."
          : "Scan to save these offline treatment guidelines to your phone — no cell data required."}</div>
      </div>
    </div>
  `;
  setTimeout(() => startDisasterCooldown(), 3000);
}

function startDisasterCooldown() {
  disasterUiState = "cooldown";
  let remaining = DISASTER_COOLDOWN_SECONDS;
  const render = () => {
    const es = currentLang === "es";
    document.getElementById("disasterBody").innerHTML = `
      <div class="disaster-cooldown">
        <div class="dc-icon">${iconSvg("clock")}</div>
        <div class="dc-title">${es ? "Reinicio de Seguridad" : "Safety Reset"}</div>
        <div class="dc-count">${remaining}s</div>
        <div class="dc-sub">${es
          ? `Permita que otros accedan a los suministros de emergencia. Próxima transacción disponible en ${remaining}s.`
          : `Please allow others access to emergency supplies. Next transaction available in ${remaining}s.`}</div>
      </div>
    `;
  };
  render();
  clearInterval(disasterCooldownInterval);
  disasterCooldownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(disasterCooldownInterval);
      disasterDispensedTotal = 0;
      disasterCategoryCounts = {};
      renderDisasterTriage();
      return;
    }
    render();
  }, 1000);
}

document.getElementById("disasterAiBtn").addEventListener("click", openAiChat);
document.getElementById("disasterEmergencyBtn").addEventListener("click", triggerEmergency);
document.getElementById("disasterExitBtn").addEventListener("click", toggleDisasterMode);
document.getElementById("disasterCartBtn").addEventListener("click", () => { if (cartCount() > 0) openCheckout(); });

function armDispenserJam() {
  simulateDispenserJam = true;
  updateJudgesToggleButtons();
  showToast(currentLang === "es" ? "🔧 Atasco del dispensador armado para el próximo pedido" : "🔧 Dispenser jam armed for the next order");
}

function simulateInteractionDemo() {
  addToCart(findProduct("aspirin"), 1);
  addToCart(findProduct("ibuprofen"), 1);
  closeJudgesPanel();
  openCheckout();
}

function triggerRedFlagDemo() {
  closeJudgesPanel();
  const query = "chest pain and left arm numbness";
  searchInput.value = query;
  runSearch(query);
}

function resetAllScenarios() {
  PRODUCTS.forEach((p) => { p.inStock = true; });
  cabinetOverheated = false;
  simulateDispenserJam = false;
  if (disasterMode) {
    disasterMode = false;
    clearInterval(disasterCooldownInterval);
    document.getElementById("disasterScreen").classList.remove("show");
  }
  renderJudgesStockList();
  updateJudgesToggleButtons();
  renderScenarioBanners();
  refreshCurrentView();
  showToast(currentLang === "es" ? "Todos los escenarios de demostración restablecidos" : "All demo scenarios reset");
}

function openJudgesPanel() {
  renderJudgesStockList();
  updateJudgesToggleButtons();
  judgesOverlay.classList.add("show");
}
function closeJudgesPanel() { judgesOverlay.classList.remove("show"); }
document.getElementById("judgesToggle").addEventListener("click", openJudgesPanel);
document.getElementById("judgesClose").addEventListener("click", closeJudgesPanel);
document.getElementById("thermalOverrideBtn").addEventListener("click", toggleThermalOverride);
document.getElementById("disasterModeBtn").addEventListener("click", toggleDisasterMode);
document.getElementById("dispenserJamBtn").addEventListener("click", armDispenserJam);
document.getElementById("interactionDemoBtn").addEventListener("click", simulateInteractionDemo);
document.getElementById("redFlagBtn").addEventListener("click", triggerRedFlagDemo);
document.getElementById("resetAllScenariosBtn").addEventListener("click", resetAllScenarios);

// ============================================================
// Init
// ============================================================

renderFilterBar();
selectCategory("all");
updateCartFooter();
showIdle();
