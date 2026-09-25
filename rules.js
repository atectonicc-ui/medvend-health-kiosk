// Drug-interaction rules shared by the kiosk checkout and the phone-side
// facts page (facts.html). Pure functions of a product list + language, so
// the same warnings appear at the kiosk and on the customer's phone.
//
// Every rule is grounded in text already on the products' own labels
// (active ingredients / warnings in products.js) rather than a hardcoded
// product-pair list, so it also catches unnamed future items.

function findInteractions(products, lang) {
  const es = lang === "es";
  const has = (p, s) => p.activeIngredient && p.activeIngredient.includes(s);
  const out = [];

  const nsaid = products.filter((p) => has(p, "NSAID"));
  if (nsaid.length >= 2) {
    out.push({
      names: nsaid.map((p) => p.name),
      title: es ? "Riesgo de Sangrado Estomacal" : "Stomach Bleeding Risk",
      detail: es
        ? "Combinar varios AINE (como ibuprofeno y aspirina) aumenta el riesgo de sangrado estomacal."
        : "Combining multiple NSAIDs (like ibuprofen and aspirin) increases the risk of stomach bleeding.",
    });
  }

  const acet = products.filter((p) => has(p, "Acetaminophen"));
  if (acet.length >= 2) {
    out.push({
      names: acet.map((p) => p.name),
      title: es ? "Riesgo de Daño Hepático" : "Liver Damage Risk",
      detail: es
        ? "Estos artículos contienen acetaminofén — tomarlos juntos puede exceder el límite diario seguro y causar daño hepático."
        : "These items both contain acetaminophen — taking them together can exceed the safe daily limit and cause liver damage.",
    });
  }

  // Each label says "may cause drowsiness"; stacking them compounds it.
  const drowsy = products.filter((p) => /drowsiness/i.test(p.warnings || ""));
  if (drowsy.length >= 2) {
    out.push({
      names: drowsy.map((p) => p.name),
      title: es ? "Somnolencia Aumentada" : "Extra Drowsiness Risk",
      detail: es
        ? "Las etiquetas de estos artículos advierten de somnolencia — tomarlos juntos puede aumentarla. No conduzca ni opere maquinaria."
        : "These items' labels each warn of drowsiness — taking them together can add up. Do not drive or operate machinery.",
    });
  }

  // The menthol patch label says "do not use with a heating pad".
  const menthol = products.find((p) => p.id === "patch");
  const heat = products.find((p) => p.id === "heatpatch");
  if (menthol && heat) {
    out.push({
      names: [menthol.name, heat.name],
      title: es ? "Parche de Mentol + Calor" : "Menthol + Heat Patch",
      detail: es
        ? "La etiqueta del parche de mentol dice no usarlo con una almohadilla térmica. No combine estos dos parches en la misma zona."
        : "The menthol patch's label says not to use it with a heating pad. Don't combine these two patches on the same area.",
    });
  }
  return out;
}
