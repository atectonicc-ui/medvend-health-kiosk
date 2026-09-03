// Grounded medication Q&A for the AI Assistant.
//
// The kiosk has no network connection to call out to at runtime, so this
// cannot do a live FDA.gov lookup or run a real language model — instead
// every answer is drawn only from each product's own record in
// products.js, which is itself written to match the standardized FDA OTC
// Drug Facts monograph content for that active ingredient (the same
// wording required on the label regardless of brand). Replies are
// composed as plain conversational sentences rather than a
// "Label — Product: text" data dump, but the facts inside them never go
// beyond what that record actually states. Categories that aren't
// literally label text (price, prescription requirement, pregnancy/
// children, onset time) are marked `sourced: false` and skip the label
// citation.
//
// Matching is phrase-based and order-independent (via normalize/
// phraseMatches from ai.js) rather than exact-substring, and remembers the
// last product discussed in the conversation (passed in as
// `fallbackProduct`) so a bare follow-up like "how do I use it?" still
// resolves to the right item without re-naming it.

// Brand/common names shoppers actually say, mapped to a catalog product id.
const MED_ALIASES = {
  ibuprofen: ["ibuprofen", "advil", "motrin"],
  acetaminophen: ["acetaminophen", "tylenol"],
  aspirin: ["aspirin"],
  antihistamine: ["antihistamine", "benadryl", "diphenhydramine"],
  coldflu: ["cold and flu", "daytime cold", "dextromethorphan"],
  decongestant: ["decongestant", "sudafed", "oxymetazoline", "nasal spray"],
  antacid: ["antacid", "tums", "calcium carbonate"],
  motionsickness: ["motion sickness", "dramamine", "dimenhydrinate"],
  antidiarrheal: ["antidiarrheal", "imodium", "loperamide"],
  periodrelief: ["period pain relief", "midol", "pamprin", "pamabrom"],
  heatpatch: ["heat patch", "menstrual heat patch"],
  patch: ["menthol patch", "pain relief patch"],
  coughdrops: ["cough drop", "cough drops"],
  ointment: ["antibiotic ointment", "neosporin", "bacitracin"],
  sanitizer: ["hand sanitizer"],
  sunscreen: ["sunscreen"],
  bandaid: ["band-aid", "band aid", "bandage", "bandages"],
  gauze: ["gauze"],
  coldpack: ["cold pack", "ice pack"],
  electrolyte: ["electrolyte", "rehydration"],
  pads: ["sanitary pads"],
  tampons: ["tampons"],
  pregnancytest: ["pregnancy test"],
};

function findProductForQuestion(text) {
  const t = text.toLowerCase();
  let best = null;
  let bestLen = 0;
  PRODUCTS.forEach((p) => {
    const names = [p.name.toLowerCase(), ...(MED_ALIASES[p.id] || [])];
    names.forEach((n) => {
      if (t.includes(n) && n.length > bestLen) {
        best = p;
        bestLen = n.length;
      }
    });
  });
  return best;
}

// Order matters: more specific phrasings are checked first so a generic
// trigger like dosage's "how much" doesn't win over "how much does this
// cost" just because it comes first. `dosage` is deliberately last.
const QUESTION_CATEGORIES = [
  {
    key: "warnings", sourced: true,
    words: [
      "side effect", "side effects", "warning", "warnings", "risky", "is it safe",
      "safe to take", "danger", "dangerous", "harmful", "bad for me", "problem with",
      "issue with", "concern", "too much", "overdose", "precaution", "precautions",
      "should i avoid", "can it hurt", "is this ok", "is it ok", "what happens if",
    ],
  },
  {
    key: "allergy", sourced: true,
    words: ["allergy", "allergic", "allergen", "allergic reaction"],
  },
  {
    key: "ingredient", sourced: true,
    words: ["ingredient", "active ingredient", "what's in", "whats in", "contains", "made of", "what is in", "formula"],
  },
  {
    key: "interactions", sourced: true,
    words: ["alcohol", "drink", "interact", "interaction", "mix with", "together with", "combine with", "take with other", "while taking", "with other medic"],
  },
  {
    key: "uses", sourced: true,
    words: [
      "what is this for", "what's this for", "whats this for", "what does this treat",
      "what does this help", "what is it used for", "what's it used for", "used for",
      "good for", "help with", "what does it do", "what is this",
    ],
  },
  {
    key: "price", sourced: false,
    words: ["how much does this cost", "how much is this", "how much does it cost", "what does this cost", "price", "cost", "how much money"],
  },
  {
    key: "prescription", sourced: false,
    words: ["do i need a prescription", "is this prescription", "need a prescription", "prescription required", "over the counter", "is this otc"],
  },
  {
    key: "special", sourced: false,
    words: [
      "pregnant", "pregnancy", "breastfeeding", "nursing", "for kids", "for children",
      "child safe", "safe for kids", "safe for children", "give this to my child",
      "give my kid", "my son", "my daughter", "toddler",
    ],
  },
  {
    key: "onset", sourced: false,
    words: ["how fast", "how quickly", "how soon", "kick in", "start working", "take effect", "when will it work", "how long until"],
  },
  {
    key: "dosage", sourced: true,
    words: [
      "how much", "how many", "dose", "dosage", "how often", "when to take",
      "when should i take", "how do i take", "how to take", "how to use",
      "how do you use", "how do i use", "how should i use", "directions",
      "how long", "recommended dose", "usage", "application", "how do you take",
      "instructions", "when do i take", "how frequently", "how to apply",
    ],
  },
];

function detectQuestionCategory(text) {
  const t = normalize(text);
  for (const cat of QUESTION_CATEGORIES) {
    if (cat.words.some((w) => phraseMatches(t, w))) return cat;
  }
  return null;
}

// Broad question-starter words, matched anywhere in the message (not just
// at the start) via the same word-set matching ai.js uses for symptom
// search — so "hey how do I use this" or "is antihistamine safe for kids"
// both count, not just "how do I..."/"is it...".
const QUESTION_STARTERS = [
  "what", "how", "why", "is", "does", "do", "should", "will", "are",
  "was", "were", "did", "has", "have", "can i", "can you", "could i",
];
function isQuestionLike(text) {
  if (text.includes("?")) return true;
  const t = normalize(text);
  return QUESTION_STARTERS.some((w) => phraseMatches(t, w));
}

const REFERENCE_WORDS = ["it", "this", "that", "these", "those", "this one", "the medicine", "this medication", "this medicine", "this item"];
function referencesSomething(text) {
  const t = normalize(text);
  return REFERENCE_WORDS.some((w) => phraseMatches(t, w));
}

// Returns { product, reply, sourced } or null if this doesn't look like an
// answerable medication question. `fallbackProduct` is the last product
// the conversation was about, used to resolve bare follow-ups like "how
// do I use it?".
function answerMedQuestion(text, fallbackProduct) {
  if (!isQuestionLike(text)) return null;

  let product = findProductForQuestion(text);
  const cat = detectQuestionCategory(text);

  if (!product && fallbackProduct && (cat || referencesSomething(text))) {
    product = fallbackProduct;
  }
  if (!product) return null;

  const es = currentLang === "es";
  const name = product.name;
  let reply, sourced = true;

  if (!cat) {
    // Named/implied a product but didn't match a known category — say so
    // honestly rather than dumping an unrelated summary that looks like
    // it answered the question.
    reply = es
      ? `No tengo ese dato exacto para ${name}, pero esto es lo que sí dice la etiqueta: ${product.uses} ${product.instructions}`
      : `I don't have that exact detail for ${name}, but here's what the label does say: ${product.uses} ${product.instructions}`;
  } else if (cat.key === "warnings") {
    reply = es ? `Esto es lo que advierte la etiqueta de ${name}: ${product.warnings}` : `Here's what ${name}'s label warns about: ${product.warnings}`;
  } else if (cat.key === "dosage") {
    reply = es ? `Así se usa ${name}: ${product.instructions}` : `Here's how to use ${name}: ${product.instructions}`;
  } else if (cat.key === "allergy") {
    reply = es ? `Sobre alergias, la etiqueta de ${name} dice: ${product.allergyAlert}` : `On allergies, ${name}'s label says: ${product.allergyAlert}`;
  } else if (cat.key === "uses") {
    reply = es ? `${name} se usa generalmente así: ${product.uses}` : `${name} is generally used like this: ${product.uses}`;
  } else if (cat.key === "ingredient") {
    const ing = product.activeIngredient || (es ? "sin ingrediente activo listado" : "no listed active ingredient");
    reply = es ? `${name} tiene como ingrediente activo: ${ing}.` : `${name}'s active ingredient is ${ing}.`;
  } else if (cat.key === "interactions") {
    reply = es
      ? `No tengo una base de datos completa de interacciones, pero esto es lo que advierte la etiqueta de ${name}: ${product.warnings} Cuéntele a un farmacéutico sobre otros medicamentos o alcohol antes de combinarlos.`
      : `I don't have a full drug-interaction database, but here's what ${name}'s label warns about: ${product.warnings} Tell a pharmacist about any other medications or alcohol use before combining them.`;
    sourced = false;
  } else if (cat.key === "price") {
    sourced = false;
    const stockNote = product.inStock ? "" : (es ? " Ahora mismo está agotado." : " It's out of stock right now.");
    reply = (es ? `${name} cuesta ${money(product.price)}.` : `${name} is ${money(product.price)}.`) + stockNote;
  } else if (cat.key === "prescription") {
    sourced = false;
    reply = product.ageRestricted
      ? (es ? `No necesita receta para ${name} — se vende sin receta, pero tiene restricción de edad, así que deberá escanear una identificación válida al pagar.` : `No prescription needed for ${name} — it's sold over-the-counter, but it's age-restricted, so you'll need to scan a valid photo ID at checkout.`)
      : (es ? `No — ${name} y todo lo demás en este quiosco está disponible sin receta.` : `Nope — ${name}, like everything else here, is available over-the-counter without a prescription.`);
  } else if (cat.key === "special") {
    sourced = false;
    reply = es
      ? `Buena pregunta — las instrucciones de ${name} son para adultos. Si está embarazada, amamantando, o piensa dárselo a un niño, consulte a un farmacéutico o médico antes de usarlo.`
      : `Good question — ${name}'s directions are written for adults. If you're pregnant, nursing, or thinking of giving it to a child, check with a pharmacist or doctor first — they can confirm the right choice and dose.`;
  } else if (cat.key === "onset") {
    sourced = false;
    reply = es
      ? `La etiqueta de ${name} no dice cuánto tarda en hacer efecto, y varía según la persona. Pregúntele a un farmacéutico si el tiempo es importante para usted.`
      : `${name}'s label doesn't say exactly how fast it kicks in — it varies person to person. Ask a pharmacist if timing matters for you.`;
  }

  return { product, reply, sourced };
}
