// The kiosk's AI Assistant engine.
//
// Fully offline and rule-based on purpose: a vending machine can't count on
// network access or an API key, and medical answers should be deterministic
// and auditable. Instead of one keyword lookup, this is a pipeline of
// intent handlers (emergency → small talk → cart actions → product Q&A →
// comparisons/interactions → catalog browsing → first-aid guidance →
// fuzzy "did you mean") that share:
//   • Spanish↔English understanding (queries are normalized to English
//     phrases first, and replies come back in the customer's language),
//   • typo tolerance (edit-distance against the catalog vocabulary),
//   • conversation memory (last product / list, pending "want me to add it?"),
//   • strict grounding: product facts come only from each product's own
//     label record; first-aid text comes from knowledge.js (checked against
//     Red Cross / Mayo Clinic / MedlinePlus / CDC guidance).
//
// Assistant.respond(text, ctx) is pure — it returns a description of what to
// say and do (replies, product cards, quick-reply chips, cart actions) and
// kiosk.js performs it. That keeps every safety gate (e.g. the mandatory
// dangerous-medicine acknowledgment) in one place: the kiosk.

const Assistant = (function () {
  // ------------------------------------------------------------------
  // Text normalization
  // ------------------------------------------------------------------
  const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Keeps apostrophes so the legacy keyword lists ("can't breathe") still match.
  function normKeep(s) {
    return stripAccents(String(s).toLowerCase())
      .replace(/[’‘`´]/g, "'")
      .replace(/[^a-z0-9\s'$%.+*\/()-]/g, " ")
      .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  // Apostrophes/hyphens removed: "what's" → "whats", "band-aid" → "band aid".
  function toPlain(keep) {
    return keep.replace(/'/g, "").replace(/(?<=[a-z])-(?=[a-z])/g, " ").replace(/\s+/g, " ").trim();
  }

  // Spanish → English phrase map (accent-stripped). Longest phrases first.
  const ES_PAIRS = [
    ["dolor de cabeza", "headache"], ["dolor de garganta", "sore throat"], ["dolor de estomago", "stomach ache"],
    ["dolor de barriga", "stomach ache"], ["dolor de espalda", "back pain"], ["dolor de muelas", "toothache"],
    ["dolor de dientes", "toothache"], ["dolor de pecho", "chest pain"], ["dolor muscular", "muscle pain"],
    ["dolores musculares", "muscle pain"], ["dolor de cuello", "neck pain"], ["dolor menstrual", "menstrual pain"],
    ["colicos menstruales", "menstrual cramps"], ["calambres menstruales", "menstrual cramps"], ["dolor", "pain"],
    ["me duele", "hurts"], ["duele", "hurts"], ["fiebre", "fever"], ["escalofrios", "chills"], ["tos", "cough"],
    ["resfriado", "cold"], ["catarro", "cold"], ["gripe", "flu"], ["congestion nasal", "stuffy nose"],
    ["nariz tapada", "stuffy nose"], ["moqueo", "runny nose"], ["estornudos", "sneezing"], ["alergias", "allergies"],
    ["alergia", "allergy"], ["alergico", "allergic"], ["picazon", "itching"], ["ronchas", "hives"],
    ["malestar estomacal", "upset stomach"], ["estomago", "stomach"], ["nauseas", "nausea"], ["vomitando", "vomiting"],
    ["vomito", "vomiting"], ["acidez", "heartburn"], ["indigestion", "indigestion"], ["diarrea", "diarrhea"],
    ["quemadura de sol", "sunburn"], ["quemaduras", "burn"], ["quemadura", "burn"], ["me queme", "i burned myself"],
    ["cortadura", "cut"], ["cortada", "cut"], ["corte", "cut"], ["herida", "wound"], ["raspadura", "scrape"],
    ["raspon", "scrape"], ["esguince", "sprain"], ["torcedura", "sprain"], ["moreton", "bruise"],
    ["hinchazon", "swelling"], ["hinchado", "swollen"], ["sangrado nasal", "nosebleed"],
    ["sangre por la nariz", "nosebleed"], ["me sangra la nariz", "nosebleed"], ["picadura", "sting"],
    ["piquete", "sting"], ["mordedura", "bite"], ["mareo por movimiento", "motion sickness"], ["mareo", "nausea"],
    ["deshidratado", "dehydrated"], ["deshidratacion", "dehydration"], ["golpe de calor", "heat stroke"],
    ["agotamiento por calor", "heat exhaustion"], ["insolacion", "heat stroke"], ["calor", "heat"],
    ["prueba de embarazo", "pregnancy test"], ["embarazada", "pregnant"], ["embarazo", "pregnancy"],
    ["menstruacion", "period"], ["regla", "period"], ["periodo", "period"], ["germenes", "germs"],
    ["lavarme las manos", "wash hands"],
    // products
    ["ibuprofeno", "ibuprofen"], ["aspirina", "aspirin"], ["paracetamol", "acetaminophen"],
    ["acetaminofen", "acetaminophen"], ["antihistaminico", "antihistamine"], ["descongestionante", "decongestant"],
    ["antiacido", "antacid"], ["antidiarreico", "antidiarrheal"], ["pastillas para la tos", "cough drops"],
    ["pastillas para la garganta", "cough drops"], ["gotas para la tos", "cough drops"],
    ["pomada antibiotica", "antibiotic ointment"], ["pomada", "ointment"], ["gasa", "gauze"], ["curitas", "bandaids"],
    ["curita", "bandaid"], ["tiritas", "bandaids"], ["vendas", "bandages"], ["venda", "bandage"],
    ["vendaje", "bandage"], ["bolsa de hielo", "cold pack"], ["compresa fria", "cold pack"],
    ["parche de calor", "heat patch"], ["parche de mentol", "menthol patch"], ["parche", "patch"],
    ["desinfectante de manos", "hand sanitizer"], ["gel antibacterial", "hand sanitizer"],
    ["protector solar", "sunscreen"], ["bloqueador solar", "sunscreen"], ["filtro solar", "sunscreen"],
    ["toallas sanitarias", "sanitary pads"], ["toallas femeninas", "sanitary pads"], ["tampones", "tampons"],
    ["suero oral", "electrolyte"], ["electrolitos", "electrolyte"], ["medicamento", "medicine"],
    ["medicina", "medicine"], ["pastillas", "pills"], ["analgesico", "painkiller"], ["calmante", "painkiller"],
    // cart / kiosk
    ["carrito", "cart"], ["mi pedido", "my order"], ["pedido", "order"], ["pagar", "pay"], ["comprar", "buy"],
    ["agregar", "add"], ["agrega", "add"], ["anadir", "add"], ["anade", "add"], ["poner", "put"],
    ["quitar", "remove"], ["quita", "remove"], ["eliminar", "remove"], ["vaciar", "clear"], ["borrar", "clear"],
    ["precio", "price"], ["cuanto cuesta", "how much does it cost"], ["cuanto cuestan", "how much do they cost"],
    ["cuesta", "cost"], ["cuanto", "how much"], ["cuantas", "how many"], ["cuantos", "how many"],
    ["mas barato", "cheapest"], ["mas caro", "most expensive"], ["barato", "cheap"], ["disponible", "available"],
    ["en existencia", "in stock"], ["agotado", "out of stock"], ["tienen", "do you have"], ["tienes", "do you have"],
    ["venden", "do you sell"], ["que hay en", "whats in"], ["hay en", "in"],
    // question words / grammar
    ["como te llamas", "whats your name"], ["quien eres", "who are you"], ["quien te hizo", "who made you"],
    ["que hora es", "what time is it"], ["cuentame un chiste", "tell me a joke"], ["chiste", "joke"],
    ["que es", "what is"], ["cual es", "what is"], ["cual", "which"], ["que", "what"], ["como", "how"],
    ["donde", "where"], ["cuando", "when"], ["por que", "why"], ["quien", "who"], ["puedo", "can i"],
    ["puede", "can"], ["debo", "should i"], ["deberia", "should"], ["es seguro", "is it safe"], ["seguro", "safe"],
    ["peligroso", "dangerous"], ["advertencias", "warnings"], ["efectos secundarios", "side effects"],
    ["instrucciones", "instructions"], ["dosis", "dose"], ["tomarlo", "take"], ["tomar", "take"], ["tomo", "take"],
    ["toma", "take"], ["usar", "use"], ["uso", "use"], ["sirve para", "good for"], ["es bueno para", "good for"],
    ["para", "for"], ["con", "with"], ["sin", "without"], ["juntos", "together"], ["juntas", "together"],
    ["mezclar", "mix"], ["combinar", "combine"], ["ninos", "children"], ["nino", "child"], ["bebe", "baby"],
    ["adultos", "adults"], ["diferencia entre", "difference between"], ["diferencia", "difference"],
    ["comparar", "compare"], ["contra", "versus"], ["y", "and"], ["o", "or"], ["el", "the"], ["la", "the"],
    ["los", "the"], ["las", "the"], ["un", "a"], ["una", "a"], ["en", "in"], ["mi", "my"], ["mis", "my"],
    ["del", "of the"], ["de", "of"], ["es", "is"], ["esto", "this"], ["eso", "that"],
    ["hola", "hello"], ["buenos dias", "good morning"], ["buenas tardes", "good afternoon"],
    ["buenas noches", "good evening"], ["muchas gracias", "thank you"], ["gracias", "thank you"],
    ["hasta luego", "goodbye"], ["adios", "goodbye"], ["ayudame", "help me"], ["necesito ayuda", "i need help"],
    ["ayuda", "help"], ["necesito", "i need"], ["tengo", "i have"], ["quiero", "i want"], ["me siento", "i feel"],
    ["no gracias", "no thanks"], ["por favor", "please"], ["claro", "sure"], ["si", "yes"],
    ["farmacia", "pharmacy"], ["sala de emergencias", "emergency room"], ["urgencias", "emergency room"],
    ["emergencia", "emergency"], ["ambulancia", "ambulance"], ["mas cercano", "nearest"], ["mas cercana", "nearest"],
    ["cerca", "nearby"], ["horario", "hours"], ["abierto", "open"], ["aceptan", "accept"], ["tarjeta", "card"],
    ["efectivo", "cash"], ["reembolso", "refund"], ["devolver", "return"], ["receta", "prescription"],
    ["identificacion", "id"], ["edad", "age"], ["idioma", "language"], ["en espanol", "in spanish"],
    ["en ingles", "in english"], ["espanol", "spanish"], ["ingles", "english"], ["hablar", "speak"],
    ["habla", "speak"], ["no puedo respirar", "cant breathe"], ["atragantado", "choking"],
    ["sobredosis", "overdose"], ["envenenamiento", "poisoning"], ["envenenado", "poisoned"],
    ["convulsion", "seizure"], ["mareado", "nauseous"], ["mareada", "nauseous"], ["auto", "car"], ["carro", "car"],
    ["coche", "car"], ["estoy", "i am"], ["muy", "very"],
  ].sort((a, b) => b[0].length - a[0].length).map(([es, en]) => [new RegExp(`(?<![a-z0-9])${es}(?![a-z0-9])`, "g"), en]);

  function toEnglish(plain) {
    let out = plain, hits = 0;
    for (const [re, en] of ES_PAIRS) {
      out = out.replace(re, () => { hits++; return " " + en + " "; });
    }
    return { text: out.replace(/\s+/g, " ").trim(), es: hits > 0 };
  }

  const has = (p, phrase) => (" " + p + " ").includes(" " + phrase + " ");
  const anyOf = (p, list) => list.some((x) => has(p, x));
  const rx = (p, re) => re.test(p);

  // ------------------------------------------------------------------
  // Vocabulary + typo correction
  // ------------------------------------------------------------------
  const COMMON = new Set(("clear empty reset remove delete cancel checkout start begin again clean hands hurts break broke works working the and that have with this from they would there their what about which when make like time just know take people into year your good some could them other than then look only come over think also back after work first well even want because these give most need help please should thanks thank today tonight yesterday morning night hello where while being right going doing feel feeling really very much many more less something anything nothing everything someone anyone always never again still since before under around between through medicine medicines doctor doctors hospital kiosk order orders price prices items item products product stock cheap cheaper cheapest expensive safe safely dangerous allergic better worse worst best hurts hurting having started getting taking trying using needs wants tells shows until maybe sometimes cannot without though another different difference together compare which whats whos hows wheres wont dont cant isnt arent didnt doesnt shouldnt couldnt wouldnt youre theyre ive youve ill thats there heres these those would could might must shall while whole every each both either neither little lots plenty enough quite pretty almost already often usually actually probably definitely sure okay yeah nope thing things stuff person kids child adult adults baby babies years months weeks days hours minutes night daily weekly").split(" "));
  const VOCAB = new Set();
  function addVocab(str) {
    normKeep(str).replace(/'/g, "").split(/[\s-]+/).forEach((w) => { if (w.length >= 5 && !/\d/.test(w)) VOCAB.add(w); });
  }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        cur.push(v);
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function nearest(token) {
    const max = token.length <= 7 ? 1 : 2;
    let best = null, bestD = max + 1;
    for (const v of VOCAB) {
      if (v[0] !== token[0]) continue;
      const d = lev(token, v, max);
      if (d < bestD) { bestD = d; best = v; if (d === 1) break; }
    }
    return bestD <= max ? best : null;
  }

  function correct(p) {
    return p.split(" ").map((tok) => {
      if (tok.length < 5 || /\d/.test(tok) || VOCAB.has(tok) || COMMON.has(tok)) return tok;
      return nearest(tok) || tok;
    }).join(" ");
  }

  // ------------------------------------------------------------------
  // Catalog lookups
  // ------------------------------------------------------------------
  const EXTRA_ALIASES = {
    bandaid: ["bandaid", "bandaids", "band aids", "bandages", "plasters", "adhesive bandages"],
    ointment: ["ointment", "antibiotic cream", "triple antibiotic"],
    gauze: ["gauze", "gauze pad", "gauze pads", "sterile gauze"],
    coldpack: ["cold pack", "cold packs", "ice pack", "ice packs", "instant cold pack"],
    ibuprofen: ["ibuprofin", "ibuprofen"],
    acetaminophen: ["paracetamol", "acetaminophen", "tylenol"],
    aspirin: ["asprin", "aspirin"],
    antihistamine: ["allergy relief", "allergy pill", "allergy pills", "allergy medicine", "benadryl"],
    coughdrops: ["cough drops", "cough drop", "lozenges", "throat lozenges"],
    coldflu: ["cold and flu", "cold flu caplets", "daytime cold and flu", "nyquil", "dayquil"],
    decongestant: ["decongestant", "nasal spray", "nasal decongestant", "sudafed"],
    antacid: ["antacid", "antacids", "tums", "antacid chewables", "heartburn tablets"],
    electrolyte: ["electrolyte", "electrolytes", "electrolyte packet", "rehydration packet", "pedialyte", "oral rehydration"],
    motionsickness: ["motion sickness tablets", "motion sickness pills", "dramamine", "travel sickness tablets"],
    antidiarrheal: ["anti diarrheal", "antidiarrheal", "imodium", "diarrhea caplets", "diarrhea medicine"],
    periodrelief: ["period pain relief", "period relief", "midol", "pamprin", "period pain caplets"],
    heatpatch: ["heat patch", "menstrual heat patch", "heating patch"],
    patch: ["menthol patch", "pain relief patch", "menthol pain relief patch"],
    pads: ["sanitary pads", "feminine pads", "hygiene pads", "pads", "menstrual pads"],
    tampons: ["tampons", "tampon"],
    pregnancytest: ["pregnancy test", "pregnancy tests"],
    sanitizer: ["hand sanitizer", "sanitizer", "hand gel"],
    sunscreen: ["sunscreen", "sun screen", "sunblock", "spf 30"],
  };
  const ALIASES = [];
  function buildAliases() {
    PRODUCTS.forEach((p) => {
      const names = new Set([toPlain(normKeep(p.name)), ...(EXTRA_ALIASES[p.id] || [])]);
      (MED_ALIASES[p.id] || []).forEach((a) => names.add(toPlain(normKeep(a))));
      // "Ibuprofen 200mg" → also "ibuprofen"
      names.add(toPlain(normKeep(p.name)).replace(/\b\d+\s?(mg|ml|oz)\b/g, "").replace(/\b(otc|spf \d+)\b/g, "").replace(/\s+/g, " ").trim());
      names.forEach((a) => { if (a && a.length >= 4) { ALIASES.push({ alias: a, product: p }); addVocab(a); } });
      addVocab(p.name);
    });
    ALIASES.sort((a, b) => b.alias.length - a.alias.length);
  }

  // Products mentioned in the text, in order of appearance, longest alias first.
  function findProducts(p) {
    const padded = " " + p + " ";
    const claimed = [];
    const found = [];
    for (const { alias, product } of ALIASES) {
      const re = new RegExp(`(?<= )${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?(?= )`);
      const m = re.exec(padded);
      if (!m) continue;
      const s = m.index, e = s + m[0].length;
      if (claimed.some(([a, b]) => s < b && e > a)) continue;
      claimed.push([s, e]);
      if (!found.some((f) => f.product.id === product.id)) found.push({ product, index: s });
    }
    return found.sort((a, b) => a.index - b.index).map((f) => f.product);
  }

  const CATEGORY_ALIASES = {
    emergency: ["first aid", "emergency supplies", "first aid supplies", "first aid items", "wound care"],
    pain: ["pain relief", "painkiller", "painkillers", "pain killer", "pain killers", "pain meds", "pain medicine", "pain medication", "pain reliever", "pain relievers", "analgesic", "analgesics"],
    coldallergy: ["cold and allergy", "cold allergy", "cold medicine", "cold meds", "cold remedies", "allergy medicine", "allergy meds", "cold and flu items"],
    stomach: ["stomach medicine", "stomach items", "digestion", "digestive", "stomach and digestion", "stomach relief"],
    wellness: ["wellness", "hygiene", "personal care", "feminine", "feminine hygiene", "wellness and hygiene"],
  };
  function findCategory(p) {
    for (const [id, list] of Object.entries(CATEGORY_ALIASES)) if (anyOf(p, list)) return id;
    return null;
  }

  // ------------------------------------------------------------------
  // Health topics
  // ------------------------------------------------------------------
  function findTopics(p) {
    const hits = [];
    HEALTH_TOPICS.forEach((tp) => {
      tp.triggers.forEach((tr) => { if (has(p, tr)) hits.push({ tp, tr, score: tr.split(" ").length * 20 + tr.length }); });
    });
    // "hay fever" is allergies, not fever; "burned in the sun" is sunburn, not a burn.
    const kept = hits.filter((h) => !hits.some((o) => o.tp !== h.tp && o.tr !== h.tr && (" " + o.tr + " ").includes(" " + h.tr + " ")));
    const best = new Map();
    kept.forEach((h) => { if (!best.has(h.tp) || best.get(h.tp) < h.score) best.set(h.tp, h.score); });
    return [...best.entries()].sort((a, b) => b[1] - a[1]).map(([tp]) => tp);
  }

  // ------------------------------------------------------------------
  // Response builder
  // ------------------------------------------------------------------
  const usd = (n) => "$" + n.toFixed(2);

  function newResp(lang, ctx) {
    const R = {
      lang, replies: [], products: [], chips: [], actions: [],
      emergency: false, care: false, last: undefined, lastList: undefined, pending: null, topic: null,
    };
    R.L = (en, es) => (lang === "es" ? es : en);
    R.say = (text, kind) => { R.replies.push({ text, kind: kind || "ai" }); return R; };
    R.chip = (en, es) => { R.chips.push(lang === "es" ? es : en); return R; };
    R.avail = (pr) => (ctx.isAvailable ? ctx.isAvailable(pr) : pr.inStock);
    R.reason = (pr) => (ctx.unavailableReason ? ctx.unavailableReason(pr) : (pr.inStock ? null : "stock"));
    return R;
  }

  const DISCLAIMER = {
    en: "General information, not medical advice for your situation — a pharmacist or doctor can help with that.",
    es: "Información general, no un consejo médico para su situación — un farmacéutico o médico puede ayudarle con eso.",
  };
  const SOURCE_NOTE = {
    en: "That's straight from this item's FDA-style Drug Facts label.",
    es: "Eso viene directo de la etiqueta de información de medicamento de este producto.",
  };
  const FIRSTAID_SOURCE = {
    en: "General first-aid guidance (consistent with Red Cross, Mayo Clinic & MedlinePlus). Not a diagnosis.",
    es: "Guía general de primeros auxilios (consistente con Cruz Roja, Mayo Clinic y MedlinePlus). No es un diagnóstico.",
  };

  function productLine(R, pr) {
    const r = R.reason(pr);
    const tag = r === "temp" ? R.L(" (temperature-locked right now)", " (bloqueado por temperatura ahora)")
      : r === "stock" ? R.L(" (out of stock)", " (agotado)") : "";
    return `• ${pr.name} — ${usd(pr.price)}${tag}`;
  }

  function categoryLabel(R, id) {
    return (typeof CATEGORY_LABELS !== "undefined" && CATEGORY_LABELS[R.lang][id]) || id;
  }

  function defaultChips(R) {
    suggestedPrompts(R.lang).slice(0, 4).forEach((c) => R.chips.push(c));
  }

  function suggestedPrompts(lang) {
    return lang === "es"
      ? ["Tengo dolor de cabeza", "¿Qué sirve para la tos?", "¿Cómo trato una quemadura?", "Compara ibuprofeno y acetaminofén", "¿Puedo tomar ibuprofeno con aspirina?", "¿Qué hay en mi carrito?", "¿Dónde está la sala de emergencias más cercana?"]
      : ["I have a headache", "What's good for a cough?", "How do I treat a burn?", "Compare ibuprofen and acetaminophen", "Can I take ibuprofen with aspirin?", "What's in my cart?", "Where is the nearest ER?"];
  }

  // Offer an available alternative if the top match can't be sold right now.
  function withAlternative(R, list) {
    if (!list.length) return list;
    const top = list[0];
    if (R.avail(top)) return list;
    const alt = list.find((x) => R.avail(x));
    const why = R.reason(top) === "temp"
      ? R.L("is temporarily temperature-locked", "está bloqueado temporalmente por temperatura")
      : R.L("is out of stock", "está agotado");
    if (alt) {
      const ing = alt.activeIngredient ? R.L(` (active ingredient: ${alt.activeIngredient})`, ` (ingrediente activo: ${alt.activeIngredient})`) : "";
      R.say(R.L(`${top.name} ${why} right now. A safe alternative: ${alt.name}${ing}.`, `${top.name} ${why} ahora mismo. Una alternativa segura: ${alt.name}${ing}.`), "warn");
      return [alt, ...list.filter((x) => x !== alt)];
    }
    R.say(R.L(`${top.name} ${why} right now, and I don't have an available alternative for it.`, `${top.name} ${why} ahora mismo y no tengo una alternativa disponible.`), "warn");
    return list;
  }

  function followUpChips(R, pr) {
    R.chip("What are the warnings?", "¿Cuáles son las advertencias?");
    R.chip("How do I take it?", "¿Cómo se toma?");
    if (R.avail(pr)) R.chip(`Add ${pr.name}`, `Agregar ${pr.name}`);
    const sibling = PRODUCTS.find((x) => x.category === pr.category && x.id !== pr.id && x.activeIngredient && x.category === "pain");
    if (sibling && pr.category === "pain") R.chip(`Compare ${pr.name.split(" ")[0]} and ${sibling.name.split(" ")[0]}`, `Compara ${pr.name.split(" ")[0]} y ${sibling.name.split(" ")[0]}`);
  }

  // ------------------------------------------------------------------
  // Handlers — each returns true when it fully handled the message
  // ------------------------------------------------------------------
  const EXTRA_EMERGENCY = [
    "coughing up blood", "coughing blood", "vomiting blood", "throwing up blood", "swollen tongue",
    "swelling of the face", "face swelling", "lips swelling", "swollen lips", "blue lips", "turning blue",
    "passed out", "worst headache of my life", "thunderclap headache", "cant feel my arm",
    "numb on one side", "sudden vision loss", "cant speak", "gunshot", "stabbed", "hit by a car",
    "drowning", "electrocuted", "suicide", "self harm", "hurt myself", "end my life", "having a stroke",
    "having a heart attack", "not responding", "wont wake up",
  ];
  const CRISIS = ["suicidal", "want to die", "kill myself", "suicide", "self harm", "hurt myself", "end my life"];

  function handleEmergency(keep, p, R) {
    let hit = EMERGENCY_KEYWORDS.find((kw) => phraseMatches(keep, kw)) || EXTRA_EMERGENCY.find((kw) => has(p, kw));
    if (!hit) return false;
    // Informational questions that merely contain a scary word.
    if (hit === "choking" && /hazard|toy|safe|lozenge|candy|drops/.test(p)) return false;
    if (hit === "stroke" && (/\b(heat|sun)\b/.test(p) || /\bstroke of (luck|genius|midnight|the pen)\b/.test(p))) return false;
    R.emergency = true;
    if (CRISIS.includes(hit) || CRISIS.some((c) => has(p, c))) {
      R.say(R.L(
        "I'm really sorry you're feeling this way, and I'm glad you said something — you deserve support right now. In the U.S. you can call or text 988 (the Suicide & Crisis Lifeline) any time, free and confidential. If you're in immediate danger, call 911.",
        "Lamento mucho que se sienta así, y me alegra que lo haya dicho — merece apoyo ahora mismo. En EE. UU. puede llamar o enviar un mensaje de texto al 988 (Línea de Prevención del Suicidio y Crisis) a cualquier hora, gratis y confidencial. Si está en peligro inmediato, llame al 911."), "warn");
    } else if (/overdos|poison/.test(hit) || /overdose|poison|took too many|took too much/.test(p)) {
      R.say(R.L("Call 911 now. You can also reach Poison Help at 1-800-222-1222 (free, 24/7). This machine can't help with this.",
        "Llame al 911 ahora. También puede llamar a Poison Help al 1-800-222-1222 (gratis, 24/7). Esta máquina no puede ayudar con esto."), "warn");
    } else {
      R.say(R.L("This could be a medical emergency. Please call 911 or go to the nearest emergency room right now — this machine can't help with this.",
        "Esto podría ser una emergencia médica. Llame al 911 o vaya a la sala de emergencias más cercana ahora mismo — esta máquina no puede ayudar con esto."), "warn");
    }
    return true;
  }

  const JOKES = {
    en: [
      "Why did the cold pack get promoted? It stayed cool under pressure.",
      "I'd tell you a joke about a bandage, but it might not stick.",
      "What do you call a doctor who fixes websites? A URL-ologist... okay, that one needs a second opinion.",
      "Why don't germs ever win at hide-and-seek? Because hand sanitizer always finds them.",
    ],
    es: [
      "¿Por qué ascendieron a la compresa fría? Porque mantuvo la calma bajo presión.",
      "Te contaría un chiste sobre una venda, pero podría no pegar.",
      "¿Por qué los gérmenes nunca ganan a las escondidas? Porque el desinfectante siempre los encuentra.",
    ],
  };
  let jokeIdx = 0;

  function safeMath(p) {
    const pct = p.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*\$?(\d+(?:\.\d+)?)/);
    if (pct) return (parseFloat(pct[1]) / 100) * parseFloat(pct[2]);
    let expr = p.replace(/^(what is|whats|calculate|compute|how much is|solve)\s+/, "").replace(/\$/g, "").replace(/\bx\b/g, "*").replace(/\s+/g, "");
    if (!/^[\d+\-*\/().]+$/.test(expr) || !/[+\-*\/]/.test(expr.replace(/^-/, ""))) return null;
    try {
      const v = Function(`"use strict"; return (${expr});`)();
      return Number.isFinite(v) ? v : null;
    } catch (e) { return null; }
  }

  function handleSmallTalk(p, R, ctx) {
    const words = p.split(" ").length;
    const L = R.L;
    const pendingAdd = ctx.pending && ctx.pending.type === "add" ? ctx.pending.ids.map((id) => PRODUCTS.find((x) => x.id === id)).filter(Boolean) : null;

    // yes / no follow-ups to something I offered
    if (words <= 4 && /^(yes|yeah|yep|yup|sure|ok|okay|please|please do|do it|go ahead|sounds good|yes please|sure thing)$/.test(p)) {
      if (pendingAdd && pendingAdd.length) {
        R.say(L(`Great — adding ${pendingAdd.map((x) => x.name).join(" and ")} to your order.`, `Perfecto — agregando ${pendingAdd.map((x) => x.name).join(" y ")} a su pedido.`));
        pendingAdd.forEach((x) => R.actions.push({ type: "add", id: x.id, qty: 1 }));
        return true;
      }
      R.say(L("Sure! What can I help you with — a symptom, a product question, or your cart?", "¡Claro! ¿En qué puedo ayudarle — un síntoma, una pregunta sobre un producto o su carrito?"));
      defaultChips(R);
      return true;
    }
    if (words <= 4 && /^(no|nope|nah|no thanks|not now|no thank you|never mind|nevermind|cancel|forget it)$/.test(p)) {
      R.say(L("No problem! I'm here if you need anything else.", "¡No hay problema! Aquí estoy si necesita algo más."));
      defaultChips(R);
      return true;
    }

    if (words <= 5 && /^(hello|hi|hey|yo|sup|howdy|greetings|good morning|good afternoon|good evening|hi there|hello there|hey there)( there| assistant| kiosk)?$/.test(p)) {
      const h = (ctx.now || new Date()).getHours();
      const tod = h < 12 ? L("Good morning", "Buenos días") : h < 18 ? L("Good afternoon", "Buenas tardes") : L("Good evening", "Buenas noches");
      R.say(L(`${tod}! I'm the MediVend assistant. Tell me what's going on — like "I have a headache" — or ask me about any item, your cart, or first aid.`, `¡${tod}! Soy el asistente de MediVend. Cuénteme qué le pasa — como "tengo dolor de cabeza" — o pregúnteme sobre cualquier artículo, su carrito o primeros auxilios.`));
      defaultChips(R);
      return true;
    }
    if (rx(p, /^(how are you|how are you doing|hows it going|how is it going|whats up|how do you do)\b/)) {
      R.say(L("I'm doing great, thanks for asking! I'm here 24/7 and ready to help. What's going on with you today?", "¡Muy bien, gracias por preguntar! Estoy aquí las 24 horas y listo para ayudar. ¿Qué le pasa hoy?"));
      defaultChips(R);
      return true;
    }
    if (rx(p, /^(ok |okay |great |cool |perfect |awesome |ok so )?(thanks|thank you|thx|ty|thanks a lot|thank you so much|thank you very much|much appreciated|appreciate it)( so much| a lot| very much)?( assistant| bot)?$/)) {
      R.say(L("You're welcome! Feel better soon. 💙", "¡De nada! Que se mejore pronto. 💙"));
      if (ctx.cart && ctx.cart.length) { R.chip("Checkout", "Pagar"); R.chip("What's in my cart?", "¿Qué hay en mi carrito?"); }
      else defaultChips(R);
      return true;
    }
    if (words <= 6 && rx(p, /^(bye|goodbye|see you|see ya|later|good night|cya|take care|have a good one)\b/)) {
      R.say(L("Take care, and feel better! If you're done, tap Review & Pay to check out.", "¡Cuídese y que se mejore! Si ya terminó, toque Revisar y Pagar para pagar."));
      return true;
    }
    if (rx(p, /\b(who are you|what are you|your name|introduce yourself|what should i call you|tell me about yourself)\b/)) {
      R.say(L("I'm the MediVend assistant — a rule-based helper that lives inside this kiosk. I can suggest items for symptoms, answer questions from each product's own label, compare products, check combinations, share basic first-aid guidance, and manage your cart. I'm not a doctor.",
        "Soy el asistente de MediVend — un ayudante basado en reglas que vive dentro de este quiosco. Puedo sugerir artículos según sus síntomas, responder preguntas con la etiqueta de cada producto, comparar productos, revisar combinaciones, compartir primeros auxilios básicos y manejar su carrito. No soy médico."));
      defaultChips(R);
      return true;
    }
    if (rx(p, /\bare you (a )?(real )?(doctor|nurse|pharmacist|human|person|robot|bot|ai|alive)\b/)) {
      R.say(L("I'm not a doctor, nurse, or pharmacist — I'm a software assistant running on this kiosk. I share general information from product labels and first-aid guidance; for personal medical advice, please ask a pharmacist or doctor.",
        "No soy médico, enfermero ni farmacéutico — soy un asistente de software que funciona en este quiosco. Comparto información general de las etiquetas y primeros auxilios; para consejo médico personal, consulte a un farmacéutico o médico."));
      return true;
    }
    if (rx(p, /^(help|help me|i need help|what can you do|how can you help( me)?|what can i ask( you)?|what do you know|what questions can i ask|capabilities|menu|options|commands)( please)?$/)) {
      R.say(L("Here's what I can do:\n• Suggest items for symptoms (\"I have a sore throat\")\n• Answer label questions (\"warnings for aspirin?\")\n• Compare products (\"ibuprofen vs acetaminophen\")\n• Check combinations (\"can I take these together?\")\n• Share first-aid steps (\"how do I treat a burn?\")\n• Manage your cart (\"add 2 bandages\", \"checkout\")\n• Find nearby ERs, urgent care & pharmacies\nI also understand Spanish!",
        "Esto es lo que puedo hacer:\n• Sugerir artículos para síntomas (\"tengo dolor de garganta\")\n• Responder preguntas de etiquetas (\"¿advertencias de la aspirina?\")\n• Comparar productos (\"ibuprofeno vs acetaminofén\")\n• Revisar combinaciones (\"¿puedo tomar estos juntos?\")\n• Compartir primeros auxilios (\"¿cómo trato una quemadura?\")\n• Manejar su carrito (\"agrega 2 vendas\", \"pagar\")\n• Encontrar salas de emergencia, atención urgente y farmacias cercanas\n¡También entiendo inglés!"));
      defaultChips(R);
      return true;
    }
    if (rx(p, /\b(speak|talk|switch|change|reply|answer|respond|use)( to| in| into)? (spanish|english)\b|^(in )?(spanish|english)( please)?$|^in (spanish|english)/)) {
      const to = /spanish/.test(p) ? "es" : "en";
      R.actions.push({ type: "setLang", lang: to });
      R.lang = to;
      R.say(to === "es" ? "¡Claro! Cambio todo el quiosco a español." : "Sure! Switching the whole kiosk to English.");
      return true;
    }
    if (rx(p, /\b(what time is it|current time|whats the time|what day is it|whats the date|todays date|what is today|whats today)\b/)) {
      const d = ctx.now || new Date();
      const time = d.toLocaleTimeString(R.lang === "es" ? "es-US" : "en-US", { hour: "numeric", minute: "2-digit" });
      const date = d.toLocaleDateString(R.lang === "es" ? "es-US" : "en-US", { weekday: "long", month: "long", day: "numeric" });
      R.say(L(`It's ${time} on ${date}, according to this kiosk's clock.`, `Son las ${time} del ${date}, según el reloj de este quiosco.`));
      return true;
    }
    if (rx(p, /\b(tell me a joke|joke|make me laugh|something funny|cheer me up)\b/)) {
      const list = JOKES[R.lang];
      R.say(list[jokeIdx++ % list.length]);
      return true;
    }
    const math = /^[\d\s$+\-*\/().x%]+$|^(what is|whats|calculate|compute|how much is|solve)\s+[\d\s$+\-*\/().x%]+|\d+\s*%\s*of\s*\$?\d/.test(p) ? safeMath(p) : null;
    if (math !== null) {
      R.say(`${p.replace(/^(what is|whats|calculate|compute|how much is|solve)\s+/, "")} = ${Math.round(math * 100) / 100}`);
      return true;
    }
    if (rx(p, /\b(you are|youre|ur) (so |very |really )?(smart|great|awesome|amazing|helpful|good|the best|cool|nice)\b|\b(good job|nice work|well done|great job)\b/)) {
      R.say(L("Thank you, that means a lot! I'm happy to help with anything else.", "¡Gracias, significa mucho! Con gusto le ayudo con algo más."));
      return true;
    }
    if (rx(p, /\b(stupid|dumb|useless|idiot|hate you|you suck|worthless|terrible bot)\b/)) {
      R.say(L("Sorry I missed the mark. Try rephrasing, or tell me the symptom or item — I can also show you nearby care if this kiosk can't help.", "Perdón por no acertar. Intente con otras palabras, o dígame el síntoma o artículo — también puedo mostrarle atención cercana si el quiosco no puede ayudar."), "ai");
      R.care = true;
      return true;
    }
    if (rx(p, /\b(scared|afraid|anxious|anxiety|worried|nervous|panicking|panic attack|stressed|overwhelmed)\b/) && !findTopics(p).length) {
      R.say(L("That sounds stressful, and it's okay to feel that way. If you can, take a slow breath in for 4 counts and out for 6. Tell me what physical symptoms you're having and I'll see how I can help. If you ever feel unsafe or have thoughts of harming yourself, call or text 988, or 911 in an emergency.",
        "Suena estresante, y está bien sentirse así. Si puede, inhale lento contando hasta 4 y exhale contando hasta 6. Dígame qué síntomas físicos tiene y veré cómo ayudar. Si alguna vez se siente inseguro o piensa en hacerse daño, llame o envíe un texto al 988, o al 911 en una emergencia."));
      defaultChips(R);
      return true;
    }
    if (rx(p, /\b(sad|depressed|lonely|hopeless)\b/) && !findTopics(p).length) {
      R.say(L("I'm sorry you're feeling low. I can only help with this kiosk's supplies and basic first aid, but you don't have to go through it alone — talking to someone helps. In the U.S. you can call or text 988 any time, free and confidential.",
        "Lamento que se sienta decaído. Solo puedo ayudar con los suministros del quiosco y primeros auxilios básicos, pero no tiene que pasar por esto solo — hablar con alguien ayuda. En EE. UU. puede llamar o enviar un texto al 988 a cualquier hora, gratis y confidencial."));
      return true;
    }
    return false;
  }

  // ---- cart ----
  function cartTotals(ctx) {
    const items = ctx.cart || [];
    const sub = items.reduce((s, c) => s + c.product.price * c.qty, 0);
    const tax = sub * (ctx.taxRate || 0);
    return { items, sub, tax, total: sub + tax };
  }

  // Quantity written right before this product's name: "2 bandaids", "two of the ibuprofen".
  function qtyFor(p, product) {
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    const padded = " " + p + " ";
    for (const { alias, product: pr } of ALIASES) {
      if (pr.id !== product.id) continue;
      const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = new RegExp(`(?<= )(\\d+|one|two|three|four|five|six)\\s+(?:(?:boxes|packs|bottles|packets|packages|tubes|of|the)\\s+)*${esc}(?:s|es)?(?= )`).exec(padded);
      if (m) {
        const q = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : words[m[1]];
        return Math.max(1, Math.min(q || 1, 10));
      }
    }
    return 1;
  }

  function handleCart(p, R, ctx, prods) {
    const L = R.L;
    const { items, sub, tax, total } = cartTotals(ctx);

    const asking = /^(how|what|why|where|when|is|does|do|can|could|should|will|are|which|who)\b/.test(p);
    if (!asking && rx(p, /^(please )?(check ?out|pay|pay now|buy now|place (my |the )?order|proceed( to checkout)?|im ready to pay|ready to pay|lets pay|lets check ?out|finish( up)?|im done|im ready)( please| now)?$|\b(go to|take me to|open) (the )?(checkout|cart)\b|\bcheck me out\b/)) {
      if (!items.length) {
        R.say(L("Your cart is empty right now — tell me what you need and I'll help you add it.", "Su carrito está vacío ahora — dígame qué necesita y le ayudo a agregarlo."));
        defaultChips(R);
        return true;
      }
      R.say(L(`Taking you to checkout — ${items.reduce((n, c) => n + c.qty, 0)} item(s), about ${usd(total)} with tax.`, `Le llevo a pagar — ${items.reduce((n, c) => n + c.qty, 0)} artículo(s), unos ${usd(total)} con impuesto.`));
      R.actions.push({ type: "openCheckout" });
      return true;
    }

    if (rx(p, /\b(empty|clear|reset|wipe|start over|delete)\b.*\b(cart|order|basket|everything|all)\b|\bstart over\b|\bremove (everything|all)\b|\bcancel (my |the )?order\b/)) {
      if (!items.length) { R.say(L("Your cart is already empty.", "Su carrito ya está vacío.")); return true; }
      R.say(L("Done — I've emptied your cart.", "Listo — vacié su carrito."));
      R.actions.push({ type: "clearCart" });
      return true;
    }

    if (rx(p, /^(please )?(remove|delete|take out|take off|drop|get rid of|cancel)\b/) && (prods.length || /\b(it|that|this|them)\b/.test(p))) {
      let targets = prods;
      if (!targets.length && ctx.lastProduct) targets = [ctx.lastProduct];
      const inCart = targets.filter((x) => items.some((c) => c.product.id === x.id));
      if (!inCart.length) {
        R.say(L("That isn't in your cart right now.", "Eso no está en su carrito ahora."));
        return true;
      }
      R.say(L(`Removing ${inCart.map((x) => x.name).join(" and ")} from your cart.`, `Quitando ${inCart.map((x) => x.name).join(" y ")} de su carrito.`));
      inCart.forEach((x) => R.actions.push({ type: "remove", id: x.id }));
      return true;
    }

    const cartCombo = prods.length && /\b(can i|could i|safe|ok|okay|should i|mix|together|interact|with)\b/.test(p);
    if (!cartCombo && rx(p, /\b(whats|what is|show|see|view|list|check|read)( me| back)?( what( is)?| whats)?( in)?( my| the)? (cart|order|basket)\b|^(my )?(cart|order|basket)( total)?$|\b(cart|order) (total|summary|contents)\b|\bhow (much|many)\b.*\b(my )?(cart|order|basket|total)\b|\bwhat have i (added|picked|selected|chosen)\b|\bwhat am i buying\b/)) {
      if (!items.length) {
        R.say(L("Your cart is empty. Tell me what's going on or what you need, and I'll help you find it.", "Su carrito está vacío. Dígame qué le pasa o qué necesita y le ayudo a encontrarlo."));
        defaultChips(R);
        return true;
      }
      const lines = items.map((c) => `• ${c.product.name} × ${c.qty} — ${usd(c.product.price * c.qty)}`).join("\n");
      R.say(L(`Here's your cart:\n${lines}\nSubtotal ${usd(sub)} + about ${usd(tax)} tax = ${usd(total)}.`, `Este es su carrito:\n${lines}\nSubtotal ${usd(sub)} + unos ${usd(tax)} de impuesto = ${usd(total)}.`));
      const combos = findInteractions(items.map((c) => c.product), R.lang);
      combos.forEach((w) => R.say(`⚠ ${w.title}: ${w.names.join(" + ")}. ${w.detail}`, "warn"));
      R.chip("Checkout", "Pagar");
      R.chip("Clear my cart", "Vaciar mi carrito");
      R.chip("What else might help?", "¿Qué más podría ayudar?");
      return true;
    }

    // add
    const stripped = p.replace(/^(hey |ok |okay |so |and )/, "").replace(/^(can|could|would|will) you( please)?\s+/, "").replace(/^(please\s+)/, "").replace(/\s+please$/, "").replace(/^(can|could) i (get|have|buy|order|grab)\s+/, "add ").replace(/^i (want|need|would like|d like|ll take|will take|wanna|gotta get|d like to (buy|get|have)|would like to (buy|get|have))\s+/, "add ");
    const addVerb = /^(add|put|get|give|buy|order|purchase|grab|include|throw in|toss in)\b/.test(stripped);
    const isQuestion = /^(how|what|why|is|does|do|can|could|should|will|are|which|when|where|who)\b/.test(stripped);
    const wantsIt = /^(add|put|get|give|buy|grab|take|include)\b.*\b(it|that|this|them|one)\b/.test(stripped) && !prods.length;
    if (addVerb && !isQuestion && (prods.length || wantsIt)) {
      let targets = prods.length ? prods : (ctx.lastList && ctx.lastList.length > 1 && /\b(them|all)\b/.test(stripped) ? ctx.lastList.slice(0, 3) : ctx.lastProduct ? [ctx.lastProduct] : []);
      if (!targets.length) return false;
      const qtyOf = (x) => qtyFor(stripped, x);
      const addable = [], blocked = [];
      targets.forEach((x) => (R.avail(x) ? addable : blocked).push(x));
      blocked.forEach((x) => {
        const why = R.reason(x) === "temp" ? L("temperature-locked right now", "bloqueado por temperatura ahora") : L("out of stock right now", "agotado ahora");
        R.say(L(`${x.name} is ${why}, so I can't add it.`, `${x.name} está ${why}, así que no puedo agregarlo.`), "warn");
      });
      if (blocked.length) {
        const alt = PRODUCTS.find((x) => x.category === blocked[0].category && R.avail(x) && x.id !== blocked[0].id);
        if (alt) { R.say(L(`Want ${alt.name} instead?`, `¿Le gustaría ${alt.name} en su lugar?`)); R.pending = { type: "add", ids: [alt.id] }; R.chip(`Add ${alt.name}`, `Agregar ${alt.name}`); }
      }
      if (addable.length) {
        const risky = addable.filter((x) => x.highRisk && !(ctx.ackedIds && ctx.ackedIds.includes(x.id)));
        const nameQ = (x) => (qtyOf(x) > 1 ? `${qtyOf(x)} × ${x.name}` : x.name);
        R.say(L(`Sure — adding ${addable.map(nameQ).join(" and ")} to your order.`, `Claro — agregando ${addable.map(nameQ).join(" y ")} a su pedido.`));
        if (risky.length) R.say(L(`Heads-up: ${risky.map((x) => x.name).join(" and ")} can be dangerous if misused, so you'll be asked to confirm you've read the warnings first.`, `Aviso: ${risky.map((x) => x.name).join(" y ")} puede ser peligroso si se usa mal, por eso se le pedirá confirmar que leyó las advertencias.`), "warn");
        addable.forEach((x) => R.actions.push({ type: "add", id: x.id, qty: qtyOf(x) }));
        R.chip("Checkout", "Pagar");
        R.chip("What's in my cart?", "¿Qué hay en mi carrito?");
      }
      R.last = targets[0];
      return true;
    }
    return false;
  }

  // ---- kiosk FAQ ----
  function handleFaq(p, R, ctx) {
    let best = null, bestScore = 0;
    KIOSK_FAQ.forEach((f) => {
      f.triggers.forEach((tr) => {
        if (has(p, tr)) {
          if (tr.split(" ").length === 1 && p.split(" ").length > 4) return; // too weak inside a longer sentence
          const score = tr.split(" ").length * 20 + tr.length;
          if (score > bestScore) { best = f; bestScore = score; }
        }
      });
    });
    if (!best) return false;
    // one-word triggers are too weak on their own inside a long sentence
    if (bestScore < 32 && p.split(" ").length > 6) return false;
    const pct = Math.round((ctx.taxRate || 0.07) * 100);
    R.say(best.answer[R.lang].replace("{tax}", String(pct)));
    if (best.showCare) R.care = true;
    R.topic = best.id;
    if (best.id === "hours" || best.id === "howto") defaultChips(R);
    return true;
  }

  // ---- product-centric ----
  const ALCOHOL_RE = /\b(alcohol|wine|beer|drink|drinking|drunk|liquor|vodka|whiskey|cocktail)\b/;

  function handleCompare(p, R, ctx, prods) {
    if (prods.length < 2) return false;
    const cue = /\b(difference|different|compare|comparison|versus|vs|better|stronger|safer|cheaper|which is|which one|or)\b/.test(p);
    const togetherWord = /\b(together|mix|mixing|combine|combining|same time|at once|interact|interaction|interactions)\b/.test(p);
    const withWord = /\b(with|along with|both|after|before|plus)\b|\btake\b.*\band\b/.test(p);
    const questionCue = /\b(can i|could i|is it safe|is it ok|okay to|safe to|should i|do they|will they)\b/.test(p);
    const together = togetherWord || (withWord && questionCue);
    if (together && !/\b(difference|compare|comparison|versus|vs)\b/.test(p)) return handleCombo(p, R, ctx, prods);
    if (!cue) return false;
    const [a, b] = prods;
    const L = R.L;
    const brief = (x) => L(`${x.name} (${x.dosage}) — ${usd(x.price)}\n   For: ${x.uses}\n   Active ingredient: ${x.activeIngredient || "—"}\n   Watch out: ${x.warnings}`,
      `${x.name} (${x.dosage}) — ${usd(x.price)}\n   Para: ${x.uses}\n   Ingrediente activo: ${x.activeIngredient || "—"}\n   Precaución: ${x.warnings}`);
    R.say(L(`Here's how they compare, straight from their labels:\n\n${brief(a)}\n\n${brief(b)}`, `Así se comparan, directo de sus etiquetas:\n\n${brief(a)}\n\n${brief(b)}`));
    const diff = Math.abs(a.price - b.price);
    if (diff > 0.005) {
      const cheaper = a.price < b.price ? a : b;
      R.say(L(`${cheaper.name} is ${usd(diff)} cheaper.`, `${cheaper.name} cuesta ${usd(diff)} menos.`));
    }
    const combos = findInteractions([a, b], R.lang);
    if (combos.length) R.say(L(`Note: don't take these two together — ${combos[0].detail}`, `Nota: no tome estos dos juntos — ${combos[0].detail}`), "warn");
    R.say(DISCLAIMER[R.lang], "system");
    R.products = [a, b];
    R.last = a; R.lastList = [a, b];
    if (R.avail(a)) R.chip(`Add ${a.name}`, `Agregar ${a.name}`);
    if (R.avail(b)) R.chip(`Add ${b.name}`, `Agregar ${b.name}`);
    return true;
  }

  function handleCombo(p, R, ctx, prods) {
    const L = R.L;
    const names = prods.map((x) => x.name);
    const joined = R.lang === "es" ? names.join(" y ") : names.join(" and ");
    const combos = findInteractions(prods, R.lang);
    if (combos.length) {
      R.say(L(`Careful — ${joined} shouldn't ${prods.length > 2 ? "all " : ""}be taken together. ${combos.map((c) => `${c.title}: ${c.detail}`).join(" ")}`, `Cuidado — ${joined} no deben tomarse juntos. ${combos.map((c) => `${c.title}: ${c.detail}`).join(" ")}`), "warn");
    } else {
      R.say(L(`This kiosk's safety checks don't flag ${joined} together. That's not a guarantee it's right for you though:\n${prods.map((x) => `• ${x.name}: ${x.warnings}`).join("\n")}\nAsk a pharmacist if you take other medicines or have health conditions.`,
        `Las revisiones de seguridad de este quiosco no señalan ${joined} juntos. Aun así no es una garantía para usted:\n${prods.map((x) => `• ${x.name}: ${x.warnings}`).join("\n")}\nConsulte a un farmacéutico si toma otros medicamentos o tiene condiciones de salud.`));
    }
    R.say(DISCLAIMER[R.lang], "system");
    R.products = prods.slice(0, 3);
    R.last = prods[0]; R.lastList = prods;
    return true;
  }

  // Remove product names so a product's own name ("pregnancy test") can't be
  // mistaken for the topic of the question ("is it safe in pregnancy?").
  function stripProductNames(p, prods) {
    let out = " " + p + " ";
    prods.forEach((pr) => {
      ALIASES.filter((a) => a.product.id === pr.id).forEach(({ alias }) => {
        out = out.replace(new RegExp(`(?<= )${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?(?= )`, "g"), " ");
      });
    });
    return out.replace(/\s+/g, " ").trim();
  }

  function handleProductMentions(p, keep, R, ctx, prods) {
    if (!prods.length) return false;
    const L = R.L;
    const pr = prods[0];
    const askAlcohol = ALCOHOL_RE.test(p);

    if (prods.length >= 2 && handleCompare(p, R, ctx, prods)) return true;

    // "compare it" / "alternatives to X" with just one product: use same-category siblings.
    if (prods.length === 1 && /\b(compare|comparison|difference|versus|vs|alternative|alternatives|instead of|similar|other options|something else|another (one|option))\b/.test(p)) {
      const sibs = PRODUCTS.filter((x) => x.category === pr.category && x.id !== pr.id && R.avail(x));
      if (sibs.length) {
        const wantsCompare = /\b(compare|comparison|difference|versus|vs)\b/.test(p);
        if (wantsCompare) return handleCompare(p + " vs", R, ctx, [pr, sibs[0]]);
        R.say(L(`Other options in ${categoryLabel(R, pr.category)} besides ${pr.name}:\n${sibs.slice(0, 4).map((x) => productLine(R, x)).join("\n")}`, `Otras opciones en ${categoryLabel(R, pr.category)} además de ${pr.name}:\n${sibs.slice(0, 4).map((x) => productLine(R, x)).join("\n")}`));
        R.products = sibs.slice(0, 3); R.last = sibs[0]; R.lastList = sibs;
        return true;
      }
    }

    // alcohol
    if (askAlcohol) {
      const mentions = /alcohol/i.test(pr.warnings || "");
      if (mentions) R.say(L(`On alcohol, ${pr.name}'s label warns: ${pr.warnings}`, `Sobre el alcohol, la etiqueta de ${pr.name} advierte: ${pr.warnings}`));
      else R.say(L(`${pr.name}'s label doesn't specifically mention alcohol, but alcohol can add to side effects of many medicines. Ask a pharmacist before combining them — its warning is: ${pr.warnings}`, `La etiqueta de ${pr.name} no menciona específicamente el alcohol, pero el alcohol puede sumarse a los efectos secundarios de muchos medicamentos. Consulte a un farmacéutico antes de combinarlos — su advertencia es: ${pr.warnings}`));
      R.say(DISCLAIMER[R.lang], "system");
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }

    // "is X good for Y" / "can I use X for Y"
    const forMatch = p.match(/\b(?:good|ok|okay|safe|effective|work|works|help|helps|use|used|take|best)\b.*?\bfor\b\s+(?:my\s+|a\s+|an\s+|the\s+)?(.+)$/);
    if (forMatch && !/\b(how (do|to|often|much|many|long)|dose|dosage|directions)\b/.test(p) && !/\b(kids|children|child|adults|baby|babies|pregnan\w*|elderly|seniors)\b/.test(forMatch[1]) && forMatch[1].split(" ").length <= 5) {
      const target = forMatch[1];
      const res = classify(target);
      const topic = findTopics(target)[0];
      const fits = (res.type === "products" && res.products.some((x) => x.id === pr.id)) || (topic && topic.products.includes(pr.id));
      if (fits) {
        R.say(L(`Yes — ${pr.name} is meant for that. Its label says: ${pr.uses}`, `Sí — ${pr.name} sirve para eso. Su etiqueta dice: ${pr.uses}`));
      } else {
        R.say(L(`${pr.name}'s label doesn't list that use. It's for: ${pr.uses}`, `La etiqueta de ${pr.name} no incluye ese uso. Sirve para: ${pr.uses}`));
        const better = res.type === "products" ? res.products.filter((x) => x.id !== pr.id).slice(0, 3) : [];
        if (better.length) { R.say(L(`For "${target}", this kiosk has: ${better.map((x) => x.name).join(", ")}.`, `Para "${target}", este quiosco tiene: ${better.map((x) => x.name).join(", ")}.`)); R.products = better; }
      }
      R.say(SOURCE_NOTE[R.lang] + " " + DISCLAIMER[R.lang], "system");
      if (!R.products.length) R.products = [pr];
      R.last = pr; R.lastList = R.products.slice();
      followUpChips(R, pr);
      return true;
    }

    // in stock / do you have
    if (/\b(in stock|available|do you have|do you carry|do you sell|is there|got any|have any|any left|still have)\b/.test(p) && !/\b(warnings?|dose|dosage|how|side effects?)\b/.test(p)) {
      const r = R.reason(pr);
      if (!r) {
        R.say(L(`Yes — ${pr.name} is in stock for ${usd(pr.price)}${pr.ageRestricted ? " (ID required at checkout)" : ""}.`, `Sí — ${pr.name} está disponible por ${usd(pr.price)}${pr.ageRestricted ? " (se requiere ID al pagar)" : ""}.`));
        R.pending = { type: "add", ids: [pr.id] };
        R.chip(`Add ${pr.name}`, `Agregar ${pr.name}`);
      } else {
        const list = withAlternative(R, [pr, ...PRODUCTS.filter((x) => x.category === pr.category && x.id !== pr.id)]);
        R.products = [list[0]];
      }
      R.products = R.products.length ? R.products : [pr];
      R.last = pr; R.lastList = R.products.slice();
      return true;
    }

    // where
    if (/\bwhere\b.*\b(is|find|can i find|do i find|are|would i find|located|get)\b/.test(p) || /\bwhere (can|do) i (find|get|buy)\b/.test(p)) {
      R.say(L(`${pr.name} is under ${categoryLabel(R, pr.category)}. Tap Add and it's dispensed from slot ${pr.slot} after you pay.`, `${pr.name} está en ${categoryLabel(R, pr.category)}. Toque Agregar y se dispensa desde la ranura ${pr.slot} después de pagar.`));
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }

    // pack size
    if (/\bhow many\b.*\b(are|come|comes|in|does|do you get|pieces|pills|tablets|caplets|patches)\b(?!.*\b(take|per day|a day|daily)\b)|\b(pack size|what size|how big|package size)\b/.test(p) && !/\b(take|dose|per day|a day|daily|can i)\b/.test(p)) {
      R.say(L(`${pr.name} comes as: ${pr.dosage}.`, `${pr.name} viene en presentación de: ${pr.dosage}.`));
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }

    // age restriction
    if (/\b(id|age|old enough|minor|underage|under 18)\b/.test(p) && !ALCOHOL_RE.test(p) && /\b(need|require|required|restricted|allowed|buy|old|who can)\b/.test(p)) {
      R.say(pr.ageRestricted
        ? L(`Yes — ${pr.name} is age-restricted, so you'll scan a valid photo ID at checkout. (Its label: ${pr.warnings})`, `Sí — ${pr.name} tiene restricción de edad, así que escaneará una identificación válida al pagar. (Su etiqueta: ${pr.warnings})`)
        : L(`No — ${pr.name} isn't age-restricted here, so no ID is needed.`, `No — ${pr.name} no tiene restricción de edad aquí, así que no se necesita ID.`));
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      return true;
    }

    // "is 2 ibuprofen ok?" / "can I take 3?" — answer from the label's own limits
    if (/\b(is|are|can i|could i|should i|ok|okay|safe)\b/.test(p) && /\b(\d+|two|three|four|five|six|several|a few|some|double|extra)\b/.test(p) && !/\$|\b(dollar|dollars|cost|price|cents)\b/.test(p)) {
      R.say(L(`Here's what ${pr.name}'s label says about how much to take: ${pr.instructions} Don't take more than the label allows, and ask a pharmacist if you're unsure.`, `Esto dice la etiqueta de ${pr.name} sobre cuánto tomar: ${pr.instructions} No tome más de lo que permite la etiqueta y consulte a un farmacéutico si tiene dudas.`));
      R.say(SOURCE_NOTE[R.lang] + " " + DISCLAIMER[R.lang], "system");
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }

    // label-grounded Q&A (uses/warnings/dosage/allergy/ingredient/price/...)
    const pq = stripProductNames(p, prods);
    const cat = detectQuestionCategory(pq);
    if (cat && cat.key === "special") {
      const childSpecific = /child|teen|under \d/i.test(pr.warnings || "");
      R.say(childSpecific
        ? L(`Good question — ${pr.name}'s label specifically warns: ${pr.warnings} For pregnancy, nursing, or anything for a child, please check with a pharmacist or doctor first.`,
          `Buena pregunta — la etiqueta de ${pr.name} advierte específicamente: ${pr.warnings} Para embarazo, lactancia o cualquier uso en un niño, consulte primero a un farmacéutico o médico.`)
        : L(`${pr.name}'s directions are written for adults. If you're pregnant, nursing, or it's for a child, please check with a pharmacist or doctor first — they can confirm the right choice and dose.`,
          `Las instrucciones de ${pr.name} son para adultos. Si está embarazada, amamantando o es para un niño, consulte primero a un farmacéutico o médico — pueden confirmar la opción y dosis correctas.`));
      R.say(DISCLAIMER[R.lang], "system");
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }
    const qa = answerMedQuestion(pq, pr, R.lang);
    if (qa) {
      R.say(qa.reply);
      R.say(qa.sourced ? SOURCE_NOTE[R.lang] + " " + DISCLAIMER[R.lang] : DISCLAIMER[R.lang], "system");
      const risk = pr.highRisk ? L(`Because ${pr.name} can be dangerous if misused, you'll confirm you've read its warnings before adding it.`, `Como ${pr.name} puede ser peligroso si se usa mal, confirmará que leyó sus advertencias antes de agregarlo.`) : null;
      if (risk && /warning|danger|safe|side effect|overdose|too much/.test(p)) R.say(risk, "warn");
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }

    if (prods.length >= 2) {
      const [a, b] = prods;
      R.say(L(`${a.name} — ${usd(a.price)}: ${a.uses}\n\n${b.name} — ${usd(b.price)}: ${b.uses}`, `${a.name} — ${usd(a.price)}: ${a.uses}\n\n${b.name} — ${usd(b.price)}: ${b.uses}`));
      R.products = [a, b]; R.last = a; R.lastList = [a, b];
      R.chip(`Compare ${a.name} and ${b.name}`, `Compara ${a.name} y ${b.name}`);
      R.chip(`Can I take ${a.name} with ${b.name}?`, `¿Puedo tomar ${a.name} con ${b.name}?`);
      return true;
    }

    // just a product name (or "tell me about X")
    const short = p.split(" ").length <= 7;
    if (short || /\b(tell me about|about|info|information|details|what is|whats)\b/.test(p)) {
      const r = R.reason(pr);
      R.say(L(`${pr.name} — ${pr.dosage}, ${usd(pr.price)}${r ? (r === "temp" ? " (temperature-locked right now)" : " (out of stock right now)") : ""}.\nUsed for: ${pr.uses}`, `${pr.name} — ${pr.dosage}, ${usd(pr.price)}${r ? (r === "temp" ? " (bloqueado por temperatura ahora)" : " (agotado ahora)") : ""}.\nSe usa para: ${pr.uses}`));
      R.products = [pr]; R.last = pr; R.lastList = [pr];
      followUpChips(R, pr);
      return true;
    }
    return false;
  }

  // ---- catalog browsing ----
  function handleCatalog(p, keep, R, ctx) {
    const L = R.L;
    const cat = findCategory(p);
    const underN = p.match(/\b(?:under|below|less than|max|at most|no more than|cheaper than)\s*\$?(\d+(?:\.\d+)?)/);
    const priceCue = /\b(cheapest|cheap|least expensive|lowest price|most affordable|budget|most expensive|priciest|highest price)\b/.test(p) || !!underN;
    const listCue = /\b(show|list|what|which|any|got|have|options|types|kinds|browse|see|carry|sell|selection|items|products|do you have|whats)\b/.test(p);
    const overview = /\b(what (do|can) you (have|sell|carry|offer)|what products|what items|whats available|what is available|show (me )?(everything|all)|list (all|everything)|catalog|inventory|everything you (have|sell)|all (items|products)|what do you stock)\b/.test(p);
    const stockList = /\b(out of stock|sold out|unavailable|not available|whats missing|what is missing)\b/.test(p);

    if (stockList) {
      const out = PRODUCTS.filter((x) => !R.avail(x));
      R.say(out.length
        ? L(`Right now these aren't available:\n${out.map((x) => productLine(R, x)).join("\n")}`, `Ahora mismo estos no están disponibles:\n${out.map((x) => productLine(R, x)).join("\n")}`)
        : L("Everything is in stock and available right now.", "Todo está disponible ahora mismo."));
      return true;
    }

    if (priceCue) {
      // price-ranked lists, optionally within a category or for a symptom
      let pool = cat ? PRODUCTS.filter((x) => x.category === cat) : PRODUCTS.slice();
      const sym = classify(keep);
      if (!cat && sym.type === "products") pool = PRODUCTS.filter((x) => sym.products.some((y) => y.id === x.id) || x.keywords.some((k) => phraseMatches(keep, k)));
      pool = pool.filter((x) => R.avail(x));
      const under = underN;
      if (under) pool = pool.filter((x) => x.price <= parseFloat(under[1]));
      if (!pool.length) return false;
      const desc = /\b(most expensive|priciest|highest price)\b/.test(p);
      pool.sort((a, b) => (desc ? b.price - a.price : a.price - b.price));
      const top = pool.slice(0, under ? 6 : 3);
      const label = under ? L(`Items ${usd(parseFloat(under[1]))} or less${cat ? " in " + categoryLabel(R, cat) : ""}`, `Artículos de ${usd(parseFloat(under[1]))} o menos${cat ? " en " + categoryLabel(R, cat) : ""}`)
        : desc ? L("The priciest options", "Las opciones más caras") : L("The most affordable options", "Las opciones más económicas");
      R.say(`${label}:\n${top.map((x) => productLine(R, x)).join("\n")}`);
      R.products = top.slice(0, 3); R.last = top[0]; R.lastList = top;
      return true;
    }

    if (cat && (listCue || p.split(" ").length <= 4)) {
      const list = PRODUCTS.filter((x) => x.category === cat);
      R.say(L(`${categoryLabel(R, cat)} — ${list.length} items:\n${list.map((x) => productLine(R, x)).join("\n")}`, `${categoryLabel(R, cat)} — ${list.length} artículos:\n${list.map((x) => productLine(R, x)).join("\n")}`));
      R.products = list.filter((x) => R.avail(x)).slice(0, 3);
      R.last = list[0]; R.lastList = list;
      R.actions.push({ type: "browse", category: cat });
      R.chip("What's the cheapest?", "¿Cuál es el más barato?");
      return true;
    }

    if (overview && !findTopics(p).length && classify(keep).type !== "products") {
      const groups = CATEGORIES.map((c) => `• ${categoryLabel(R, c.id)}: ${PRODUCTS.filter((x) => x.category === c.id).length}`);
      R.say(L(`I have ${PRODUCTS.length} over-the-counter items in ${CATEGORIES.length} groups:\n${groups.join("\n")}\nTell me a symptom or pick a group and I'll narrow it down.`, `Tengo ${PRODUCTS.length} artículos de venta libre en ${CATEGORIES.length} grupos:\n${groups.join("\n")}\nDígame un síntoma o elija un grupo y lo reduzco.`));
      CATEGORIES.forEach((c) => R.chip(CATEGORY_LABELS.en[c.id], CATEGORY_LABELS.es[c.id]));
      return true;
    }
    return false;
  }

  // ---- first aid + symptoms ----
  const HOWTO_RE = /\b(what is|what are|tell me about|explain|info(rmation)? (on|about)|how (do|can|should|to|would)|what (should|do|can|to) (i|we|you) do|what to do|first aid|treat|treatment|remedy|remedies|home remedy|get rid of|cure|tips|advice|self care|steps|cope|deal with|handle|soothe|relieve|stop|reduce|prevent|signs of|symptoms of|when (should|do|to)|is it serious|should i (worry|be worried|see|go|call))\b/;

  function stepsBlock(R, tp, max) {
    const steps = tp.steps[R.lang].slice(0, max || 99);
    return `${tp.title[R.lang]}:\n${steps.map((s) => "• " + s).join("\n")}`;
  }

  function handleHealth(p, keep, R, ctx) {
    const L = R.L;
    const topics = findTopics(p).slice(0, 2);
    const res = classify(keep);

    if (res.type === "not_equipped" && !topics.length) {
      R.say(L("This machine isn't equipped for that, or it's a prescription-only medicine. Please see a doctor or pharmacy — here are the closest ones.", "Esta máquina no está equipada para eso, o es un medicamento con receta. Consulte a un médico o farmacia — estas son las más cercanas."), "warn");
      R.care = true;
      return true;
    }

    if (topics.length) {
      const asksHow = HOWTO_RE.test(p);
      const asksWhen = /\b(when (should|do|to)|is it serious|should i (worry|be worried|see|go|call)|see a doctor|go to the (er|hospital))\b/.test(p);
      R.topic = topics[0].id;
      // product list: symptom-scored products first, then topic suggestions
      let list = [];
      if (res.type === "products") list.push(...res.products);
      topics.forEach((tp) => tp.products.forEach((id) => { const x = PRODUCTS.find((y) => y.id === id); if (x && !list.includes(x)) list.push(x); }));

      if (topics[0].id === "whentogo" || topics[0].id === "safety" || topics[0].id === "poison") {
        R.say(stepsBlock(R, topics[0]));
        R.say(FIRSTAID_SOURCE[R.lang], "system");
        if (topics[0].showCare) R.care = true;
        R.chip("Where is the nearest ER?", "¿Dónde está la sala de emergencias más cercana?");
        return true;
      }

      if (asksHow || asksWhen) {
        topics.forEach((tp, i) => {
          if (asksWhen && !asksHow) {
            R.say(L(`${tp.title.en} — get medical help if ${tp.seek.en || "symptoms are severe, get worse, or worry you"}`, `${tp.title.es} — busque atención médica si ${tp.seek.es || "los síntomas son graves, empeoran o le preocupan"}`), "warn");
          } else {
            R.say(stepsBlock(R, tp));
            if (tp.seek[R.lang]) R.say(L(`Get medical help if: ${tp.seek.en}`, `Busque atención médica si: ${tp.seek.es}`), "warn");
          }
        });
        if (list.length) {
          const avail = list.filter((x) => R.avail(x));
          const show = withAlternative(R, list).slice(0, 3);
          R.say(L(`Supplies from this kiosk that can help: ${show.map((x) => x.name).join(", ")}.`, `Suministros de este quiosco que pueden ayudar: ${show.map((x) => x.name).join(", ")}.`));
          R.products = show;
          if (avail[0]) { R.pending = { type: "add", ids: [avail[0].id] }; R.chip(`Add ${avail[0].name}`, `Agregar ${avail[0].name}`); }
          R.last = show[0]; R.lastList = show;
        }
        R.say(FIRSTAID_SOURCE[R.lang], "system");
        R.chip("When should I see a doctor?", "¿Cuándo debo ir al médico?");
        R.chip("Where is the nearest ER?", "¿Dónde está la sala de emergencias más cercana?");
        return true;
      }

      // statement of a symptom: recommend + brief tips + red flags
      list = list.slice(0, 3);
      const shown = withAlternative(R, list);
      R.say(topics.length > 1
        ? L(`Sorry you're dealing with ${topics.map((x) => x.title.en.split(/[,&]/)[0].trim().toLowerCase()).join(" and ")}. `, `Lamento que tenga ${topics.map((x) => x.title.es.split(/[,]| y /)[0].trim().toLowerCase()).join(" y ")}. `) + (shown.length ? L(`From this kiosk, these could help: ${shown.slice(0, 3).map((x) => x.name).join(", ")}.`, `De este quiosco, esto podría ayudar: ${shown.slice(0, 3).map((x) => x.name).join(", ")}.`) : L("Here's what can help:", "Esto puede ayudar:"))
        : L("Sorry you're dealing with that. ", "Lamento que esté pasando por eso. ") + (shown.length ? (shown.length === 1 ? L(`Here's something that should help: ${shown[0].name}.`, `Esto debería ayudar: ${shown[0].name}.`) : L(`A couple of options that should help: ${shown.map((x) => x.name).join(", ")}.`, `Un par de opciones que deberían ayudar: ${shown.map((x) => x.name).join(", ")}.`)) : ""));
      R.products = shown;
      topics.forEach((tp) => {
        R.say(L(`Self-care tips (${tp.title.en}):\n${tp.steps.en.slice(0, 2).map((s) => "• " + s).join("\n")}`, `Cuidados en casa (${tp.title.es}):\n${tp.steps.es.slice(0, 2).map((s) => "• " + s).join("\n")}`));
        if (tp.seek[R.lang]) R.say(L(`Get medical help if: ${tp.seek.en}`, `Busque atención médica si: ${tp.seek.es}`), "warn");
      });
      R.say(FIRSTAID_SOURCE[R.lang], "system");
      const first = shown.find((x) => R.avail(x));
      if (first) { R.pending = { type: "add", ids: [first.id] }; R.chip(`Add ${first.name}`, `Agregar ${first.name}`); }
      R.chip("What are the warnings?", "¿Cuáles son las advertencias?");
      R.chip("How do I take it?", "¿Cómo se toma?");
      R.chip("When should I see a doctor?", "¿Cuándo debo ir al médico?");
      R.last = shown[0] || undefined; R.lastList = shown;
      return true;
    }

    if (res.type === "products") {
      const shown = withAlternative(R, res.products);
      R.say(shown.length === 1
        ? L(`Here's something that should help: ${shown[0].name}.`, `Esto debería ayudar: ${shown[0].name}.`)
        : L(`A couple of options that should help: ${shown.map((x) => x.name).join(", ")}.`, `Un par de opciones que deberían ayudar: ${shown.map((x) => x.name).join(", ")}.`));
      R.products = shown;
      R.say(DISCLAIMER[R.lang], "system");
      const first = shown.find((x) => R.avail(x));
      if (first) { R.pending = { type: "add", ids: [first.id] }; R.chip(`Add ${first.name}`, `Agregar ${first.name}`); }
      R.chip("What are the warnings?", "¿Cuáles son las advertencias?");
      R.last = shown[0]; R.lastList = shown;
      return true;
    }
    return false;
  }

  function handleNearby(p, R) {
    if (rx(p, /^(the )?(nearest |closest )?(urgent care|er|emergency room|hospital|pharmacy|clinic|doctor|drugstore)( near me| nearby)?$/) || rx(p, /\b(nearest|closest|near me|nearby|close by|around here|near here)\b.*\b(er|emergency room|hospital|urgent care|pharmacy|drugstore|doctor|clinic|walk in|care)\b|\bwhere\b.*\b(hospital|er|emergency room|urgent care|pharmacy|clinic|doctor)\b|\b(nearby care|nearest er|nearest hospital|find a doctor|find a pharmacy|call an ambulance)\b/)) {
      const er = typeof FACILITIES !== "undefined" && FACILITIES.er && FACILITIES.er[0];
      R.say(R.L(`The closest emergency room I have listed is ${er ? `${er.name} (${er.address}, ${er.phone})` : "in the Nearby Care & Pharmacy list"}. Below are ERs, urgent care and pharmacies near this kiosk. For a real emergency, call 911.`,
        `La sala de emergencias más cercana que tengo es ${er ? `${er.name} (${er.address}, ${er.phone})` : "la de la lista Atención Cercana y Farmacia"}. Abajo verá salas de emergencia, atención urgente y farmacias cerca de este quiosco. En una emergencia real, llame al 911.`));
      R.care = true;
      return true;
    }
    return false;
  }

  function outOfScope(p) {
    return rx(p, /\b(weather|forecast|news|stock market|sports?|score|movie|recipe|homework|capital of|who won|president|bitcoin|crypto|translate this|write me|poem|essay|code|lottery|horoscope|song|lyrics)\b/);
  }

  // ------------------------------------------------------------------
  // Main entry
  // ------------------------------------------------------------------
  let built = false;
  function ensureBuilt() {
    if (built) return;
    built = true;
    buildAliases();
    HEALTH_TOPICS.forEach((tp) => { tp.triggers.forEach(addVocab); });
    KIOSK_FAQ.forEach((f) => f.triggers.forEach(addVocab));
    Object.values(CATEGORY_ALIASES).flat().forEach(addVocab);
    ["prescription", "acetaminophen", "ibuprofen", "aspirin", "antihistamine", "decongestant", "antacid", "sunscreen", "sanitizer", "tampons", "pregnancy", "diarrhea", "headache", "stomach", "nausea", "cough", "allergy", "bandage", "ointment", "gauze", "electrolyte", "checkout", "cheapest", "compare", "difference", "together", "warnings", "dosage", "symptoms", "emergency", "pharmacy"].forEach((w) => VOCAB.add(w));
  }

  function respond(raw, ctx) {
    ensureBuilt();
    ctx = ctx || {};
    const keep0 = normKeep(raw);
    const plain0 = toPlain(keep0);
    const tr = toEnglish(plain0);
    const lang = tr.es || ctx.lang === "es" ? "es" : "en";
    const R = newResp(lang, ctx);
    if (!plain0) return R;

    const p = correct(tr.text);
    const keep = (keep0 + " " + p).trim(); // legacy lists match on original + corrected wording
    const prods = findProducts(p);
    // pronoun resolution for follow-ups
    const usesPronoun = /\b(it|this|that|these|those|the medicine|this medicine|this one|that one|them)\b/.test(p);
    const topicsHere = findTopics(p).length;
    const forCue = /\b(good|ok|okay|safe|work|works|help|helps|effective)\b.*\bfor\b/.test(p);
    const followUp = (detectQuestionCategory(p) || (typeof isQuestionLike === "function" && isQuestionLike(p))) && (!topicsHere || (usesPronoun && forCue));
    const shortFollowUp = detectQuestionCategory(p) && p.split(" ").length <= 8; // e.g. "what about for kids?"
    // "can I take aspirin with it / with what's in my cart?" — pair with the last product or the cart.
    const withCue = /\b(with|together|along with|mix|combine)\b/.test(p) && /\b(can i|could i|is it safe|is it ok|okay|safe|should i|do they|will they|interact)\b/.test(p);
    if (withCue && prods.length === 1 && usesPronoun && ctx.lastProduct && ctx.lastProduct.id !== prods[0].id) prods.unshift(ctx.lastProduct);
    if (withCue && prods.length >= 1 && /\b(my cart|my order|the cart|what i have|what i picked|what i added)\b/.test(p) && ctx.cart && ctx.cart.length) {
      ctx.cart.forEach((c) => { if (!prods.some((x) => x.id === c.product.id)) prods.push(c.product); });
    }
    const prodsOrLast = prods.length ? prods : ((usesPronoun || shortFollowUp) && followUp && ctx.lastProduct ? [ctx.lastProduct] : []);

    if (handleEmergency(keep, p, R)) return R;
    if (handleSmallTalk(p, R, ctx)) return finish(R, ctx);
    if (handleCart(p, R, ctx, prods)) return finish(R, ctx);
    if (handleNearby(p, R)) return finish(R, ctx);
    if (prods.length && handleProductMentions(p, keep, R, ctx, prods)) return finish(R, ctx);
    if (handleFaq(p, R, ctx)) return finish(R, ctx);
    if (!prods.length && prodsOrLast.length && handleProductMentions(p, keep, R, ctx, prodsOrLast)) return finish(R, ctx);
    if (handleCatalog(p, keep, R, ctx)) return finish(R, ctx);
    if (handleHealth(p, keep, R, ctx)) return finish(R, ctx);

    // Fallback: typo hints, out-of-scope, or a gentle nudge.
    if (outOfScope(p)) {
      R.say(R.L("That's outside what I can help with — I have no internet here, and I only know this kiosk's products, label facts, and basic first aid. Try asking me about a symptom or an item!",
        "Eso está fuera de lo que puedo hacer — aquí no tengo internet y solo conozco los productos del quiosco, los datos de las etiquetas y primeros auxilios básicos. ¡Pregúnteme sobre un síntoma o un artículo!"));
      defaultChips(R);
      return finish(R, ctx);
    }
    const hint = didYouMean(p);
    if (hint.length) {
      R.say(R.L(`I'm not sure I understood. Did you mean one of these?`, `No estoy seguro de haber entendido. ¿Quiso decir alguna de estas?`));
      hint.forEach((h) => R.chips.push(h));
    } else {
      const isQ = typeof isQuestionLike === "function" && isQuestionLike(raw);
      R.say(isQ
        ? R.L("I can really only speak to this kiosk's items, first aid, and how the kiosk works — try naming an item, like \"what are the warnings for ibuprofen?\", or describe a symptom like \"sore throat\".", "Solo puedo hablar de los artículos del quiosco, primeros auxilios y cómo funciona el quiosco — intente nombrar un artículo, como \"¿cuáles son las advertencias del ibuprofeno?\", o describa un síntoma como \"dolor de garganta\".")
        : R.L("Hmm, I'm not sure what would help with that — try describing the symptom, like \"sore throat\" or \"upset stomach,\" and I'll see what this kiosk has.", "No estoy seguro qué ayudaría con eso — intente describir el síntoma, como \"dolor de garganta\" o \"dolor de estómago\", y veré qué tiene este quiosco."));
      defaultChips(R);
    }
    R.care = true;
    return finish(R, ctx);
  }

  function didYouMean(p) {
    const cands = new Map();
    p.split(" ").forEach((tok) => {
      if (tok.length < 4 || COMMON.has(tok) || VOCAB.has(tok)) return;
      const near = nearestLoose(tok);
      if (near) near.forEach((n) => cands.set(n, true));
    });
    return [...cands.keys()].slice(0, 3);
  }
  function nearestLoose(tok) {
    const out = [];
    for (const { alias, product } of ALIASES) {
      if (alias.length < 4 || alias.includes(" ")) continue;
      if (lev(tok, alias, 2) <= 2 && !out.includes(product.name)) out.push(product.name);
      if (out.length >= 2) break;
    }
    return out;
  }

  // carry memory forward
  function finish(R, ctx) {
    if (R.last === undefined) R.last = ctx.lastProduct || null;
    if (R.lastList === undefined) R.lastList = ctx.lastList || [];
    if (!R.chips.length && !R.emergency) {
      const cartHas = ctx.cart && ctx.cart.length;
      if (cartHas) { R.chip("What's in my cart?", "¿Qué hay en mi carrito?"); R.chip("Checkout", "Pagar"); }
      R.chip("Where is the nearest ER?", "¿Dónde está la sala de emergencias más cercana?");
    }
    return R;
  }

  return { respond, suggestedPrompts };
})();
