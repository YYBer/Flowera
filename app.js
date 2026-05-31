let offers = [];
let sourceStatus = [];
let offersLoading = true;
let fetchError = "";
let selectedOfferId = "";
let checkoutIntent = null;
let latestToolResult = null;
let widgetStateVersion = 0;
const widgetStateSubscribers = new Set();

const occasionOptions = [
  ["birthday", "Birthday"],
  ["anniversary", "Anniversary"],
  ["thank-you", "Thank you"],
  ["just-because", "Just because"],
  ["sympathy", "Sympathy"]
];

const relationshipOptions = [
  ["partner", "Partner"],
  ["parent", "Parent"],
  ["friend", "Friend"],
  ["colleague", "Colleague"]
];

const styles = [
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

const meanings = {
  birthday: 'Sunflowers and bright mixed bouquets say "you brighten the room" - great for a cheerful birthday.',
  anniversary: "Red roses signal deep affection, so a structured rose bouquet feels confident without needing explanation.",
  "thank-you": "Soft pinks and lisianthus read as gratitude and appreciation - warm, but not overly romantic.",
  "just-because": 'Tulips and garden-style flowers feel spontaneous, like a small "I thought of you" moment.',
  sympathy: "White orchids and gentle whites suggest calm, respect, and care without making the gesture feel loud."
};

const nodes = {
  offersStrip: document.querySelector("#offersStrip"),
  slotRow: document.querySelector("#slotRow"),
  sourceStatusRow: document.querySelector("#sourceStatusRow"),
  composer: document.querySelector("#composer"),
  queryInput: document.querySelector("#queryInput"),
  resultTitle: document.querySelector("#resultTitle"),
  resultSubtitle: document.querySelector("#resultSubtitle"),
  recommendationText: document.querySelector("#recommendationText"),
  refineButton: document.querySelector("#refineButton"),
  refinePanel: document.querySelector("#refinePanel"),
  occasionChoices: document.querySelector("#occasionChoices"),
  relationshipChoices: document.querySelector("#relationshipChoices"),
  loveColors: document.querySelector("#loveColors"),
  avoidColors: document.querySelector("#avoidColors"),
  budgetMin: document.querySelector("#budgetMin"),
  budgetMax: document.querySelector("#budgetMax"),
  meaningNote: document.querySelector("#meaningNote"),
  moodBoard: document.querySelector("#moodBoard"),
  applyRefinement: document.querySelector("#applyRefinement"),
  resetRefinement: document.querySelector("#resetRefinement"),
  drawer: document.querySelector("#checkoutDrawer"),
  drawerBackdrop: document.querySelector("#drawerBackdrop"),
  drawerTitle: document.querySelector("#drawerTitle"),
  drawerBody: document.querySelector("#drawerBody"),
  closeDrawer: document.querySelector("#closeDrawer"),
  widgetState: document.querySelector("#flowera-widget-state")
};

const criteria = {
  flowerType: "Rosen",
  location: "Berlin",
  address: "Prenzlauer Allee 42, 10405 Berlin",
  budgetMin: 25,
  budgetMax: 55,
  deliveryDate: "Sat 30 May",
  recipients: "Gift delivery"
};

const refinement = {
  occasion: "",
  relationship: "",
  loveColors: "",
  avoidColors: "",
  style: ""
};

function euro(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

function total(offer) {
  return offer.price + offer.delivery;
}

function renderChoices(target, options, selectedValue, group) {
  target.innerHTML = options
    .map(([value, label]) => {
      const selected = value === selectedValue;
      return `<button class="choice-chip ${selected ? "is-selected" : ""}" type="button" data-${group}="${value}">${label}</button>`;
    })
    .join("");
}

function renderMoodBoard() {
  nodes.moodBoard.innerHTML = styles
    .map(
      (style) => `
        <button class="style-tile ${refinement.style === style.id ? "is-selected" : ""}" type="button" data-style="${style.id}">
          <img src="${style.image}" alt="${style.label} bouquet style" />
          <span>${style.label}</span>
        </button>
      `
    )
    .join("");
}

function renderRefinement() {
  renderChoices(nodes.occasionChoices, occasionOptions, refinement.occasion, "occasion");
  renderChoices(nodes.relationshipChoices, relationshipOptions, refinement.relationship, "relationship");
  renderMoodBoard();
  nodes.loveColors.value = refinement.loveColors;
  nodes.avoidColors.value = refinement.avoidColors;
  nodes.budgetMin.value = criteria.budgetMin ?? "";
  nodes.budgetMax.value = criteria.budgetMax ?? "";
  nodes.meaningNote.textContent =
    meanings[refinement.occasion] ||
    "A little symbolism can help: the right color and shape tells the recipient what the gift is meant to feel like.";
}

function renderSlots() {
  const slots = [
    ["Flower", criteria.flowerType],
    ["Area", criteria.location],
    ["Budget", budgetLabel()],
    ["Delivery", criteria.deliveryDate],
    ["Address", criteria.address]
  ];

  if (refinement.occasion) slots.push(["Occasion", labelFor(occasionOptions, refinement.occasion)]);
  if (refinement.relationship) slots.push(["For", labelFor(relationshipOptions, refinement.relationship)]);
  if (refinement.style) slots.push(["Style", styles.find((style) => style.id === refinement.style)?.label || refinement.style]);

  nodes.slotRow.innerHTML = slots
    .map(([label, value]) => `<span class="slot-chip">${label}<strong>${escapeHTML(value)}</strong></span>`)
    .join("");
}

function labelFor(options, value) {
  return options.find(([optionValue]) => optionValue === value)?.[1] || value;
}

function normalizeTerms(value) {
  return value
    .toLowerCase()
    .split(/[,/ ]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function rankedOffers() {
  const loved = normalizeTerms(refinement.loveColors);
  const avoided = normalizeTerms(refinement.avoidColors);

  return offers
    .map((offer) => {
      const fit = offer.fit || { occasion: [], relationship: [], style: [], colors: [] };
      let match = Number(offer.score || 70);
      if (refinement.occasion && fit.occasion.includes(refinement.occasion)) match += 8;
      if (refinement.relationship && fit.relationship.includes(refinement.relationship)) match += 6;
      if (refinement.style && fit.style.includes(refinement.style)) match += 10;
      match += loved.filter((color) => fit.colors.includes(color)).length * 5;
      match -= avoided.filter((color) => fit.colors.includes(color)).length * 9;
      if (refinement.occasion === "sympathy" && fit.colors.includes("colorful")) match -= 12;
      if (refinement.relationship === "colleague" && (offer.sourceId === "24blooms" || offer.sourceId === "fleurop")) match -= 5;

      return {
        ...offer,
        match: Math.max(58, Math.min(99, match))
      };
    })
    .sort((a, b) => b.match - a.match || total(a) - total(b));
}

function renderOffers() {
  if (offersLoading) {
    nodes.offersStrip.innerHTML = `<div class="status-card">Fetching live products from REWE, Blume2000, 24blooms, Fleurop, and Amazon...</div>`;
    return;
  }

  if (fetchError) {
    nodes.offersStrip.innerHTML = `<div class="status-card is-error">${escapeHTML(fetchError)}</div>`;
    return;
  }

  if (!offers.length) {
    nodes.offersStrip.innerHTML = sourceStatus
      .map(
        (source) => `
          <div class="status-card">
            <strong>${escapeHTML(source.merchant)}</strong>
            <span>${escapeHTML(source.message || "No parseable products returned")}</span>
            <a href="${escapeHTML(source.sourceUrl)}" target="_blank" rel="noreferrer">Open source</a>
          </div>
        `
      )
      .join("");
    return;
  }

  nodes.offersStrip.innerHTML = rankedOffers().map(offerTemplate).join("");
}

function renderSourceStatus() {
  if (offersLoading) {
    nodes.sourceStatusRow.innerHTML = `<span class="source-pill">Fetching merchant pages</span>`;
    return;
  }

  nodes.sourceStatusRow.innerHTML = sourceStatus
    .map(
      (source) => `
        <span class="source-pill ${source.ok ? "is-ok" : ""}">
          ${escapeHTML(source.merchant)}
          <a href="${escapeHTML(source.sourceUrl)}" target="_blank" rel="noreferrer">source</a>
          <a href="${escapeHTML(source.checkoutUrl)}" target="_blank" rel="noreferrer">cart</a>
        </span>
      `
    )
    .join("");
}

function offerTemplate(offer, index) {
  return `
    <article class="offer-card ${index === 0 ? "recommended" : ""} ${
      selectedOfferId === offer.id ? "is-selected" : ""
    }" data-offer-id="${escapeHTML(offer.id)}">
      <div class="offer-image">
        <img
          src="${escapeHTML(offer.image)}"
          alt="${escapeHTML(offer.product)} from ${escapeHTML(offer.merchant)}"
          onerror="this.onerror=null;this.src='${escapeHTML(offer.fallbackImage || "./assets/products/spring-mix.png")}'"
        />
        <span class="offer-badge">${escapeHTML(index === 0 ? "Best refined match" : offer.badge)}</span>
      </div>
      <div class="offer-content">
        <div class="merchant-line">
          <div>
            <h3>${escapeHTML(offer.merchant)}</h3>
            <span>${escapeHTML(offer.type)}</span>
          </div>
          <span>${offer.match}%</span>
        </div>
        <p>${escapeHTML(offer.product)}</p>
        <div class="price-line">
          <span>${escapeHTML(offer.eta)}</span>
          <strong>${euro(total(offer))}</strong>
        </div>
        <div class="meta-list">
          <span>${escapeHTML(offer.arrival)} · ${euro(offer.price)} + ${euro(offer.delivery)} delivery</span>
          <span class="longevity-note">lasts ~${offer.longevity} days</span>
          <span>${escapeHTML(offer.mode)}</span>
        </div>
        <div class="offer-links">
          <a href="${escapeHTML(offer.productUrl || offer.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>
          <button class="order-button" type="button" data-order="${offer.id}">Checkout URL</button>
        </div>
      </div>
    </article>
  `;
}

function renderRecommendation() {
  const best = rankedOffers()[0];
  if (offersLoading) {
    nodes.resultSubtitle.textContent = "Fetching live merchant pages...";
    nodes.recommendationText.textContent = "I am checking the merchant pages directly instead of using mock offers.";
    return;
  }

  if (!best) {
    nodes.resultSubtitle.textContent = "No live offers parsed yet";
    nodes.recommendationText.textContent =
      "The pages were requested, but no parseable product cards came back. Open a source link to continue directly with the merchant.";
    return;
  }

  const occasion = refinement.occasion ? labelFor(occasionOptions, refinement.occasion).toLowerCase() : "gift";
  const style = refinement.style ? styles.find((item) => item.id === refinement.style)?.label.toLowerCase() : "balanced";
  nodes.resultSubtitle.textContent = `${criteria.location} · ${criteria.deliveryDate} · ${criteria.flowerType} · ${budgetLabel()} · ${offers.length} live offers parsed`;
  nodes.recommendationText.textContent = `Best refined match: ${best.merchant}. It fits a ${occasion} with a ${style} feel, and should ${
    best.longevity >= 10 ? "last longer than a typical cut bouquet" : `last around ${best.longevity} days`
  }.`;
}

function renderAll() {
  renderRefinement();
  renderSlots();
  renderSourceStatus();
  renderOffers();
  renderRecommendation();
  publishWidgetState("render");
}

function runConversationSearch(event) {
  event.preventDefault();
  const query = nodes.queryInput.value.trim();
  if (!query) return;

  nodes.resultTitle.textContent = "German flower delivery";
  document.querySelector(".user-bubble").textContent = query;
  renderAll();
}

function applyRefinement() {
  refinement.loveColors = nodes.loveColors.value.trim();
  refinement.avoidColors = nodes.avoidColors.value.trim();
  criteria.budgetMin = parseBudgetInput(nodes.budgetMin.value);
  criteria.budgetMax = parseBudgetInput(nodes.budgetMax.value);
  selectedOfferId = "";
  checkoutIntent = null;
  loadLiveOffers(true);
  nodes.refinePanel.hidden = true;
}

function resetRefinement() {
  refinement.occasion = "";
  refinement.relationship = "";
  refinement.loveColors = "";
  refinement.avoidColors = "";
  refinement.style = "";
  criteria.budgetMin = 25;
  criteria.budgetMax = 55;
  selectedOfferId = "";
  checkoutIntent = null;
  loadLiveOffers(true);
}

function openCheckout(offerId) {
  selectOffer(offerId, "checkout");
  const offer = rankedOffers().find((item) => item.id === offerId);
  if (!offer) return;

  checkoutIntent = checkoutPayload(offer);
  nodes.drawerTitle.textContent = offer.merchant;
  nodes.drawerBody.innerHTML = checkoutTemplate(offer);
  nodes.drawerBackdrop.hidden = false;
  nodes.drawer.classList.add("is-open");
  nodes.drawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  publishWidgetState("checkout_opened");
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
    refinement,
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

function checkoutTemplate(offer) {
  const payload = checkoutIntent || checkoutPayload(offer);

  return `
    <div class="checkout-summary">
      <div><span>Total</span><strong>${euro(total(offer))}</strong></div>
      <div><span>Arrival</span><strong>${escapeHTML(offer.eta)}</strong></div>
      <div><span>Product</span><strong>${escapeHTML(offer.product)}</strong></div>
      <div><span>Longevity</span><strong>lasts ~${offer.longevity} days</strong></div>
    </div>

    <a class="checkout-link" href="${escapeHTML(offer.checkoutUrl)}" target="_blank" rel="noreferrer">
      Open checkout URL
    </a>

    <a class="source-link" href="${escapeHTML(offer.productUrl || offer.sourceUrl)}" target="_blank" rel="noreferrer">
      View source product
    </a>

    <label>
      Recipient name
      <input type="text" value="Maya Schneider" />
    </label>

    <label>
      Greeting card message
      <textarea>Happy birthday. Wishing you a bright and beautiful day.</textarea>
    </label>

    <pre class="payload-preview">${escapeHTML(JSON.stringify(payload, null, 2))}</pre>
  `;
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
    offersLoading = false;
    fetchError = error.message || "Could not fetch merchant pages.";
  }

  renderAll();
}

function offerQueryString(refresh = false) {
  const params = new URLSearchParams({
    flowerType: criteria.flowerType,
    location: criteria.location,
    address: criteria.address,
    deliveryDate: criteria.deliveryDate
  });

  if (criteria.budgetMin !== null) params.set("budgetMin", String(criteria.budgetMin));
  if (criteria.budgetMax !== null) params.set("budgetMax", String(criteria.budgetMax));
  if (refinement.occasion) params.set("occasion", refinement.occasion);
  if (refinement.relationship) params.set("relationship", refinement.relationship);
  if (refinement.loveColors) params.set("lovedColors", refinement.loveColors);
  if (refinement.avoidColors) params.set("avoidedColors", refinement.avoidColors);
  if (refinement.style) params.set("style", refinement.style);
  if (refresh) params.set("refresh", "1");

  return params.toString();
}

function parseBudgetInput(value) {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function budgetLabel() {
  if (criteria.budgetMin !== null && criteria.budgetMax !== null) return `EUR ${criteria.budgetMin}-${criteria.budgetMax}`;
  if (criteria.budgetMax !== null) return `Under EUR ${criteria.budgetMax}`;
  if (criteria.budgetMin !== null) return `From EUR ${criteria.budgetMin}`;
  return "Flexible budget";
}

function selectOffer(offerId, reason = "selected") {
  if (!offers.some((offer) => offer.id === offerId)) return;
  selectedOfferId = offerId;
  checkoutIntent = reason === "checkout" ? checkoutIntent : null;
  renderOffers();
  publishWidgetState(reason);
}

function ensureSelectedOffer(offerId, currentOffers) {
  if (currentOffers.some((offer) => offer.id === offerId)) return offerId;
  return currentOffers[0]?.id || "";
}

function selectedOffer() {
  return rankedOffers().find((offer) => offer.id === selectedOfferId) || null;
}

function recommendedOffer() {
  return rankedOffers()[0] || null;
}

function buildWidgetState() {
  const selected = selectedOffer();
  const recommended = recommendedOffer();
  return {
    version: widgetStateVersion,
    criteria: {
      flowerType: criteria.flowerType,
      location: criteria.location,
      address: criteria.address,
      budgetMin: criteria.budgetMin,
      budgetMax: criteria.budgetMax,
      budgetLabel: budgetLabel(),
      deliveryDate: criteria.deliveryDate,
      recipients: criteria.recipients
    },
    refinement: { ...refinement },
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
    error: fetchError
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

  const event = new CustomEvent("flowera:widget-state", { detail: state });
  window.dispatchEvent(event);
  widgetStateSubscribers.forEach((subscriber) => subscriber(state));
  publishToHost(state);
}

function publishToHost(state) {
  try {
    window.skybridge?.setWidgetState?.(state);
    window.openai?.setWidgetState?.(state);
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
      location: valueOrCurrent(nextCriteria, "location", criteria.location),
      address: valueOrCurrent(nextCriteria, "address", criteria.address),
      budgetMin: valueOrCurrent(nextCriteria, "budgetMin", criteria.budgetMin),
      budgetMax: valueOrCurrent(nextCriteria, "budgetMax", criteria.budgetMax),
      deliveryDate: valueOrCurrent(nextCriteria, "deliveryDate", criteria.deliveryDate),
      recipients: valueOrCurrent(nextCriteria, "recipients", criteria.recipients)
    });
    selectedOfferId = "";
    checkoutIntent = null;
    loadLiveOffers(true);
  },
  setRefinement(nextRefinement = {}) {
    Object.assign(refinement, {
      occasion: nextRefinement.occasion ?? refinement.occasion,
      relationship: nextRefinement.relationship ?? refinement.relationship,
      loveColors: nextRefinement.loveColors ?? nextRefinement.lovedColors ?? refinement.loveColors,
      avoidColors: nextRefinement.avoidColors ?? nextRefinement.avoidedColors ?? refinement.avoidColors,
      style: nextRefinement.style ?? refinement.style
    });
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

function applyDraftState() {
  refinement.loveColors = nodes.loveColors.value;
  refinement.avoidColors = nodes.avoidColors.value;
  criteria.budgetMin = parseBudgetInput(nodes.budgetMin.value);
  criteria.budgetMax = parseBudgetInput(nodes.budgetMax.value);
  publishWidgetState("draft_changed");
}

function closeCheckout() {
  nodes.drawerBackdrop.hidden = true;
  nodes.drawer.classList.remove("is-open");
  nodes.drawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  publishWidgetState("checkout_closed");
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

nodes.composer.addEventListener("submit", runConversationSearch);
nodes.refineButton.addEventListener("click", () => {
  nodes.refinePanel.hidden = !nodes.refinePanel.hidden;
});
nodes.applyRefinement.addEventListener("click", applyRefinement);
nodes.resetRefinement.addEventListener("click", resetRefinement);
nodes.closeDrawer.addEventListener("click", closeCheckout);
nodes.drawerBackdrop.addEventListener("click", closeCheckout);
nodes.loveColors.addEventListener("input", applyDraftState);
nodes.avoidColors.addEventListener("input", applyDraftState);
nodes.budgetMin.addEventListener("input", applyDraftState);
nodes.budgetMax.addEventListener("input", applyDraftState);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCheckout();
});
document.addEventListener("click", (event) => {
  const orderButton = event.target.closest("[data-order]");
  const offerCard = event.target.closest("[data-offer-id]");
  const occasionButton = event.target.closest("[data-occasion]");
  const relationshipButton = event.target.closest("[data-relationship]");
  const styleButton = event.target.closest("[data-style]");

  if (orderButton) openCheckout(orderButton.dataset.order);
  else if (offerCard) selectOffer(offerCard.dataset.offerId);
  if (occasionButton) {
    refinement.occasion = occasionButton.dataset.occasion;
    renderRefinement();
    publishWidgetState("refinement_changed");
  }
  if (relationshipButton) {
    refinement.relationship = relationshipButton.dataset.relationship;
    renderRefinement();
    publishWidgetState("refinement_changed");
  }
  if (styleButton) {
    refinement.style = styleButton.dataset.style;
    renderRefinement();
    publishWidgetState("refinement_changed");
  }
});

renderAll();
loadLiveOffers();
