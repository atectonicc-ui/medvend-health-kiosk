// Rule-based "AI" triage engine for the kiosk.
//
// This is deliberately keyword-driven rather than calling an external LLM:
// it has to run fully offline on a vending machine with no guaranteed
// network/API key, and triage responses need to be deterministic and
// auditable rather than left to a model's judgement. The interface
// (classify(text) -> {type, ...}) is the seam where a real LLM call could
// be swapped in later without touching the UI code.
//
// Matching is phrase-based but word-order independent: a keyword like
// "head hurts" matches "my head really hurts today" because every word in
// the keyword phrase shows up somewhere in the message, not just an exact
// substring match. Single-word keywords use a word-boundary check so short
// words ("sore", "hot") don't false-match inside unrelated words.

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s']/g, " ");
}

function phraseMatches(normalizedText, phrase) {
  if (normalizedText.includes(phrase)) return true;
  const words = phrase.split(" ").filter(Boolean);
  return words.every((w) => new RegExp(`\\b${w}\\b`).test(normalizedText));
}

function classify(text) {
  const t = normalize(text);

  if (EMERGENCY_KEYWORDS.some((kw) => phraseMatches(t, kw))) {
    return { type: "emergency" };
  }

  if (PRESCRIPTION_KEYWORDS.some((kw) => phraseMatches(t, kw))) {
    return { type: "not_equipped" };
  }

  const scored = PRODUCTS.map((p) => {
    const hits = p.keywords.filter((kw) => phraseMatches(t, kw)).length;
    return { product: p, hits };
  }).filter((s) => s.hits > 0);

  scored.sort((a, b) => b.hits - a.hits);

  if (scored.length === 0) {
    return { type: "unclear" };
  }

  return { type: "products", products: scored.slice(0, 3).map((s) => s.product) };
}

function friendlyIntro(products) {
  if (products.length === 1) {
    return `Here's something that should help: ${products[0].name}.`;
  }
  return `A couple of options that should help: ${products.map((p) => p.name).join(", ")}.`;
}
