// Knowledge base for the AI Assistant (assistant.js). Fully offline.
//
// HEALTH_TOPICS: general, widely published first-aid / self-care guidance.
// The thresholds and steps below were checked against public guidance from
// the American Red Cross, Mayo Clinic, MedlinePlus, the CDC, and the federal
// Poison Help line site. They are deliberately conservative, short, and
// always paired with "get medical help if…" red flags. This is general
// information, never a diagnosis — the assistant says so every time.
//
// KIOSK_FAQ: facts about this machine, taken from what the app actually does.
//
// `triggers` are English phrases matched against the (accent-stripped,
// Spanish→English-normalized) message, so one list serves both languages.

const HEALTH_TOPICS = [
  {
    id: "cut",
    triggers: ["cut", "cuts", "scrape", "scrapes", "scratch", "graze", "paper cut", "small cut", "minor cut", "wound", "bleeding cut"],
    title: { en: "Minor cuts & scrapes", es: "Cortes y raspones leves" },
    steps: {
      en: [
        "Wash your hands, then press gently on the cut with a clean cloth or bandage until bleeding stops.",
        "Rinse the wound with clean running water and wash around it with soap (keep soap out of the wound). Skip hydrogen peroxide and iodine — they can irritate.",
        "Dab on a thin layer of antibiotic ointment, then cover with a bandage or gauze.",
        "Change the dressing daily, or whenever it gets wet or dirty.",
      ],
      es: [
        "Lávese las manos y presione suavemente la cortada con un paño limpio o una venda hasta que deje de sangrar.",
        "Enjuague la herida con agua corriente limpia y lave alrededor con jabón (sin meter jabón en la herida). Evite el agua oxigenada y el yodo — pueden irritar.",
        "Aplique una capa fina de pomada antibiótica y cubra con una venda o gasa.",
        "Cambie el vendaje a diario, o cuando se moje o ensucie.",
      ],
    },
    seek: {
      en: "the cut is deep (more than about ¼ inch), on the face, or you can see bone; bleeding won't stop after firm pressure; you can't get all the dirt out; it later gets red, swollen, or starts oozing pus, or you get a fever; or your last tetanus shot was over 10 years ago (5 years if the wound is deep or dirty).",
      es: "la cortada es profunda (más de aproximadamente ¼ de pulgada), está en la cara, o se ve el hueso; el sangrado no para con presión firme; no puede sacar toda la suciedad; luego se pone roja, hinchada o supura pus, o le da fiebre; o su última vacuna contra el tétanos fue hace más de 10 años (5 años si la herida es profunda o está sucia).",
    },
    products: ["bandaid", "ointment", "gauze"],
  },
  {
    id: "burn",
    triggers: ["burn", "burned", "burnt", "scald", "scalded", "burned myself", "hot water burn", "touched something hot"],
    title: { en: "Minor burns", es: "Quemaduras leves" },
    steps: {
      en: [
        "Cool the burn right away under cool (not ice-cold) running water for about 10–20 minutes.",
        "Take off rings or tight items near the burn before it swells.",
        "Don't use ice, butter, or oils, and don't pop blisters.",
        "Cover loosely with clean, non-stick gauze. A pain reliever can help if it hurts — follow the label.",
      ],
      es: [
        "Enfríe la quemadura de inmediato bajo agua corriente fresca (no helada) durante unos 10–20 minutos.",
        "Quítese anillos u objetos apretados cerca de la quemadura antes de que se hinche.",
        "No use hielo, mantequilla ni aceites, y no reviente las ampollas.",
        "Cubra sin apretar con gasa limpia que no se pegue. Un analgésico puede ayudar si duele — siga la etiqueta.",
      ],
    },
    seek: {
      en: "the burn is bigger than about 3 inches, covers a large area, or is on the face, hands, feet, groin, buttocks, or a major joint; it's from chemicals or electricity; the skin looks white, leathery or charred (call 911); or you see signs of infection later.",
      es: "la quemadura es mayor de unas 3 pulgadas, cubre un área grande, o está en la cara, manos, pies, ingle, glúteos o una articulación grande; fue por químicos o electricidad; la piel se ve blanca, acartonada o carbonizada (llame al 911); o luego hay señales de infección.",
    },
    products: ["gauze", "ointment"],
  },
  {
    id: "sunburn",
    triggers: ["sunburn", "sun burn", "sunburned", "too much sun", "burned in the sun"],
    title: { en: "Sunburn", es: "Quemadura de sol" },
    steps: {
      en: [
        "Get out of the sun. Cool the skin with a cool shower or cool damp cloths.",
        "Drink extra water — sunburn pulls fluid to the skin.",
        "A pain reliever can ease the soreness — follow the label. Don't pop blisters.",
        "Next time: sunscreen 15 minutes before going out, and reapply every 2 hours.",
      ],
      es: [
        "Salga del sol. Enfríe la piel con una ducha fresca o paños húmedos y frescos.",
        "Beba más agua — la quemadura de sol atrae líquido hacia la piel.",
        "Un analgésico puede aliviar el dolor — siga la etiqueta. No reviente las ampollas.",
        "La próxima vez: protector solar 15 minutos antes de salir, y vuelva a aplicarlo cada 2 horas.",
      ],
    },
    seek: {
      en: "you have blisters over a large area, fever or chills, severe pain, dizziness, or signs of dehydration.",
      es: "tiene ampollas en un área grande, fiebre o escalofríos, dolor intenso, mareo o señales de deshidratación.",
    },
    products: ["sunscreen", "electrolyte", "ibuprofen"],
  },
  {
    id: "sprain",
    triggers: ["sprain", "sprained", "twisted ankle", "rolled ankle", "rolled my ankle", "strain", "pulled muscle", "bruise", "bruised", "swelling", "swollen ankle", "swollen", "sports injury"],
    title: { en: "Sprains, strains & bruises", es: "Esguinces, distensiones y moretones" },
    steps: {
      en: [
        "Rest the area and avoid putting weight on it.",
        "Ice it for 15–20 minutes at a time, several times a day for the first 48 hours, with a thin towel between the ice and your skin.",
        "Compress with an elastic wrap (snug, not tight) and keep the area raised above heart level when you can.",
        "A pain reliever can help — follow the label.",
      ],
      es: [
        "Descanse la zona y evite apoyar peso sobre ella.",
        "Aplique hielo durante 15–20 minutos a la vez, varias veces al día durante las primeras 48 horas, con una toalla delgada entre el hielo y la piel.",
        "Comprima con una venda elástica (firme, no apretada) y mantenga la zona elevada por encima del corazón cuando pueda.",
        "Un analgésico puede ayudar — siga la etiqueta.",
      ],
    },
    seek: {
      en: "you can't put weight on it, the joint feels unstable or numb, it looks out of shape, there's no improvement after about a week, or colored streaks spread from the area.",
      es: "no puede apoyar peso, la articulación se siente inestable o adormecida, se ve deformada, no mejora después de una semana, o salen rayas de color desde la zona.",
    },
    products: ["coldpack", "patch", "ibuprofen"],
  },
  {
    id: "nosebleed",
    triggers: ["nosebleed", "nose bleed", "nose bleeding", "bloody nose", "my nose is bleeding"],
    title: { en: "Nosebleed", es: "Sangrado nasal" },
    steps: {
      en: [
        "Sit up and lean forward (not back) so blood doesn't run down your throat.",
        "Pinch the soft part of your nose firmly and breathe through your mouth for 10–15 minutes without letting go to check.",
        "If it's still bleeding, pinch again for another 10–15 minutes.",
      ],
      es: [
        "Siéntese y inclínese hacia adelante (no hacia atrás) para que la sangre no baje por la garganta.",
        "Apriete firmemente la parte blanda de la nariz y respire por la boca durante 10–15 minutos sin soltar para revisar.",
        "Si sigue sangrando, apriete de nuevo otros 10–15 minutos.",
      ],
    },
    seek: {
      en: "it still hasn't stopped after 30 minutes or two tries, it followed an injury, you're losing a lot of blood, or it's hard to breathe.",
      es: "no ha parado después de 30 minutos o dos intentos, ocurrió tras una lesión, pierde mucha sangre, o le cuesta respirar.",
    },
    products: ["gauze"],
  },
  {
    id: "fever",
    triggers: ["fever", "temperature", "feverish", "chills", "running a fever", "high temperature", "burning up"],
    title: { en: "Fever", es: "Fiebre" },
    steps: {
      en: [
        "Rest and drink plenty of fluids; dress lightly.",
        "Acetaminophen or ibuprofen can bring a fever down — follow the label directions, and never combine products with the same active ingredient.",
      ],
      es: [
        "Descanse y beba muchos líquidos; use ropa ligera.",
        "El acetaminofén o el ibuprofeno pueden bajar la fiebre — siga las instrucciones de la etiqueta y nunca combine productos con el mismo ingrediente activo.",
      ],
    },
    seek: {
      en: "an adult's temperature is 103°F (39.4°C) or higher, or the fever lasts more than 3 days; there's trouble breathing, chest pain, a bad headache or stiff neck, confusion, belly pain, repeated vomiting, a rash, or signs of dehydration. For a baby, any fever in an infant under 3 months needs a doctor right away.",
      es: "la temperatura de un adulto es de 103°F (39.4°C) o más, o la fiebre dura más de 3 días; hay dificultad para respirar, dolor de pecho, dolor de cabeza fuerte o rigidez de cuello, confusión, dolor abdominal, vómitos repetidos, sarpullido o señales de deshidratación. En un bebé, cualquier fiebre en menores de 3 meses requiere atención médica de inmediato.",
    },
    products: ["acetaminophen", "ibuprofen", "electrolyte"],
  },
  {
    id: "headache",
    triggers: ["headache", "head ache", "head hurts", "migraine", "head pounding", "my head hurts", "head is pounding"],
    title: { en: "Headache", es: "Dolor de cabeza" },
    steps: {
      en: [
        "Rest in a quiet, dim room and drink some water — dehydration is a common trigger.",
        "A pain reliever can help — follow the label directions.",
      ],
      es: [
        "Descanse en un cuarto tranquilo y con poca luz, y beba agua — la deshidratación es un desencadenante común.",
        "Un analgésico puede ayudar — siga las instrucciones de la etiqueta.",
      ],
    },
    seek: {
      en: "it's sudden and severe (\"the worst headache of your life\") or follows a head injury; or comes with confusion, a stiff neck with fever, weakness, numbness, vision or speech trouble — call 911 for those.",
      es: "es repentino y muy intenso (\"el peor dolor de cabeza de su vida\") o sigue a un golpe en la cabeza; o viene con confusión, rigidez de cuello con fiebre, debilidad, adormecimiento, problemas de visión o del habla — llame al 911 en esos casos.",
    },
    products: ["ibuprofen", "acetaminophen"],
  },
  {
    id: "sorethroat",
    triggers: ["sore throat", "throat hurts", "scratchy throat", "throat pain", "strep", "tonsils"],
    title: { en: "Sore throat", es: "Dolor de garganta" },
    steps: {
      en: [
        "Drink warm liquids (broth, decaf tea, warm water with honey) and rest your voice.",
        "Gargle with salt water: ¼–½ teaspoon of salt in 4–8 ounces of warm water, then spit it out.",
        "Throat lozenges or cough drops can soothe (not for children under 5 — choking hazard). A pain reliever can help — follow the label.",
      ],
      es: [
        "Beba líquidos tibios (caldo, té sin cafeína, agua tibia con miel) y descanse la voz.",
        "Haga gárgaras con agua salada: ¼–½ cucharadita de sal en 4–8 onzas de agua tibia, y luego escúpala.",
        "Las pastillas para la garganta o para la tos pueden aliviar (no para menores de 5 años — riesgo de atragantamiento). Un analgésico puede ayudar — siga la etiqueta.",
      ],
    },
    seek: {
      en: "you have trouble breathing or swallowing or are drooling, the fever is above 101°F, or it lasts more than a week.",
      es: "tiene dificultad para respirar o tragar o babea, la fiebre es de más de 101°F, o dura más de una semana.",
    },
    products: ["coughdrops", "acetaminophen"],
  },
  {
    id: "coldcough",
    triggers: ["cough", "coughing", "cold", "common cold", "flu", "runny nose", "stuffy nose", "congestion", "congested", "sneezing", "sinus"],
    title: { en: "Cold, cough & congestion", es: "Resfriado, tos y congestión" },
    steps: {
      en: [
        "Rest and drink plenty of fluids. Warm drinks and honey can soothe a cough (never give honey to babies under 1).",
        "Cough drops can help a cough; a nasal spray can help congestion but shouldn't be used more than 3 days (the label warns of rebound congestion).",
        "Wash your hands often and cover coughs to avoid spreading it.",
      ],
      es: [
        "Descanse y beba muchos líquidos. Las bebidas tibias y la miel pueden calmar la tos (nunca dé miel a bebés menores de 1 año).",
        "Las pastillas para la tos ayudan con la tos; el spray nasal ayuda con la congestión pero no debe usarse más de 3 días (la etiqueta advierte de congestión de rebote).",
        "Lávese las manos con frecuencia y cúbrase al toser para no contagiar.",
      ],
    },
    seek: {
      en: "you have shortness of breath, wheezing, chest pain, a high fever, or you cough up blood (call 911 for trouble breathing or coughing blood); or symptoms last more than about 10 days or get worse after improving.",
      es: "tiene falta de aire, silbidos al respirar, dolor de pecho, fiebre alta, o tose con sangre (llame al 911 si le cuesta respirar o tose sangre); o los síntomas duran más de unos 10 días o empeoran después de mejorar.",
    },
    products: ["coughdrops", "coldflu", "decongestant", "antihistamine"],
  },
  {
    id: "allergy",
    triggers: ["allergy", "allergies", "allergic", "hay fever", "hives", "itchy eyes", "seasonal allergies", "pollen", "sneezing allergy", "itching"],
    title: { en: "Mild allergies", es: "Alergias leves" },
    steps: {
      en: [
        "Avoid the trigger if you know it (pollen, pets, dust) and rinse off after being outdoors.",
        "An antihistamine can relieve sneezing and itching — follow the label, and note it may cause drowsiness (no driving).",
      ],
      es: [
        "Evite el desencadenante si lo conoce (polen, mascotas, polvo) y lávese después de estar afuera.",
        "Un antihistamínico puede aliviar los estornudos y la picazón — siga la etiqueta y recuerde que puede causar somnolencia (no conduzca).",
      ],
    },
    seek: {
      en: "you have trouble breathing, swelling of the lips, face, eyelids or throat, dizziness or fainting, a weak fast pulse, or vomiting after exposure — that can be anaphylaxis: call 911 right away, even if it's just one or two of these.",
      es: "tiene dificultad para respirar, hinchazón de labios, cara, párpados o garganta, mareo o desmayo, pulso débil y rápido, o vómito tras la exposición — puede ser anafilaxia: llame al 911 de inmediato, aunque sea solo uno o dos de estos síntomas.",
    },
    products: ["antihistamine"],
  },
  {
    id: "stomach",
    triggers: ["upset stomach", "stomach ache", "stomachache", "nausea", "nauseous", "queasy", "vomiting", "throwing up", "indigestion", "heartburn", "acid reflux", "bloated", "gas", "sour stomach", "belly ache", "stomach pain"],
    title: { en: "Upset stomach, nausea & heartburn", es: "Malestar estomacal, náuseas y acidez" },
    steps: {
      en: [
        "Sip small amounts of clear fluids; try bland foods (toast, rice, bananas) and avoid greasy, spicy food and alcohol.",
        "An antacid can ease heartburn or sour stomach — follow the label (the one here says not to exceed 10 tablets in 24 hours).",
      ],
      es: [
        "Tome sorbos pequeños de líquidos claros; pruebe alimentos suaves (pan tostado, arroz, plátano) y evite comida grasosa, picante y el alcohol.",
        "Un antiácido puede aliviar la acidez o el malestar — siga la etiqueta (el de aquí dice no exceder 10 tabletas en 24 horas).",
      ],
    },
    seek: {
      en: "you have severe belly pain, vomit blood or have black or bloody stools, can't keep fluids down, or vomiting lasts more than a day (or you show signs of dehydration).",
      es: "tiene dolor abdominal intenso, vomita sangre o tiene heces negras o con sangre, no retiene líquidos, o el vómito dura más de un día (o hay señales de deshidratación).",
    },
    products: ["antacid", "electrolyte"],
  },
  {
    id: "diarrhea",
    triggers: ["diarrhea", "diarrhoea", "loose stools", "runs", "stomach bug", "food poisoning mild"],
    title: { en: "Diarrhea", es: "Diarrea" },
    steps: {
      en: [
        "The main job is replacing lost fluids: sip water, broth, or an electrolyte drink often.",
        "As you improve, go back to soft, bland foods.",
        "An anti-diarrheal can help adults — follow the label, and don't use it if you have bloody or black stool without asking a doctor.",
      ],
      es: [
        "Lo principal es reponer los líquidos perdidos: tome agua, caldo o una bebida con electrolitos con frecuencia.",
        "Cuando mejore, vuelva a comidas suaves.",
        "Un antidiarreico puede ayudar a los adultos — siga la etiqueta, y no lo use si tiene heces con sangre o negras sin consultar a un médico.",
      ],
    },
    seek: {
      en: "it lasts more than a couple of days (sooner for young children or older adults), you have a fever above 102°F, bloody or black stools, severe belly pain, or signs of dehydration (very dry mouth, little urine, dizziness).",
      es: "dura más de un par de días (antes en niños pequeños o adultos mayores), tiene fiebre de más de 102°F, heces con sangre o negras, dolor abdominal intenso, o señales de deshidratación (boca muy seca, poca orina, mareo).",
    },
    products: ["antidiarrheal", "electrolyte"],
  },
  {
    id: "heat",
    triggers: ["dehydrated", "dehydration", "heat exhaustion", "heatstroke", "heat stroke", "overheated", "too hot", "dizzy in the heat", "sweating a lot", "heat wave", "hot weather", "very thirsty"],
    title: { en: "Dehydration & heat exhaustion", es: "Deshidratación y agotamiento por calor" },
    steps: {
      en: [
        "Get out of the heat into shade or air conditioning, and lie down with your legs slightly raised.",
        "Sip cool water or an electrolyte drink (no alcohol or caffeine), loosen clothing, and cool the skin with damp cloths.",
      ],
      es: [
        "Salga del calor hacia la sombra o el aire acondicionado, y acuéstese con las piernas ligeramente elevadas.",
        "Tome sorbos de agua fresca o una bebida con electrolitos (sin alcohol ni cafeína), afloje la ropa y refresque la piel con paños húmedos.",
      ],
    },
    seek: {
      en: "the person is confused, agitated, faints, has a seizure, can't drink, vomits, or has a body temperature of 104°F or more — that may be heatstroke: call 911. Also seek care if they don't improve.",
      es: "la persona está confundida, agitada, se desmaya, convulsiona, no puede beber, vomita, o tiene temperatura corporal de 104°F o más — puede ser un golpe de calor: llame al 911. También busque atención si no mejora.",
    },
    products: ["electrolyte", "coldpack"],
  },
  {
    id: "sting",
    triggers: ["insect bite", "bug bite", "bee sting", "wasp sting", "sting", "stung", "mosquito bite", "spider bite", "bitten by"],
    title: { en: "Insect bites & stings", es: "Picaduras de insectos" },
    steps: {
      en: [
        "If a stinger is stuck in the skin, scrape it out with a straight edge like a credit card (or pull it with tweezers).",
        "Wash with soap and water, then hold a cold pack wrapped in a thin towel on it. Try not to scratch.",
        "An antihistamine can ease itching — follow the label.",
      ],
      es: [
        "Si el aguijón quedó en la piel, sáquelo raspando con un borde recto como una tarjeta (o con pinzas).",
        "Lave con agua y jabón y coloque una compresa fría envuelta en una toalla delgada. Trate de no rascarse.",
        "Un antihistamínico puede aliviar la picazón — siga la etiqueta.",
      ],
    },
    seek: {
      en: "you have trouble breathing, swelling of the lips, face or throat, dizziness or fainting, a weak fast pulse, or nausea/vomiting — that's a possible severe reaction: call 911.",
      es: "tiene dificultad para respirar, hinchazón de labios, cara o garganta, mareo o desmayo, pulso débil y rápido, o náuseas/vómito — es una posible reacción grave: llame al 911.",
    },
    products: ["coldpack", "antihistamine", "ointment"],
  },
  {
    id: "motion",
    triggers: ["motion sickness", "car sick", "carsick", "seasick", "sea sick", "travel sickness", "airsick", "nauseous in the car"],
    title: { en: "Motion sickness", es: "Mareo por movimiento" },
    steps: {
      en: [
        "Face forward, look at the horizon, and get fresh air if you can. Avoid reading or screens.",
        "Eat light and skip alcohol. Motion sickness tablets work best taken before you travel — follow the label (they can cause drowsiness).",
      ],
      es: [
        "Mire hacia adelante, fije la vista en el horizonte y tome aire fresco si puede. Evite leer o mirar pantallas.",
        "Coma ligero y evite el alcohol. Las tabletas para el mareo funcionan mejor antes de viajar — siga la etiqueta (pueden causar somnolencia).",
      ],
    },
    seek: {
      en: "vomiting won't stop, or you feel dizzy, weak, or dehydrated.",
      es: "el vómito no cesa, o se siente mareado, débil o deshidratado.",
    },
    products: ["motionsickness"],
  },
  {
    id: "cramps",
    triggers: ["period cramps", "menstrual cramps", "cramps", "period pain", "painful period", "time of the month", "pms", "menstrual pain"],
    title: { en: "Period cramps", es: "Cólicos menstruales" },
    steps: {
      en: [
        "Heat helps: a heating patch on the lower belly, or a warm bath.",
        "A pain reliever can ease cramps — follow the label. Light exercise and rest can help too.",
      ],
      es: [
        "El calor ayuda: un parche térmico en el bajo vientre o un baño tibio.",
        "Un analgésico puede aliviar los cólicos — siga la etiqueta. El ejercicio ligero y el descanso también ayudan.",
      ],
    },
    seek: {
      en: "the pain is severe or gets in the way of daily life, comes on suddenly and sharply, or bleeding is very heavy (soaking a pad or tampon every hour for several hours).",
      es: "el dolor es intenso o interfiere con la vida diaria, aparece de repente y agudo, o el sangrado es muy abundante (empapa una toalla o tampón cada hora durante varias horas).",
    },
    products: ["heatpatch", "periodrelief", "ibuprofen", "pads"],
  },
  {
    id: "musclepain",
    triggers: ["back pain", "backache", "muscle ache", "muscle pain", "sore muscles", "body aches", "joint pain", "neck pain", "stiff neck sore", "arthritis"],
    title: { en: "Back & muscle aches", es: "Dolor de espalda y músculos" },
    steps: {
      en: [
        "Keep gently moving — long bed rest usually makes back pain worse.",
        "Ice for the first day or two, then heat, can ease soreness; a menthol patch or a pain reliever can help — follow each label.",
      ],
      es: [
        "Manténgase en movimiento suave — el reposo prolongado en cama suele empeorar el dolor de espalda.",
        "El hielo el primer día o dos, y luego calor, puede aliviar; un parche de mentol o un analgésico pueden ayudar — siga cada etiqueta.",
      ],
    },
    seek: {
      en: "you have numbness or weakness in a leg, trouble controlling your bladder or bowels, fever, or the pain followed a fall or injury or isn't improving after a couple of weeks.",
      es: "tiene adormecimiento o debilidad en una pierna, dificultad para controlar la vejiga o el intestino, fiebre, o el dolor siguió a una caída o lesión o no mejora después de un par de semanas.",
    },
    products: ["patch", "ibuprofen", "acetaminophen", "coldpack"],
  },
  {
    id: "toothache",
    triggers: ["toothache", "tooth ache", "tooth pain", "sore tooth", "dental pain", "wisdom tooth"],
    title: { en: "Toothache", es: "Dolor de muelas" },
    steps: {
      en: [
        "Rinse with warm water and a pain reliever can ease it for now — follow the label.",
        "It's temporary relief only: book a dentist visit.",
      ],
      es: [
        "Enjuague con agua tibia; un analgésico puede aliviarlo por ahora — siga la etiqueta.",
        "Es solo un alivio temporal: programe una visita al dentista.",
      ],
    },
    seek: {
      en: "your face or jaw is swollen, you have a fever, or it hurts to swallow or breathe — get care right away.",
      es: "tiene la cara o la mandíbula hinchada, fiebre, o le duele al tragar o respirar — busque atención de inmediato.",
    },
    products: ["ibuprofen", "acetaminophen"],
  },
  {
    id: "hygiene",
    triggers: ["wash hands", "hand washing", "handwashing", "germs", "sanitizer work", "stop the spread", "prevent illness", "avoid getting sick"],
    title: { en: "Hand hygiene", es: "Higiene de manos" },
    steps: {
      en: [
        "Wash with soap and water for about 20 seconds — it's the best option when hands look dirty.",
        "When there's no soap, use a hand sanitizer with at least 60% alcohol and rub until dry (the one here is 65% ethyl alcohol).",
      ],
      es: [
        "Lave con agua y jabón durante unos 20 segundos — es la mejor opción cuando las manos se ven sucias.",
        "Si no hay jabón, use un desinfectante de manos con al menos 60% de alcohol y frote hasta que seque (el de aquí es de 65% de alcohol etílico).",
      ],
    },
    seek: { en: "", es: "" },
    products: ["sanitizer"],
  },
  {
    id: "safety",
    triggers: ["take medicine safely", "medication safety", "how to take medicine", "medicine safety", "safe use", "expired medicine", "store medicine", "storing medicine", "keep away from children", "double dose", "missed a dose", "take more than", "how long can i take"],
    title: { en: "Using medicine safely", es: "Uso seguro de medicamentos" },
    steps: {
      en: [
        "Read the whole label before every use, and never take more than it says.",
        "Don't combine products that share an active ingredient (for example two with acetaminophen).",
        "Ask a pharmacist first if you take other medicines, drink alcohol, are pregnant or nursing, or the person is a child.",
        "Store medicines in a cool, dry place out of children's reach, and don't use them past the expiration date.",
      ],
      es: [
        "Lea toda la etiqueta antes de cada uso y nunca tome más de lo que indica.",
        "No combine productos con el mismo ingrediente activo (por ejemplo, dos con acetaminofén).",
        "Consulte primero a un farmacéutico si toma otros medicamentos, bebe alcohol, está embarazada o amamantando, o si es para un niño.",
        "Guarde los medicamentos en un lugar fresco y seco, fuera del alcance de los niños, y no los use después de la fecha de vencimiento.",
      ],
    },
    seek: { en: "", es: "" },
    products: [],
  },
  {
    id: "poison",
    triggers: ["poison control", "poison hotline", "poison help", "poison center", "swallowed something", "took too much", "took too many", "ate something toxic", "accidentally swallowed"],
    title: { en: "Poison Help", es: "Ayuda por envenenamiento" },
    steps: {
      en: [
        "In the U.S., call Poison Help at 1-800-222-1222 — free, confidential, 24/7. You'll reach a nurse, pharmacist or doctor.",
        "If the person collapsed, has a seizure, or isn't breathing, call 911 instead.",
      ],
      es: [
        "En EE. UU., llame a Poison Help al 1-800-222-1222 — gratis, confidencial, 24/7. Le atenderá una enfermera, farmacéutico o médico.",
        "Si la persona se desplomó, convulsiona o no respira, llame al 911.",
      ],
    },
    seek: { en: "", es: "" },
    products: [],
  },
  {
    id: "whentogo",
    triggers: ["when should i see a doctor", "when to see a doctor", "should i go to the er", "er or urgent care", "urgent care or er", "do i need a doctor", "should i see a doctor", "when to go to the hospital", "what counts as an emergency"],
    title: { en: "Doctor, urgent care, or ER?", es: "¿Médico, atención urgente o sala de emergencias?" },
    steps: {
      en: [
        "Call 911 / go to the ER for: chest pain, trouble breathing, signs of stroke (face drooping, arm weakness, slurred speech), severe bleeding, fainting or confusion, a severe allergic reaction, or poisoning/overdose.",
        "Urgent care fits things that can't wait for your doctor but aren't life-threatening: minor cuts needing stitches, sprains, mild fever or infections.",
        "A regular doctor or pharmacist is best for ongoing symptoms and medicine questions.",
      ],
      es: [
        "Llame al 911 / vaya a la sala de emergencias por: dolor de pecho, dificultad para respirar, señales de derrame cerebral (cara caída, debilidad en un brazo, habla arrastrada), sangrado intenso, desmayo o confusión, reacción alérgica grave, o envenenamiento/sobredosis.",
        "La atención urgente sirve para lo que no puede esperar a su médico pero no pone la vida en riesgo: cortadas que necesitan puntos, esguinces, fiebre leve o infecciones.",
        "Un médico de cabecera o farmacéutico es lo mejor para síntomas continuos y dudas sobre medicamentos.",
      ],
    },
    seek: { en: "", es: "" },
    products: [],
    showCare: true,
  },
];

// ---- Kiosk FAQ: facts about this machine ----
// Answers may use {tax} (tax percent) — filled in by assistant.js.
const KIOSK_FAQ = [
  {
    id: "hours",
    triggers: ["hours", "open", "opening hours", "what time do you open", "are you open", "24 hours", "closing time", "open now", "when are you open"],
    answer: {
      en: "This kiosk is open 24 hours a day, 7 days a week, and it's restocked and inspected daily.",
      es: "Este quiosco está abierto las 24 horas del día, los 7 días de la semana, y se reabastece e inspecciona a diario.",
    },
  },
  {
    id: "payment",
    triggers: ["payment", "pay with", "accept", "do you accept", "accept cash", "take cash", "pay with cash", "accepted", "credit card", "debit card", "apple pay", "google pay", "fsa", "hsa", "cash", "payment methods", "how do i pay", "can i pay", "tap to pay", "venmo", "insurance"],
    answer: {
      en: "You can pay by tapping Apple/Google Pay, with a chip (EMV) card, or with an FSA/HSA card. This kiosk doesn't take cash, and insurance isn't billed. (In this demo, payment is simulated — no real charge is made.)",
      es: "Puede pagar con Apple/Google Pay, con tarjeta de chip (EMV) o con tarjeta FSA/HSA. Este quiosco no acepta efectivo ni factura al seguro. (En esta demostración el pago es simulado — no se hace ningún cargo real.)",
    },
  },
  {
    id: "tax",
    triggers: ["tax", "sales tax", "how much tax", "total with tax", "plus tax"],
    answer: {
      en: "An estimated {tax}% sales tax is added at checkout, and you'll see the subtotal, tax and total before you pay.",
      es: "Se agrega un impuesto de venta estimado del {tax}% al pagar, y verá el subtotal, el impuesto y el total antes de pagar.",
    },
  },
  {
    id: "refund",
    triggers: ["refund", "return", "exchange", "money back", "send it back", "return policy", "wrong item", "cancel my order", "cancel order"],
    answer: {
      en: "All sales are final — for safety, dispensed medication can't be returned, exchanged, or refunded. If the machine fails to dispense (a jam or sensor timeout), the transaction is reversed automatically and you're not charged. You can cancel any time before you pay by removing items from your cart.",
      es: "Todas las ventas son finales — por seguridad, los medicamentos dispensados no se pueden devolver, cambiar ni reembolsar. Si la máquina no dispensa (atasco o fallo del sensor), la transacción se revierte automáticamente y no se le cobra. Puede cancelar en cualquier momento antes de pagar quitando artículos del carrito.",
    },
  },
  {
    id: "jam",
    triggers: ["stuck", "jammed", "didn't come out", "did not come out", "won't dispense", "machine broke", "machine is broken", "not working", "dispenser", "item didn't drop", "nothing came out", "kiosk broken"],
    answer: {
      en: "Sorry about that! If the machine can't dispense your order, it reverses the transaction automatically — \"Transaction Reversed — No Charge\" — and you can try again. If something's still wrong, please contact the kiosk operator.",
      es: "¡Lo lamento! Si la máquina no puede dispensar su pedido, revierte la transacción automáticamente — \"Transacción Revertida — Sin Cargo\" — y puede intentarlo de nuevo. Si algo sigue mal, comuníquese con el operador del quiosco.",
    },
  },
  {
    id: "id",
    triggers: ["id required", "need id", "need an id", "photo id", "age restriction", "age restricted", "how old", "minimum age", "under 18", "underage", "age verification", "scan id", "id check", "do i need id"],
    answer: {
      en: "Some items are age-restricted (for example the Daytime Cold & Flu Caplets, because of the cough suppressant). If your order has one, you'll be asked to scan a valid government-issued photo ID at checkout. (ID scanning is simulated in this demo.)",
      es: "Algunos artículos tienen restricción de edad (por ejemplo, las cápsulas Cold & Flu de día, por el supresor de la tos). Si su pedido incluye uno, se le pedirá escanear una identificación con foto válida al pagar. (El escaneo de ID es simulado en esta demostración.)",
    },
  },
  {
    id: "howto",
    triggers: ["how does this work", "how do i use this kiosk", "use this kiosk", "use the kiosk", "how do i use the machine", "how do i use this machine", "how do i order", "how to order", "how do i buy", "how to buy", "how does it work", "how do i get started", "instructions for kiosk", "how do i use the kiosk", "walk me through"],
    answer: {
      en: "It's easy: 1) Browse by category or search a symptom, or just tell me what's wrong. 2) Tap Add on what you need. 3) Tap Review & Pay, read the order and terms, and pay. 4) Take your items from the bin and scan the QR code for your drug facts. Some medicines ask you to confirm you understand their warnings first.",
      es: "Es fácil: 1) Explore por categoría o busque un síntoma, o simplemente dígame qué le pasa. 2) Toque Agregar en lo que necesite. 3) Toque Revisar y Pagar, lea el pedido y los términos, y pague. 4) Retire sus artículos de la bandeja y escanee el código QR para ver la información de sus medicamentos. Algunos medicamentos piden confirmar primero que entiende sus advertencias.",
    },
  },
  {
    id: "qr",
    triggers: ["qr code", "qr", "scan the code", "scan code", "receipt", "drug facts page", "what is the qr", "the code at the end"],
    answer: {
      en: "After you pay, the screen shows a QR code. Point your phone's camera at it to open a page with the drug facts, directions and safety warnings for exactly what you bought — plus emergency numbers. In Disaster Relief Mode the QR holds the guidance as plain text, so it works with no cell data.",
      es: "Después de pagar, la pantalla muestra un código QR. Apunte la cámara de su teléfono para abrir una página con la información, instrucciones y advertencias de seguridad de lo que compró — más números de emergencia. En el Modo de Emergencia por Desastre el QR contiene la guía como texto, así que funciona sin datos móviles.",
    },
  },
  {
    id: "privacy",
    triggers: ["privacy", "private", "do you store", "save my data", "personal information", "data collected", "are you recording", "tracking", "safe to use", "is my data safe", "who sees this"],
    answer: {
      en: "Your cart and this chat are cleared automatically after each customer, and I don't send anything over the internet — I run entirely on this kiosk. In this demo, ID scanning and payment are simulated, so no real personal or payment information is collected.",
      es: "Su carrito y este chat se borran automáticamente después de cada cliente, y no envío nada por internet — funciono completamente en este quiosco. En esta demostración, el escaneo de ID y el pago son simulados, así que no se recopila información personal ni de pago real.",
    },
  },
  {
    id: "offline",
    triggers: ["are you ai", "how do you work", "how are you built", "are you chatgpt", "are you a real ai", "do you use the internet", "are you online", "internet", "wifi", "how smart are you", "what are you powered by", "language model", "llm"],
    answer: {
      en: "I'm a rule-based assistant that runs right here on the kiosk — no internet and no live AI model. I answer only from this kiosk's own product labels (which mirror each item's OTC Drug Facts) and general first-aid guidance, so my answers are consistent and auditable. I'm not a doctor, and I can't diagnose.",
      es: "Soy un asistente basado en reglas que funciona aquí mismo en el quiosco — sin internet ni un modelo de IA en vivo. Respondo solo con las etiquetas de los productos de este quiosco (que reflejan la información de medicamentos OTC de cada artículo) y guías generales de primeros auxilios, así que mis respuestas son consistentes y verificables. No soy médico y no puedo diagnosticar.",
    },
  },
  {
    id: "maker",
    triggers: ["who made you", "who built you", "who made this", "who created", "who built this", "who designed", "creator", "developer", "hosa", "who is chetan", "made by"],
    answer: {
      en: "This kiosk was built by Chetan Nallapaneni for NC HOSA Medical Innovations, as a student-built demo of a 24/7 over-the-counter medical vending kiosk. It isn't a certified medical device or a licensed pharmacy system.",
      es: "Este quiosco fue creado por Chetan Nallapaneni para NC HOSA Medical Innovations, como una demostración hecha por estudiantes de un quiosco médico de venta libre 24/7. No es un dispositivo médico certificado ni un sistema de farmacia con licencia.",
    },
  },
  {
    id: "location",
    triggers: ["where am i", "where is this kiosk", "kiosk location", "what is the address", "which library", "what city", "where is this"],
    answer: {
      en: "This kiosk is at the Library & Active Living Center at Afton Ridge, Concord, NC. For real, nearby options (ERs, urgent care, pharmacies) tap \"Nearby Care & Pharmacy\".",
      es: "Este quiosco está en el Library & Active Living Center en Afton Ridge, Concord, NC. Para opciones reales cercanas (salas de emergencia, atención urgente, farmacias) toque \"Atención Cercana y Farmacia\".",
    },
  },
  {
    id: "prescription",
    triggers: ["prescription", "antibiotics", "do you sell prescription", "controlled", "refill", "need a script", "rx"],
    answer: {
      en: "Everything here is over-the-counter — no prescription needed, and this kiosk can't dispense prescription medicines (like antibiotic pills, insulin, or controlled substances). For those, a pharmacy or doctor is the right place — I can show you the nearest ones.",
      es: "Todo aquí es de venta libre — no se necesita receta, y este quiosco no puede dispensar medicamentos con receta (como antibióticos en pastillas, insulina o sustancias controladas). Para eso, una farmacia o un médico es el lugar correcto — puedo mostrarle los más cercanos.",
    },
    showCare: true,
  },
  {
    id: "accessibility",
    triggers: ["accessibility", "larger text", "bigger text", "text size", "can't read", "cant read", "hard to see", "high contrast", "dark mode", "font size", "colorblind", "color blind", "screen reader", "make it bigger"],
    answer: {
      en: "Tap the ♿ accessibility button at the top right to turn on Larger Text, High Contrast (strong black-and-white borders), or Dark Mode. You can also use the microphone button to speak instead of type.",
      es: "Toque el botón de accesibilidad ♿ arriba a la derecha para activar Texto Más Grande, Alto Contraste (bordes fuertes en blanco y negro) o Modo Oscuro. También puede usar el botón del micrófono para hablar en lugar de escribir.",
    },
  },
  {
    id: "languages",
    triggers: ["languages", "what languages", "other languages", "translate", "translation", "do you speak"],
    answer: {
      en: "I speak English and Spanish — tap the globe button at the top to switch the whole kiosk, or just write to me in Spanish and I'll answer in Spanish. (Drug-label warnings stay in English so their wording is exact.)",
      es: "Hablo inglés y español — toque el botón del globo arriba para cambiar todo el quiosco, o simplemente escríbame en español y le responderé en español. (Las advertencias de las etiquetas se mantienen en inglés para que su redacción sea exacta.)",
    },
  },
  {
    id: "disaster",
    triggers: ["disaster mode", "disaster relief", "relief mode", "emergency mode", "hurricane", "power outage", "blackout", "natural disaster", "what is disaster"],
    answer: {
      en: "Disaster Relief Mode is a special off-grid triage mode for emergencies like storms or outages: it sorts supplies by need (hydration, wounds, burns, fever), dispenses limited essentials free under a per-person ration with a 30-second cooldown, and still sells everything else at normal price. It's switched on from the operator's Judges panel.",
      es: "El Modo de Emergencia por Desastre es un modo especial de triaje sin conexión para emergencias como tormentas o apagones: organiza los suministros por necesidad (hidratación, heridas, quemaduras, fiebre), entrega gratis lo esencial con una ración limitada por persona y 30 segundos de espera, y vende todo lo demás a precio normal. Se activa desde el panel Judges del operador.",
    },
  },
  {
    id: "restock",
    triggers: ["restock", "when will you have", "back in stock", "sold out", "coming soon", "out of stock why", "will you get more"],
    answer: {
      en: "The kiosk is restocked and inspected daily. If something's marked Out of Stock, I can suggest a safe alternative that's available right now — just tell me what you were looking for.",
      es: "El quiosco se reabastece e inspecciona a diario. Si algo está Agotado, puedo sugerirle una alternativa segura disponible ahora — dígame qué buscaba.",
    },
  },
  {
    id: "temperature",
    triggers: ["temp locked", "temperature lock", "why is it locked", "locked for safety", "thermal", "too hot inside", "heatwave lock"],
    answer: {
      en: "If the cabinet gets too warm (over about 77°F), heat-sensitive items like ointments, sprays, sanitizer, sunscreen and cold packs are locked so they aren't sold degraded. They unlock as soon as the cabinet cools down.",
      es: "Si el gabinete se calienta demasiado (más de unos 77°F), los artículos sensibles al calor como pomadas, sprays, desinfectante, protector solar y compresas frías se bloquean para no venderse degradados. Se desbloquean en cuanto el gabinete se enfría.",
    },
  },
];
