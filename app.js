let offers = [];
let sourceStatus = [];
let offersLoading = true;
let fetchError = "";
let intakeComplete = true;
let selectedOfferId = "";
let checkoutIntent = null;
let latestToolResult = null;
let widgetStateVersion = 0;
const openDetails = new Set();
const skippedSteps = new Set();
const widgetStateSubscribers = new Set();

const occasionOptions = [
  ["birthday", "Birthday"],
  ["anniversary", "Anniversary"],
  ["sympathy", "Sympathy"],
  ["just-because", "Just because"],
  ["thank-you", "Thank you"],
  ["get-well", "Get well"]
];

const relationshipOptions = [
  ["partner", "Partner"],
  ["parent", "Parent"],
  ["friend", "Friend"],
  ["colleague", "Colleague"],
  ["sibling", "Sibling"],
  ["self", "Self"]
];

const genderOptions = [
  ["woman", "Woman"],
  ["man", "Man"],
  ["non-binary", "Non-binary"],
  ["prefer-not", "Prefer not to say"]
];

const ageOptions = [
  ["under-18", "Under 18"],
  ["18-30", "18-30"],
  ["30-50", "30-50"],
  ["50-70", "50-70"],
  ["70-plus", "70+"]
];

const aestheticOptions = [
  {
    id: "wild",
    label: "Wild & garden-y",
    image: "./assets/products/spring-mix.png"
  },
  {
    id: "elegant",
    label: "Elegant & structured",
    image: "./assets/products/premium-roses.png"
  },
  {
    id: "bold",
    label: "Bold & colorful",
    image: "./assets/products/local-tulips.png"
  },
  {
    id: "soft",
    label: "Soft & romantic",
    image: "./assets/products/soft-romantic.png"
  },
  {
    id: "minimal",
    label: "Minimalist single stem",
    image: "./assets/products/minimalist-stem.png"
  }
];

const colourOptions = [
  ["white", "Whites", "#f7f4ee"],
  ["pink", "Pinks", "#ff9abc"],
  ["red", "Reds", "#dd2531"],
  ["yellow", "Yellows", "#ffdc4d"],
  ["purple", "Purples", "#8c63c7"],
  ["orange", "Oranges", "#ff7a1a"],
  ["green", "Greens", "#5aac67"]
];

const paletteOptions = [
  ["mixed", "Mixed", ["#ffe46c", "#ff9abc", "#8c63c7"]],
  ["mono", "Monochrome", ["#ffd7e2", "#ffabc3", "#f692b5"]]
];

const meanings = {
  birthday: 'Sunflowers say "you are my sunshine" - bold, generous, impossible to ignore.',
  anniversary: "Red roses speak love and admiration, the classic for a reason.",
  sympathy: "White flowers feel calm and respectful without making the gesture loud.",
  "just-because": "Garden-style flowers feel spontaneous, like a small I thought of you.",
  "thank-you": "Pinks and soft mixed bouquets read as gratitude, warm but not too formal.",
  "get-well": "Bright yellows and oranges bring energy and optimism into the room."
};

const colourNames = {
  white: "Whites",
  pink: "Pinks",
  red: "Reds",
  yellow: "Yellows",
  purple: "Purples",
  orange: "Oranges",
  green: "Greens",
  mixed: "Mixed",
  colorful: "Mixed"
};

const imageFallbacks = [
  "./assets/products/soft-romantic.png",
  "./assets/products/spring-mix.png",
  "./assets/products/premium-roses.png",
  "./assets/products/white-orchid.png",
  "./assets/products/local-tulips.png",
  "./assets/products/minimalist-stem.png"
];

const userContext = {
  rawIntent: "Hi",
  locale: detectUserLocale()
};

const nodes = {
  intentForm: document.querySelector("#intentForm"),
  intentInput: document.querySelector("#intentInput"),
  intentSummary: document.querySelector("#intentSummary"),
  refinementFlow: document.querySelector("#refinementFlow"),
  refinePrefill: document.querySelector("#refinePrefill"),
  stickyRefine: document.querySelector("#stickyRefine"),
  summaryBar: document.querySelector("#summaryBar"),
  offersGrid: document.querySelector("#offersGrid"),
  resultTitle: document.querySelector("#resultTitle"),
  resultSubtitle: document.querySelector("#resultSubtitle"),
  occasionChoices: document.querySelector("#occasionChoices"),
  relationshipChoices: document.querySelector("#relationshipChoices"),
  genderChoices: document.querySelector("#genderChoices"),
  ageChoices: document.querySelector("#ageChoices"),
  aestheticChoices: document.querySelector("#aestheticChoices"),
  loveColourChoices: document.querySelector("#loveColourChoices"),
  avoidColourChoices: document.querySelector("#avoidColourChoices"),
  paletteChoices: document.querySelector("#paletteChoices"),
  occasionSaved: document.querySelector("#occasionSaved"),
  recipientSaved: document.querySelector("#recipientSaved"),
  aestheticSaved: document.querySelector("#aestheticSaved"),
  colourSaved: document.querySelector("#colourSaved"),
  occasionStep: document.querySelector("#occasionStep"),
  recipientStep: document.querySelector("#recipientStep"),
  aestheticStep: document.querySelector("#aestheticStep"),
  colourStep: document.querySelector("#colourStep"),
  occasionNote: document.querySelector("#occasionNote"),
  showBouquets: document.querySelector("#showBouquets"),
  widgetState: document.querySelector("#flowera-widget-state")
};

function detectUserLocale() {
  const options = Intl.DateTimeFormat().resolvedOptions();
  return {
    locale: "en-US",
    timeZone: options.timeZone || "Europe/Berlin",
    city: ""
  };
}

const refinement = {
  occasion: "anniversary",
  occasionNote: "",
  relationship: "",
  gender: "",
  age: "",
  aesthetic: "",
  loveColours: new Set(["red", "pink"]),
  avoidColours: new Set(),
  palette: "mixed"
};

const criteria = {
  flowerType: "Rosen",
  address: "Prenzlauer Allee 42, 10405 Berlin",
  budgetMin: 25,
  budgetMax: 55,
  deliveryDate: "Tomorrow",
  recipients: "Gift delivery"
};

function euro(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

function euroExact(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

function total(offer) {
  return Number(offer.price || 0) + Number(offer.delivery || 0);
}

function renderAll() {
  renderVisibility();
  renderIntentSummary();
  renderRefinement();
  renderOffers();
  renderSummary();
  publishWidgetState("render");
}

function renderVisibility() {
  nodes.summaryBar.hidden = !intakeComplete;
  nodes.offersGrid.hidden = !intakeComplete;
  nodes.stickyRefine.hidden = !intakeComplete;
}

function renderIntentSummary() {
  if (!userContext.rawIntent) {
    nodes.intentSummary.hidden = true;
    nodes.intentSummary.innerHTML = "";
    return;
  }

  const chips = selectionChips().filter(([, value]) => value);

  nodes.intentSummary.hidden = false;
  nodes.intentSummary.innerHTML = chips
    .map(([label, value]) => `<span>${escapeHTML(label)}<strong>${escapeHTML(value)}</strong></span>`)
    .join("");
}

function renderRefinement() {
  renderChoiceGroup(nodes.occasionChoices, occasionOptions, refinement.occasion, "occasion");
  renderChoiceGroup(nodes.relationshipChoices, relationshipOptions, refinement.relationship, "relationship");
  renderChoiceGroup(nodes.genderChoices, genderOptions, refinement.gender, "gender");
  renderChoiceGroup(nodes.ageChoices, ageOptions, refinement.age, "age");
  renderAesthetics();
  renderColourChoices(nodes.loveColourChoices, refinement.loveColours, "love-colour");
  renderColourChoices(nodes.avoidColourChoices, refinement.avoidColours, "avoid-colour");
  renderPalettes();
  renderRefinePrefill();

  const occasionReady = Boolean(refinement.occasion || skippedSteps.has("occasion"));
  const recipientReady = Boolean(recipientSelectionCount() >= 2 || skippedSteps.has("recipient"));
  const aestheticReady = Boolean(refinement.aesthetic || skippedSteps.has("aesthetic"));

  renderSavedState(nodes.occasionSaved, Boolean(refinement.occasion), skippedSteps.has("occasion"));
  renderSavedState(nodes.recipientSaved, recipientSelectionCount() >= 2, skippedSteps.has("recipient"));
  renderSavedState(nodes.aestheticSaved, Boolean(refinement.aesthetic), skippedSteps.has("aesthetic"));
  renderSavedState(nodes.colourSaved, Boolean(refinement.loveColours.size || refinement.avoidColours.size || refinement.palette), skippedSteps.has("colour"));

  nodes.recipientStep.classList.add("is-visible");
  nodes.aestheticStep.classList.toggle("is-visible", Boolean(occasionReady && recipientReady));
  nodes.colourStep.classList.toggle(
    "is-visible",
    Boolean(occasionReady && recipientReady && (aestheticReady || refinement.loveColours.size || refinement.avoidColours.size))
  );
}

function renderSavedState(node, saved, skipped) {
  node.hidden = !saved && !skipped;
  node.textContent = skipped && !saved ? "skipped" : "saved";
}

function renderRefinePrefill() {
  const chips = selectionChips().filter(([, value]) => value);
  if (!userContext.rawIntent || !chips.length) {
    nodes.refinePrefill.hidden = true;
    nodes.refinePrefill.innerHTML = "";
    return;
  }

  nodes.refinePrefill.hidden = false;
  nodes.refinePrefill.innerHTML = `
    <strong>Pre-selected from your request</strong>
    <div>
      ${chips.map(([label, value]) => `<span>${escapeHTML(label)}<b>${escapeHTML(value)}</b></span>`).join("")}
    </div>
  `;
}

function renderChoiceGroup(target, options, selectedValue, attribute) {
  target.innerHTML = options
    .map(
      ([value, label]) =>
        `<button class="choice-pill ${selectedValue === value ? "is-selected" : ""}" type="button" data-${attribute}="${value}">${label}</button>`
    )
    .join("");
}

function renderAesthetics() {
  nodes.aestheticChoices.innerHTML = aestheticOptions
    .map(
      (item) => `
        <button class="aesthetic-tile ${refinement.aesthetic === item.id ? "is-selected" : ""}" type="button" data-aesthetic="${item.id}">
          <img src="${item.image}" alt="${item.label}" />
          <span>${item.label}</span>
        </button>
      `
    )
    .join("");
}

function renderColourChoices(target, selectedSet, attribute) {
  target.innerHTML = colourOptions
    .map(
      ([value, label, hex]) => `
        <button class="swatch-button ${selectedSet.has(value) ? "is-selected" : ""}" type="button" data-${attribute}="${value}">
          <span class="swatch" style="--swatch: ${hex}"></span>
          ${label}
        </button>
      `
    )
    .join("");
}

function renderPalettes() {
  nodes.paletteChoices.innerHTML = paletteOptions
    .map(
      ([value, label, dots]) => `
        <button class="palette-pill ${refinement.palette === value ? "is-selected" : ""}" type="button" data-palette="${value}">
          <span class="palette-dots">${dots.map((dot) => `<i style="--dot:${dot}"></i>`).join("")}</span>
          ${label}
        </button>
      `
    )
    .join("");
}

function renderSummary() {
  if (!intakeComplete) return;

  if (offersLoading) {
    nodes.resultTitle.textContent = "Live bouquet matches";
    nodes.resultSubtitle.textContent = "Fetching live merchant pages...";
    return;
  }

  if (fetchError) {
    nodes.resultTitle.textContent = "Merchant fetch paused";
    nodes.resultSubtitle.textContent = fetchError;
    return;
  }

  const active = [
    labelFor(occasionOptions, refinement.occasion),
    labelFor(relationshipOptions, refinement.relationship),
    labelFor(aestheticOptions.map((item) => [item.id, item.label]), refinement.aesthetic),
    [...refinement.loveColours].map((colour) => colourNames[colour]).join(", "),
    localeSummary()
  ].filter(Boolean);

  nodes.resultTitle.textContent = active.length ? "Refined bouquet matches" : "Live bouquet matches";
  const visibleCount = Math.min(6, offers.length);
  nodes.resultSubtitle.textContent = `Showing ${visibleCount} of ${offers.length} live offers${active.length ? ` - ${active.join(" / ")}` : ""}`;
}

function renderOffers() {
  if (!intakeComplete) {
    nodes.offersGrid.innerHTML = "";
    return;
  }

  if (offersLoading) {
    nodes.offersGrid.innerHTML = `<div class="status-card"><strong>Fetching live merchant pages</strong>Checking REWE, Blume2000, 24blooms, Fleurop, and Amazon.</div>`;
    return;
  }

  if (fetchError) {
    nodes.offersGrid.innerHTML = `<div class="status-card"><strong>Could not fetch live offers</strong>${escapeHTML(fetchError)}</div>`;
    return;
  }

  const ranked = rankedOffers();
  if (!ranked.length) {
    nodes.offersGrid.innerHTML = sourceStatus
      .map(
        (source) => `
          <div class="status-card">
            <strong>${escapeHTML(source.merchant)}</strong>
            ${escapeHTML(source.message || "No parseable products returned.")}
            <br /><a href="${escapeHTML(source.checkoutUrl)}" target="_blank" rel="noreferrer">Open merchant checkout</a>
          </div>
        `
      )
      .join("");
    return;
  }

  nodes.offersGrid.innerHTML = ranked.slice(0, 6).map(offerTemplate).join("");
}

function rankedOffers() {
  const loved = [...refinement.loveColours];
  const avoided = [...refinement.avoidColours];

  return offers
    .map((offer, index) => {
      const fit = offer.fit || { occasion: [], relationship: [], style: [], colors: [] };
      let match = Number(offer.score || 70);
      if (refinement.occasion && fit.occasion.includes(refinement.occasion)) match += 9;
      if (refinement.relationship && fit.relationship.includes(refinement.relationship)) match += 7;
      if (refinement.aesthetic && fit.style.includes(refinement.aesthetic)) match += 11;
      if (refinement.palette === "mono" && fit.colors.length <= 2) match += 4;
      match += loved.filter((colour) => fit.colors.includes(colour) || fit.colors.includes(toServerColour(colour))).length * 5;
      match -= avoided.filter((colour) => fit.colors.includes(colour) || fit.colors.includes(toServerColour(colour))).length * 10;
      if (refinement.occasion === "sympathy" && fit.colors.includes("colorful")) match -= 12;

      return {
        ...offer,
        match: Math.max(58, Math.min(99, match)),
        visualImage: chooseImage(offer, index)
      };
    })
    .sort((a, b) => b.match - a.match || total(a) - total(b));
}

function offerTemplate(offer, index) {
  const detailsOpen = openDetails.has(offer.id);
  const badge = index === 0 ? "✣ Best match" : index === 1 ? "✣ Best value" : offer.longevity >= 10 ? "✣ Lasts longest" : "";
  const colourDots = displayColours(offer);
  return `
    <article class="bouquet-card ${index === 0 ? "is-featured" : ""} ${detailsOpen ? "is-open" : ""} ${
      selectedOfferId === offer.id ? "is-selected" : ""
    }" data-offer-id="${escapeHTML(offer.id)}">
      <div class="bouquet-media">
        <img
          src="${escapeHTML(offer.visualImage)}"
          alt="${escapeHTML(offer.product)} from ${escapeHTML(offer.merchant)}"
          onerror="this.onerror=null;this.src='${escapeHTML(offer.fallbackImage || imageFallbacks[index % imageFallbacks.length])}'"
        />
        ${badge ? `<span class="badge">${badge}</span>` : ""}
        <span class="longevity-chip">◷ Blooms for at least ${offer.longevity} days</span>
      </div>
      <div class="bouquet-body">
        <div class="bouquet-heading">
          <div>
            <h3>${escapeHTML(shortName(offer.product))}</h3>
            <p>${escapeHTML(primaryFlower(offer))}</p>
          </div>
          <div class="price-stack">
            <strong>${euro(total(offer))}</strong>
            <span class="price-breakdown">${euroExact(offer.price)} + ${euroExact(offer.delivery)} delivery</span>
          </div>
        </div>
        <p class="shop-line">Shop: ${escapeHTML(offer.merchant)}</p>
        <p class="bouquet-description">${escapeHTML(descriptionFor(offer))}</p>
        <p class="delivery-line">♧ Delivery timing varies by address</p>
        <div class="detail-box">
          <p>${escapeHTML(whyThisBouquet(offer))}</p>
          <p class="meaning-line">${escapeHTML(meaningFor(offer))}</p>
          <div class="colour-dot-row">
            ${colourDots.map((dot) => `<span><i style="--dot:${dot.hex}"></i>${dot.label}</span>`).join("")}
          </div>
          <span class="merchant-line">Sold by ${escapeHTML(offer.merchant)}</span>
        </div>
        <a class="buy-button" href="${escapeHTML(offer.checkoutUrl)}" target="_blank" rel="noreferrer" data-checkout="${escapeHTML(offer.id)}">▣ Buy now</a>
        <button class="why-button" type="button" data-detail="${offer.id}">
          ${detailsOpen ? "Hide details ^" : "Why this bouquet? ˅"}
        </button>
      </div>
    </article>
  `;
}

function chooseImage(offer, index) {
  const image = offer.image || "";
  const generic = /og-image|fleurop\.svg|logo|amazon/i.test(image);
  if (image && !generic) return image;

  const product = `${offer.product} ${offer.merchant}`.toLowerCase();
  if (/orchidee|white|weiss|weiß/.test(product)) return "./assets/products/white-orchid.png";
  if (/rose|rosen|crimson|rot/.test(product)) return "./assets/products/premium-roses.png";
  if (/tulpen|bunt|orange|gelb|fröhlich|froehlich/.test(product)) return "./assets/products/local-tulips.png";
  if (/soft|light|lovely|pfingst|berry|pink|rosa/.test(product)) return "./assets/products/soft-romantic.png";
  if (/garten|sommer|meadow|mix/.test(product)) return "./assets/products/spring-mix.png";
  return imageFallbacks[index % imageFallbacks.length];
}

function shortName(name) {
  return name
    .replace(/Dominik Blumen und Pflanzen,?/i, "")
    .replace(/Blumenstrauß/i, "")
    .replace(/["“”]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(" ");
}

function primaryFlower(offer) {
  const name = offer.product.toLowerCase();
  if (/rose|rosen/.test(name)) return "Rose";
  if (/pfingst|peony/.test(name)) return "Peony";
  if (/orchidee/.test(name)) return "Orchid";
  if (/tulpen/.test(name)) return "Tulip";
  if (/garten|mix|sommer|früh/.test(name)) return "Mixed bouquet";
  return offer.type;
}

function descriptionFor(offer) {
  const flower = primaryFlower(offer).toLowerCase();
  if (flower === "rose") return "Deep red roses with a polished, gift-ready feel.";
  if (flower === "peony") return "Soft petals and a romantic shape that opens slowly.";
  if (flower === "orchid") return "Elegant, minimal, and made to last longer.";
  if (flower === "tulip") return "Bright stems with an easy, cheerful feel.";
  return "Fresh seasonal flowers matched to your delivery window.";
}

function whyThisBouquet(offer) {
  const product = offer.product.toLowerCase();
  if (/rose|rosen/.test(product)) return "A rose bouquet is the classic love letter: structured, unmistakable, and confident.";
  if (/garten|mix|sommer|früh/.test(product)) return "Mixed seasonal stems feel personal and relaxed, with enough colour to make the gift feel alive.";
  if (/orchidee/.test(product)) return "An orchid is calm, elegant, and lasts longer than a typical cut bouquet.";
  return "This option balances price, delivery route, and the emotional tone you selected.";
}

function meaningFor(offer) {
  if (refinement.occasion && meanings[refinement.occasion]) return meanings[refinement.occasion];
  const product = offer.product.toLowerCase();
  if (/rose|rosen/.test(product)) return meanings.anniversary;
  if (/garten|mix|sommer|tulpen/.test(product)) return meanings.birthday;
  if (/orchidee|white|weiß|weiss/.test(product)) return meanings.sympathy;
  return "The right bouquet should feel obvious before it feels explained.";
}

function displayColours(offer) {
  const colors = (offer.fit?.colors || ["mixed"]).slice(0, 3);
  const palette = {
    red: ["Reds", "#dd2531"],
    classic: ["Reds", "#dd2531"],
    pink: ["Pinks", "#ff9abc"],
    white: ["Whites", "#f7f4ee"],
    neutral: ["Whites", "#f7f4ee"],
    yellow: ["Yellows", "#ffdc4d"],
    purple: ["Purples", "#8c63c7"],
    coral: ["Oranges", "#ff7a1a"],
    orange: ["Oranges", "#ff7a1a"],
    green: ["Greens", "#5aac67"],
    mixed: ["Mixed", "#d8a2ff"],
    colorful: ["Mixed", "#fb5b62"]
  };

  return colors.map((colour) => {
    const item = palette[colour] || palette.mixed;
    return { label: item[0], hex: item[1] };
  });
}

function toServerColour(colour) {
  if (colour === "white") return "neutral";
  if (colour === "orange") return "coral";
  return colour;
}

function labelFor(options, value) {
  if (!value) return "";
  return options.find(([optionValue]) => optionValue === value)?.[1] || value;
}

function recipientSummary() {
  const parts = [
    labelFor(relationshipOptions, refinement.relationship),
    labelFor(genderOptions, refinement.gender),
    labelFor(ageOptions, refinement.age)
  ].filter(Boolean);
  return parts.join(", ");
}

function recipientSelectionCount() {
  return [refinement.relationship, refinement.gender, refinement.age].filter(Boolean).length;
}

function selectionChips() {
  return [
    ["Occasion", labelFor(occasionOptions, refinement.occasion)],
    ["Recipient", recipientSummary()],
    ["Aesthetic", labelFor(aestheticOptions.map((item) => [item.id, item.label]), refinement.aesthetic)],
    ["Colours", [...refinement.loveColours].map((colour) => colourNames[colour]).join(", ")],
    ["Locale", localeSummary()]
  ];
}

function localeSummary() {
  if (userContext.locale.city) return userContext.locale.city;
  return [languageName(userContext.locale.locale), timeZoneName(userContext.locale.timeZone)].filter(Boolean).join(" / ");
}

function languageName(locale) {
  if (!locale) return "";
  const language = locale.split("-")[0];
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(language) || "English";
  } catch {
    return language === "en" ? "English" : language.toUpperCase();
  }
}

function timeZoneName(timeZone) {
  if (!timeZone) return "";
  if (timeZone === "Europe/Berlin") return "Berlin time";
  return timeZone.replace(/_/g, " ");
}

function revealAndScroll(step) {
  step.classList.add("is-visible");
  window.setTimeout(() => {
    step.scrollIntoView({ block: "start", behavior: "smooth" });
  }, 80);
}

function openRefinement() {
  nodes.refinementFlow.hidden = false;
  renderAll();

  if (userContext.rawIntent && selectionChips().some(([, value]) => value)) {
    window.setTimeout(() => {
      nodes.refinementFlow.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 80);
    return;
  }

  revealAndScroll(nodes.occasionStep);
}

function finishRefinement() {
  intakeComplete = true;
  resetCheckoutIntent();
  loadLiveOffers(true);
  document.querySelector(".summary-bar").scrollIntoView({ block: "start", behavior: "smooth" });
}

async function loadLiveOffers(refresh = false) {
  offersLoading = true;
  fetchError = "";
  renderAll();

  try {
    const response = await fetch(`/api/offers?${offerQueryString(refresh)}`);
    if (!response.ok) throw new Error(`Offer fetch failed with HTTP ${response.status}`);
    const payload = await response.json();
    latestToolResult = payload;
    offers = payload.offers || [];
    sourceStatus = payload.sourceStatus || [];
    selectedOfferId = ensureSelectedOffer(selectedOfferId, offers);
    offersLoading = false;
    fetchError = "";
  } catch (error) {
    offers = [];
    sourceStatus = [];
    offersLoading = false;
    fetchError = error.message || "Could not fetch merchant pages.";
  }

  renderAll();
}

function offerQueryString(refresh = false) {
  const params = new URLSearchParams({
    flowerType: criteria.flowerType,
    location: userContext.locale.city || "Berlin",
    address: criteria.address,
    deliveryDate: criteria.deliveryDate
  });

  if (criteria.budgetMin !== null) params.set("budgetMin", String(criteria.budgetMin));
  if (criteria.budgetMax !== null) params.set("budgetMax", String(criteria.budgetMax));
  if (refinement.occasion) params.set("occasion", refinement.occasion);
  if (refinement.relationship) params.set("relationship", refinement.relationship);
  if (refinement.loveColours.size) params.set("lovedColors", [...refinement.loveColours].join(","));
  if (refinement.avoidColours.size) params.set("avoidedColors", [...refinement.avoidColours].join(","));
  if (refinement.aesthetic) params.set("style", refinement.aesthetic);
  if (refresh) params.set("refresh", "1");

  return params.toString();
}

function selectedOffer() {
  return rankedOffers().find((offer) => offer.id === selectedOfferId) || null;
}

function recommendedOffer() {
  return rankedOffers()[0] || null;
}

function ensureSelectedOffer(offerId, currentOffers) {
  if (currentOffers.some((offer) => offer.id === offerId)) return offerId;
  return currentOffers[0]?.id || "";
}

function selectOffer(offerId, reason = "selected") {
  if (!offers.some((offer) => offer.id === offerId)) return;
  selectedOfferId = offerId;
  if (reason !== "checkout") resetCheckoutIntent();
  renderOffers();
  publishWidgetState(reason);
}

function checkoutPayload(offer) {
  return {
    mcpd: "flowera.procurement.v1",
    tool: "searchFlowers",
    merchantId: offer.id,
    operation: offer.mode,
    productUrl: offer.productUrl,
    sourceUrl: offer.sourceUrl,
    checkoutUrl: offer.checkoutUrl,
    refinement: serializeRefinement(),
    delivery: {
      address: criteria.address,
      date: criteria.deliveryDate
    },
    item: {
      name: offer.product,
      total: Number(total(offer).toFixed(2)),
      estimatedLongevityDays: offer.longevity
    },
    status: "live_page_fetch"
  };
}

function serializeRefinement() {
  return {
    occasion: refinement.occasion,
    occasionNote: refinement.occasionNote,
    relationship: refinement.relationship,
    gender: refinement.gender,
    age: refinement.age,
    aesthetic: refinement.aesthetic,
    loveColours: [...refinement.loveColours],
    avoidColours: [...refinement.avoidColours],
    palette: refinement.palette
  };
}

function buildWidgetState() {
  const selected = selectedOffer();
  const recommended = recommendedOffer();
  return {
    version: widgetStateVersion,
    criteria: {
      flowerType: criteria.flowerType,
      location: userContext.locale.city || "Berlin",
      address: criteria.address,
      budgetMin: criteria.budgetMin,
      budgetMax: criteria.budgetMax,
      deliveryDate: criteria.deliveryDate,
      recipients: criteria.recipients,
      rawIntent: userContext.rawIntent
    },
    refinement: serializeRefinement(),
    selectedOfferId: selected?.id || "",
    selectedOffer: summarizeOffer(selected),
    recommendedOfferId: recommended?.id || "",
    recommendedOffer: summarizeOffer(recommended),
    checkoutIntent,
    toolResult: latestToolResult
      ? {
          tool: latestToolResult.tool,
          recommendedOfferId: latestToolResult.recommendedOfferId,
          reason: latestToolResult.reason,
          fetchedAt: latestToolResult.fetchedAt,
          cached: latestToolResult.cached
        }
      : null,
    sourceStatus,
    offersCount: offers.length,
    loading: offersLoading,
    error: fetchError,
    intakeComplete
  };
}

function summarizeOffer(offer) {
  if (!offer) return null;
  return {
    id: offer.id,
    merchant: offer.merchant,
    product: offer.product,
    total: Number(total(offer).toFixed(2)),
    match: offer.match,
    checkoutUrl: offer.checkoutUrl,
    productUrl: offer.productUrl || offer.sourceUrl,
    fit: offer.fit
  };
}

function publishWidgetState(reason = "updated") {
  widgetStateVersion += 1;
  const state = buildWidgetState();
  state.version = widgetStateVersion;
  state.reason = reason;
  window.FloweraWidgetState = state;
  if (nodes.widgetState) nodes.widgetState.textContent = JSON.stringify(state);
  window.dispatchEvent(new CustomEvent("flowera:widget-state", { detail: state }));
  widgetStateSubscribers.forEach((subscriber) => subscriber(state));
  publishToHost(state);
}

function publishToHost(state) {
  try {
    window.skybridge?.setWidgetState?.(state);
    window.openai?.setWidgetState?.({
      modelContent: state,
      privateContent: state
    });
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "flowera:widget-state", state }, "*");
    }
  } catch {
    // Host bridges are optional in local browser mode.
  }
}

window.FloweraWidget = {
  getState: () => buildWidgetState(),
  setCriteria(nextCriteria = {}) {
    Object.assign(criteria, {
      flowerType: valueOrCurrent(nextCriteria, "flowerType", criteria.flowerType),
      address: valueOrCurrent(nextCriteria, "address", criteria.address),
      budgetMin: valueOrCurrent(nextCriteria, "budgetMin", criteria.budgetMin),
      budgetMax: valueOrCurrent(nextCriteria, "budgetMax", criteria.budgetMax),
      deliveryDate: valueOrCurrent(nextCriteria, "deliveryDate", criteria.deliveryDate),
      recipients: valueOrCurrent(nextCriteria, "recipients", criteria.recipients)
    });
    if (Object.prototype.hasOwnProperty.call(nextCriteria, "location")) userContext.locale.city = nextCriteria.location || "";
    selectedOfferId = "";
    checkoutIntent = null;
    loadLiveOffers(true);
  },
  setRefinement(nextRefinement = {}) {
    Object.assign(refinement, {
      occasion: valueOrCurrent(nextRefinement, "occasion", refinement.occasion),
      occasionNote: valueOrCurrent(nextRefinement, "occasionNote", refinement.occasionNote),
      relationship: valueOrCurrent(nextRefinement, "relationship", refinement.relationship),
      gender: valueOrCurrent(nextRefinement, "gender", refinement.gender),
      age: valueOrCurrent(nextRefinement, "age", refinement.age),
      aesthetic: valueOrCurrent(nextRefinement, "aesthetic", nextRefinement.style ?? refinement.aesthetic),
      palette: valueOrCurrent(nextRefinement, "palette", refinement.palette)
    });
    if (nextRefinement.loveColours || nextRefinement.lovedColors) {
      refinement.loveColours = new Set(toColourArray(nextRefinement.loveColours || nextRefinement.lovedColors));
    }
    if (nextRefinement.avoidColours || nextRefinement.avoidedColors) {
      refinement.avoidColours = new Set(toColourArray(nextRefinement.avoidColours || nextRefinement.avoidedColors));
    }
    selectedOfferId = "";
    checkoutIntent = null;
    loadLiveOffers(true);
  },
  selectOffer,
  clearCheckoutIntent() {
    checkoutIntent = null;
    publishWidgetState("checkout_cleared");
  },
  subscribe(subscriber) {
    widgetStateSubscribers.add(subscriber);
    subscriber(buildWidgetState());
    return () => widgetStateSubscribers.delete(subscriber);
  }
};

function valueOrCurrent(source, key, currentValue) {
  return Object.prototype.hasOwnProperty.call(source, key) ? source[key] : currentValue;
}

function toColourArray(value) {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split(/[,/ ]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

nodes.stickyRefine.addEventListener("click", openRefinement);
nodes.showBouquets.addEventListener("click", finishRefinement);
nodes.occasionNote.addEventListener("input", (event) => {
  refinement.occasionNote = event.target.value;
  resetCheckoutIntent();
  publishWidgetState("refinement_changed");
});

nodes.intentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitIntent(nodes.intentInput.value);
});

document.addEventListener("click", (event) => {
  const skipButton = event.target.closest("[data-skip-step]");
  const occasionButton = event.target.closest("[data-occasion]");
  const relationshipButton = event.target.closest("[data-relationship]");
  const genderButton = event.target.closest("[data-gender]");
  const ageButton = event.target.closest("[data-age]");
  const aestheticButton = event.target.closest("[data-aesthetic]");
  const loveButton = event.target.closest("[data-love-colour]");
  const avoidButton = event.target.closest("[data-avoid-colour]");
  const paletteButton = event.target.closest("[data-palette]");
  const detailButton = event.target.closest("[data-detail]");

  if (skipButton) {
    skipRefinementStep(skipButton.dataset.skipStep);
    return;
  }

  if (occasionButton) {
    refinement.occasion = occasionButton.dataset.occasion;
    resetCheckoutIntent();
    skippedSteps.delete("occasion");
    autoSelectColoursForOccasion(refinement.occasion);
    renderAll();
    revealAndScroll(nodes.recipientStep);
  }

  if (relationshipButton) {
    refinement.relationship = relationshipButton.dataset.relationship;
    handleRecipientStepSelection();
  }

  if (genderButton) {
    refinement.gender = genderButton.dataset.gender;
    handleRecipientStepSelection();
  }

  if (ageButton) {
    refinement.age = ageButton.dataset.age;
    handleRecipientStepSelection();
  }

  if (aestheticButton) {
    refinement.aesthetic = aestheticButton.dataset.aesthetic;
    resetCheckoutIntent();
    skippedSteps.delete("aesthetic");
    renderAll();
    revealAndScroll(nodes.colourStep);
  }

  if (loveButton) {
    resetCheckoutIntent();
    toggleSetValue(refinement.loveColours, loveButton.dataset.loveColour);
    refinement.avoidColours.delete(loveButton.dataset.loveColour);
    renderAll();
  }

  if (avoidButton) {
    resetCheckoutIntent();
    toggleSetValue(refinement.avoidColours, avoidButton.dataset.avoidColour);
    refinement.loveColours.delete(avoidButton.dataset.avoidColour);
    renderAll();
  }

  if (paletteButton) {
    refinement.palette = paletteButton.dataset.palette;
    resetCheckoutIntent();
    renderAll();
  }

  if (detailButton) {
    const id = detailButton.dataset.detail;
    if (openDetails.has(id)) openDetails.delete(id);
    else openDetails.add(id);
    renderOffers();
  }

  const offerCard = event.target.closest("[data-offer-id]");
  const checkoutLink = event.target.closest("[data-checkout]");

  if (checkoutLink) {
    const offer = rankedOffers().find((item) => item.id === checkoutLink.dataset.checkout);
    if (offer) {
      selectedOfferId = offer.id;
      checkoutIntent = checkoutPayload(offer);
      publishWidgetState("checkout_opened");
    }
    return;
  }

  if (offerCard && !detailButton) {
    selectOffer(offerCard.dataset.offerId);
  }
});

function toggleSetValue(set, value) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

function resetCheckoutIntent() {
  checkoutIntent = null;
}

function handleRecipientStepSelection() {
  resetCheckoutIntent();
  const hasEnoughSelections = recipientSelectionCount() >= 2;
  if (hasEnoughSelections) skippedSteps.delete("recipient");
  renderAll();
  if (hasEnoughSelections) {
    revealAndScroll(nodes.aestheticStep);
  }
}

function skipRefinementStep(step) {
  resetCheckoutIntent();
  skippedSteps.add(step);

  if (step === "occasion") {
    renderAll();
    revealAndScroll(nodes.recipientStep);
    return;
  }

  if (step === "recipient") {
    renderAll();
    revealAndScroll(nodes.aestheticStep);
    return;
  }

  if (step === "aesthetic") {
    renderAll();
    revealAndScroll(nodes.colourStep);
    return;
  }

  finishRefinement();
}

function autoSelectColoursForOccasion(occasion) {
  if (refinement.loveColours.size) return;
  const map = {
    birthday: ["yellow", "pink"],
    anniversary: ["red", "pink"],
    sympathy: ["white", "green"],
    "just-because": ["pink", "purple"],
    "thank-you": ["pink", "white"],
    "get-well": ["yellow", "orange"]
  };
  (map[occasion] || []).forEach((colour) => refinement.loveColours.add(colour));
}

function submitIntent(value) {
  const intent = value.trim();
  if (!intent) {
    nodes.intentInput.focus();
    return;
  }

  const parsed = parseIntent(intent);
  userContext.rawIntent = intent;
  resetRefinementForIntent();
  applyParsedIntent(parsed);
  if (!hasParsedRefinement(parsed)) applyDefaultRefinement();
  intakeComplete = true;
  nodes.refinementFlow.hidden = false;
  loadLiveOffers(true);
}

function resetRefinementForIntent() {
  refinement.occasion = "";
  refinement.occasionNote = "";
  refinement.relationship = "";
  refinement.gender = "";
  refinement.age = "";
  refinement.aesthetic = "";
  refinement.loveColours.clear();
  refinement.avoidColours.clear();
  refinement.palette = "mixed";
  skippedSteps.clear();
  nodes.occasionNote.value = "";
  openDetails.clear();
  selectedOfferId = "";
  checkoutIntent = null;
  userContext.locale.city = "";
}

function applyDefaultRefinement() {
  refinement.occasion = "anniversary";
  refinement.loveColours.add("red");
  refinement.loveColours.add("pink");
}

function hasParsedRefinement(parsed) {
  return Boolean(
    parsed.occasion ||
      parsed.relationship ||
      parsed.gender ||
      parsed.age ||
      parsed.aesthetic ||
      parsed.colours.love.length ||
      parsed.colours.avoid.length ||
      parsed.locale.city
  );
}

function parseIntent(value) {
  const text = normalizeText(value);
  return {
    occasion: parseOccasion(text),
    relationship: parseRelationship(text),
    gender: parseGender(text),
    age: parseAge(text),
    aesthetic: parseAesthetic(text),
    colours: parseColours(text),
    locale: parseLocale(text)
  };
}

function applyParsedIntent(parsed) {
  if (parsed.occasion) {
    refinement.occasion = parsed.occasion;
    autoSelectColoursForOccasion(parsed.occasion);
  }
  if (parsed.relationship) refinement.relationship = parsed.relationship;
  if (parsed.gender) refinement.gender = parsed.gender;
  if (parsed.age) refinement.age = parsed.age;
  if (parsed.aesthetic) refinement.aesthetic = parsed.aesthetic;
  parsed.colours.love.forEach((colour) => {
    refinement.loveColours.add(colour);
    refinement.avoidColours.delete(colour);
  });
  parsed.colours.avoid.forEach((colour) => {
    refinement.avoidColours.add(colour);
    refinement.loveColours.delete(colour);
  });
  if (parsed.locale.city) userContext.locale.city = parsed.locale.city;
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseOccasion(text) {
  if (/\b(birthday|geburtstag)\b/.test(text)) return "birthday";
  if (/\b(anniversary|jahrestag|hochzeitstag)\b/.test(text)) return "anniversary";
  if (/\b(sympathy|condolence|funeral|trauer|beileid)\b/.test(text)) return "sympathy";
  if (/\b(thank|thanks|danke|thank-you)\b/.test(text)) return "thank-you";
  if (/\b(get well|gute besserung|recover|krank)\b/.test(text)) return "get-well";
  if (/\b(just because|einfach so|thinking of you)\b/.test(text)) return "just-because";
  return "";
}

function parseRelationship(text) {
  if (/\b(mom|mum|mother|mama|mutter|mutti|dad|father|papa|vater|parent|parents)\b/.test(text)) return "parent";
  if (/\b(partner|wife|husband|girlfriend|boyfriend|freundin|freund|spouse)\b/.test(text)) return "partner";
  if (/\b(friend|best friend|freundin|freund)\b/.test(text)) return "friend";
  if (/\b(colleague|coworker|boss|kollege|kollegin|chef)\b/.test(text)) return "colleague";
  if (/\b(sister|brother|sibling|schwester|bruder)\b/.test(text)) return "sibling";
  if (/\b(myself|for me|self|mich)\b/.test(text)) return "self";
  return "";
}

function parseGender(text) {
  if (/\b(mom|mum|mother|mama|mutter|mutti|wife|girlfriend|sister|woman|female|frau|schwester|kollegin)\b/.test(text)) return "woman";
  if (/\b(dad|father|papa|vater|husband|boyfriend|brother|man|male|mann|bruder|kollege)\b/.test(text)) return "man";
  if (/\b(non-binary|nonbinary|divers)\b/.test(text)) return "non-binary";
  return "";
}

function parseAge(text) {
  const match = text.match(/\b([1-9][0-9])\s*(?:years old|year old|yo|jahre|jahrig|jährig)?\b/);
  if (!match) return "";
  const age = Number(match[1]);
  if (age < 18) return "under-18";
  if (age <= 30) return "18-30";
  if (age <= 50) return "30-50";
  if (age <= 70) return "50-70";
  return "70-plus";
}

function parseAesthetic(text) {
  if (/\b(wild|garden|garden-y|natural|wiese|naturlich|natuerlich)\b/.test(text)) return "wild";
  if (/\b(elegant|structured|classic|klassisch|edel)\b/.test(text)) return "elegant";
  if (/\b(bold|colorful|colourful|bright|bunt|knallig)\b/.test(text)) return "bold";
  if (/\b(soft|romantic|rosa|zart|romantisch)\b/.test(text)) return "soft";
  if (/\b(minimal|minimalist|single stem|einzelne blume)\b/.test(text)) return "minimal";
  return "";
}

function parseColours(text) {
  const colours = {
    white: ["white", "weiss", "weiß"],
    pink: ["pink", "rosa"],
    red: ["red", "rot"],
    yellow: ["yellow", "gelb"],
    purple: ["purple", "violet", "lila"],
    orange: ["orange"],
    green: ["green", "grun", "grün"]
  };
  const result = { love: [], avoid: [] };

  Object.entries(colours).forEach(([colour, words]) => {
    words.forEach((word) => {
      const avoidPattern = new RegExp(`\\b(no|not|avoid|without|keine|kein|nicht)\\b.{0,18}\\b${word}\\b|\\b${word}\\b.{0,18}\\b(avoid|vermeiden)\\b`);
      const lovePattern = new RegExp(`\\b${word}\\b`);
      if (avoidPattern.test(text)) result.avoid.push(colour);
      else if (lovePattern.test(text)) result.love.push(colour);
    });
  });

  return {
    love: [...new Set(result.love)],
    avoid: [...new Set(result.avoid)]
  };
}

function parseLocale(text) {
  const cities = {
    berlin: "Berlin",
    hamburg: "Hamburg",
    munich: "Munich",
    munchen: "Munich",
    cologne: "Cologne",
    koln: "Cologne",
    frankfurt: "Frankfurt",
    dusseldorf: "Dusseldorf",
    duesseldorf: "Dusseldorf"
  };
  const match = Object.keys(cities).find((city) => new RegExp(`\\b${city}\\b`).test(text));
  return { city: match ? cities[match] : "" };
}

renderAll();
loadLiveOffers();
