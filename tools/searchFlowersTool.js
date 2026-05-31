const CACHE_TTL_MS = 10 * 60 * 1000;

const sources = [
  {
    id: "rewe",
    merchant: "Rewe Online-Shop",
    type: "Grocery delivery",
    sourceUrl: "https://www.rewe.de/shop/productList?search=blume",
    checkoutUrl: "https://www.rewe.de/shop/checkout/basket",
    localImage: "./assets/products/local-tulips.png",
    deliveryFee: 4.9
  },
  {
    id: "blume2000",
    merchant: "Blume2000",
    type: "Fresh bouquet",
    sourceUrl: "https://www.blume2000.de/blumen/schnittblumen",
    checkoutUrl: "https://www.blume2000.de/warenkorb",
    localImage: "./assets/products/spring-mix.png",
    deliveryFee: 5.95
  },
  {
    id: "24blooms",
    merchant: "24blooms / Fleurop",
    type: "Florist comparison",
    sourceUrl: "https://24blooms.de/",
    checkoutUrl: "https://www.fleurop.de/intermediate-step/13ec4a437c204528b714df997db123a0",
    localImage: "./assets/products/premium-roses.png",
    deliveryFee: 6.99
  },
  {
    id: "fleurop",
    merchant: "Fleurop",
    type: "Florist delivery",
    sourceUrl:
      "https://www.fleurop.de/alle-blumenstraeusse?msclkid=1461183b9570170aa9e772226163a27a&utm_source=bing&utm_medium=cpc&utm_campaign=Search%20%7C%20DE%20%7C%20Brand%20Short%20%7C%20Impr.Share%2095%25%20%5Bmax.CPC%2017%E2%82%AC%5D&utm_term=fleurop&utm_content=Fleurop%20(e)",
    checkoutUrl: "https://www.fleurop.de/intermediate-step/03fc0e0cd5574a8388481ebde20e40be",
    localImage: "./assets/products/premium-roses.png",
    deliveryFee: 6.99
  },
  {
    id: "amazon",
    merchant: "Amazon.de",
    type: "Marketplace",
    sourceUrl:
      "https://www.amazon.de/s?k=schnittblumen&__mk_de_DE=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=1LVR5UOAZ0QHT&sprefix=schnittblumen%2Caps%2C106&ref=nb_sb_noss_1",
    checkoutUrl: "https://www.amazon.de/cart/smart-wagon?newItems=1f5986c0-817d-4812-b487-71dd6fad7b36,1&ref_=sw_refresh",
    localImage: "./assets/products/white-orchid.png",
    deliveryFee: 0
  }
];

const flowerSearchTool = {
  name: "searchFlowers",
  description: "Searches German flower merchants and returns ranked, structured offers for a delivery request.",
  inputSchema: {
    type: "object",
    properties: {
      flowerType: { type: "string" },
      location: { type: "string" },
      address: { type: "string" },
      budgetMin: { type: "number" },
      budgetMax: { type: "number" },
      deliveryDate: { type: "string" },
      occasion: { type: "string" },
      relationship: { type: "string" },
      lovedColors: { type: "string" },
      avoidedColors: { type: "string" },
      style: { type: "string" },
      refresh: { type: "boolean" }
    }
  },
  execute: searchFlowers
};

const offerCache = new Map();

async function searchFlowers(input = {}) {
  const criteria = normalizeCriteria(input);
  const cacheKey = stableCriteriaKey(criteria);
  const cached = offerCache.get(cacheKey);

  if (!criteria.refresh && cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return { ...cached.payload, cached: true };
  }

  const settled = await Promise.allSettled(sources.map(fetchSource));
  const sourceStatus = [];
  const offers = [];

  settled.forEach((result, index) => {
    const source = sources[index];
    if (result.status === "fulfilled") {
      sourceStatus.push(result.value.status);
      offers.push(...result.value.offers);
    } else {
      sourceStatus.push({
        id: source.id,
        merchant: source.merchant,
        ok: false,
        sourceUrl: source.sourceUrl,
        checkoutUrl: source.checkoutUrl,
        message: result.reason?.message || "Fetch failed"
      });
    }
  });

  const rankedOffers = rankOffers(offers, criteria).slice(0, 12);
  const recommendedOffer = rankedOffers[0] || null;
  const payload = {
    tool: flowerSearchTool.name,
    criteria: publicCriteria(criteria),
    offers: rankedOffers,
    recommendedOfferId: recommendedOffer?.id || null,
    reason: recommendationReason(recommendedOffer, criteria),
    sourceStatus,
    fetchedAt: new Date().toISOString(),
    cached: false
  };

  offerCache.set(cacheKey, { createdAt: Date.now(), payload });
  return payload;
}

function normalizeCriteria(input) {
  return {
    flowerType: cleanString(input.flowerType || "Rosen"),
    location: cleanString(input.location || "Berlin"),
    address: cleanString(input.address || ""),
    budgetMin: parseOptionalNumber(input.budgetMin),
    budgetMax: parseOptionalNumber(input.budgetMax),
    deliveryDate: cleanString(input.deliveryDate || ""),
    occasion: cleanString(input.occasion || ""),
    relationship: cleanString(input.relationship || ""),
    lovedColors: cleanString(input.lovedColors || input.loveColors || ""),
    avoidedColors: cleanString(input.avoidedColors || input.avoidColors || ""),
    style: cleanString(input.style || ""),
    refresh: Boolean(input.refresh)
  };
}

function criteriaFromSearchParams(searchParams) {
  return normalizeCriteria({
    flowerType: searchParams.get("flowerType"),
    location: searchParams.get("location"),
    address: searchParams.get("address"),
    budgetMin: searchParams.get("budgetMin"),
    budgetMax: searchParams.get("budgetMax"),
    deliveryDate: searchParams.get("deliveryDate"),
    occasion: searchParams.get("occasion"),
    relationship: searchParams.get("relationship"),
    lovedColors: searchParams.get("lovedColors") || searchParams.get("loveColors"),
    avoidedColors: searchParams.get("avoidedColors") || searchParams.get("avoidColors"),
    style: searchParams.get("style"),
    refresh: searchParams.get("refresh") === "1"
  });
}

function publicCriteria(criteria) {
  const { refresh, ...rest } = criteria;
  return rest;
}

function stableCriteriaKey(criteria) {
  return JSON.stringify(publicCriteria(criteria));
}

function cleanString(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchSource(source) {
  const response = await fetch(source.sourceUrl, {
    headers: {
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.7",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) throw new Error(`${source.merchant}: HTTP ${response.status}`);

  const html = await response.text();
  const products = extractProducts(html, source);
  const offers = products.slice(0, 4).map((product, index) => normalizeOffer(product, source, index));

  return {
    status: {
      id: source.id,
      merchant: source.merchant,
      ok: offers.length > 0,
      sourceUrl: source.sourceUrl,
      checkoutUrl: source.checkoutUrl,
      message: offers.length ? `${offers.length} offers parsed` : "Fetched page, but no product cards were parseable"
    },
    offers
  };
}

function extractProducts(html, source) {
  const jsonLdProducts = extractJsonLdProducts(html, source);
  const textProducts = extractTextProducts(html, source);
  return dedupeProducts([...jsonLdProducts, ...textProducts]);
}

function extractJsonLdProducts(html, source) {
  const products = [];
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const script of scripts) {
    const raw = decodeEntities(stripHtml(script[1]).trim());
    try {
      const parsed = JSON.parse(raw);
      collectProductNodes(parsed, products, source);
    } catch {
      // Ignore invalid or escaped JSON-LD blocks.
    }
  }

  return products;
}

function collectProductNodes(node, products, source) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectProductNodes(item, products, source));
    return;
  }

  const type = Array.isArray(node["@type"]) ? node["@type"].join(" ") : node["@type"];
  if (/Product|ListItem/i.test(type || "") && (node.name || node.item?.name)) {
    const item = node.item || node;
    const price = Number(item.offers?.price || item.offers?.lowPrice || item.price || node.offers?.price);
    products.push({
      name: decodeEntities(item.name || node.name),
      price: Number.isFinite(price) ? price : null,
      image: absoluteUrl(firstValue(item.image || node.image), source.sourceUrl),
      productUrl: absoluteUrl(item.url || node.url, source.sourceUrl)
    });
  }

  Object.values(node).forEach((value) => collectProductNodes(value, products, source));
}

function extractTextProducts(html, source) {
  const products = [];
  const metaImage = extractMetaImage(html, source.sourceUrl);
  const lines = visibleTextLines(html);

  lines.forEach((line, index) => {
    const inlineMatch = line.match(/(.{4,90}?)\s+(\d{1,3}(?:[.,]\d{2}))\s*(?:€|EUR)/i);
    const priceOnlyMatch = line.match(/^(\d{1,3}(?:[.,]\d{2}))\s*(?:€|EUR)$/i);
    let name = "";
    let price = null;

    if (inlineMatch) {
      name = inlineMatch[1];
      price = parsePrice(inlineMatch[2]);
    } else if (priceOnlyMatch) {
      name = findPreviousProductLine(lines, index);
      price = parsePrice(priceOnlyMatch[1]);
    }

    if (!name || price === null) return;
    name = cleanupProductName(name);
    if (!isLikelyProduct(name)) return;

    products.push({
      name,
      price,
      image: metaImage,
      productUrl: source.sourceUrl
    });
  });

  return products;
}

function visibleTextLines(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "\n")
      .replace(/<[^>]+>/g, "\n")
  )
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function findPreviousProductLine(lines, index) {
  for (let offset = 1; offset <= 5; offset += 1) {
    const candidate = cleanupProductName(lines[index - offset] || "");
    if (isLikelyProduct(candidate)) return candidate;
  }
  return "";
}

function cleanupProductName(name) {
  return decodeEntities(name)
    .replace(/\b(neu|sale|angebot|zum shop|inkl\.? mwst\.?|ab)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[|·\-\s]+|[|·\-\s]+$/g, "")
    .trim();
}

function isLikelyProduct(name) {
  if (name.length < 4 || name.length > 90) return false;
  if (/warenkorb|newsletter|suche|filialen|kontakt|datenschutz|lieferung|versandkosten/i.test(name)) return false;
  return /blume|rose|rosen|strauß|strauss|mix|orchidee|tulpen|pfingst|freesien|eukalyptus|lilien|sommer|garten|schnitt/i.test(
    name
  );
}

function normalizeOffer(product, source, index) {
  const price = Number(product.price || 0);
  const total = price + source.deliveryFee;
  const name = product.name || source.merchant;
  return {
    id: `${source.id}-${index}`,
    sourceId: source.id,
    merchant: source.merchant,
    type: source.type,
    product: name,
    image: product.image || source.localImage,
    fallbackImage: source.localImage,
    productUrl: product.productUrl || source.sourceUrl,
    sourceUrl: source.sourceUrl,
    checkoutUrl: source.checkoutUrl,
    badge: index === 0 ? "Live from source" : "Parsed offer",
    price,
    delivery: source.deliveryFee,
    arrival: isFloristNetwork(source) ? "Today/tomorrow varies" : "Delivery varies by address",
    eta: source.id === "rewe" ? "Next slot" : source.id === "amazon" ? "Marketplace ETA" : "Merchant ETA",
    score: inferBaseScore(source, name, total),
    longevity: inferLongevity(name, source),
    mode: checkoutMode(source),
    api: "live page fetch",
    fit: inferFit(name, source)
  };
}

function rankOffers(offers, criteria) {
  const loved = normalizeTerms(criteria.lovedColors);
  const avoided = normalizeTerms(criteria.avoidedColors);

  return offers
    .map((offer) => {
      const fit = offer.fit || { occasion: [], relationship: [], style: [], colors: [] };
      const offerTotal = total(offer);
      let match = Number(offer.score || 70);

      if (criteria.flowerType && productMatchesFlowerType(offer.product, criteria.flowerType)) match += 6;
      if (criteria.occasion && fit.occasion.includes(criteria.occasion)) match += 8;
      if (criteria.relationship && fit.relationship.includes(criteria.relationship)) match += 6;
      if (criteria.style && fit.style.includes(criteria.style)) match += 10;
      if (criteria.budgetMax !== null && offerTotal <= criteria.budgetMax) match += 7;
      if (criteria.budgetMax !== null && offerTotal > criteria.budgetMax) match -= 14;
      if (criteria.budgetMin !== null && offerTotal < criteria.budgetMin) match -= 3;

      match += loved.filter((color) => fit.colors.includes(color)).length * 5;
      match -= avoided.filter((color) => fit.colors.includes(color)).length * 9;
      if (criteria.occasion === "sympathy" && fit.colors.includes("colorful")) match -= 12;
      if (criteria.relationship === "colleague" && (offer.sourceId === "24blooms" || offer.sourceId === "fleurop")) {
        match -= 5;
      }

      return {
        ...offer,
        match: Math.max(58, Math.min(99, match))
      };
    })
    .sort((a, b) => b.match - a.match || total(a) - total(b));
}

function productMatchesFlowerType(product, flowerType) {
  const productTerms = normalizeTerms(product);
  return normalizeTerms(flowerType).some((term) => productTerms.some((productTerm) => productTerm.includes(term)));
}

function normalizeTerms(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[,/ ]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function recommendationReason(offer, criteria) {
  if (!offer) return "No live offers were parsed from the configured merchant pages.";

  const parts = [`${offer.merchant} is the strongest current match`];
  if (criteria.occasion) parts.push(`for ${criteria.occasion}`);
  if (criteria.style) parts.push(`with a ${criteria.style} style`);
  if (criteria.budgetMax !== null) parts.push(`within a target budget of EUR ${criteria.budgetMax}`);
  return `${parts.join(" ")}.`;
}

function inferBaseScore(source, name, totalValue) {
  let score = 72;
  if (isFloristNetwork(source)) score += 10;
  if (source.id === "blume2000") score += 8;
  if (source.id === "rewe") score += 4;
  if (/rose|rosen/i.test(name)) score += 6;
  if (/mix|garten|sommer|tulpen/i.test(name)) score += 5;
  if (totalValue <= 25) score += 8;
  if (totalValue > 55) score -= 8;
  return Math.max(58, Math.min(94, score));
}

function inferLongevity(name, source) {
  if (/orchidee|pflanze|topf/i.test(name)) return 12;
  if (/chrysanthemen|nelken|eukalyptus/i.test(name)) return 10;
  if (/tulpen/i.test(name)) return 6;
  if (source.id === "amazon") return 10;
  return 7;
}

function inferFit(name, source) {
  const lower = name.toLowerCase();
  const colors = [];
  if (/rot|rose|rosen/.test(lower)) colors.push("red", "classic");
  if (/weiß|weiss|white/.test(lower)) colors.push("white", "neutral");
  if (/gelb|yellow|sonne|sommer/.test(lower)) colors.push("yellow");
  if (/pink|rosa|berry|pfingst/.test(lower)) colors.push("pink");
  if (/mix|garten|bunt|sommer/.test(lower)) colors.push("mixed", "colorful");
  if (/tulpen/.test(lower)) colors.push("purple", "coral", "colorful");

  return {
    occasion: isFloristNetwork(source) ? ["birthday", "anniversary"] : ["birthday", "thank-you", "just-because"],
    relationship: isFloristNetwork(source) ? ["partner", "parent"] : ["friend", "parent", "colleague"],
    style: inferStyles(lower, source),
    colors: colors.length ? colors : ["mixed"]
  };
}

function inferStyles(lower, source) {
  if (/orchidee|single|weiß|weiss/.test(lower)) return ["minimal"];
  if (/rose|rosen|eukalyptus/.test(lower)) return ["elegant", "soft"];
  if (/mix|garten|sommer|tulpen/.test(lower)) return ["wild", "bold"];
  return source.id === "rewe" ? ["bold"] : ["wild"];
}

function checkoutMode(source) {
  if (source.id === "rewe") return "Open Rewe basket";
  if (source.id === "blume2000") return "Open Blume2000 cart";
  if (isFloristNetwork(source)) return "Open Fleurop checkout";
  return "Open Amazon smart cart";
}

function isFloristNetwork(source) {
  return source.id === "24blooms" || source.id === "fleurop";
}

function total(offer) {
  return offer.price + offer.delivery;
}

function dedupeProducts(products) {
  const seen = new Set();
  return products
    .filter((product) => product.name && product.price !== null && product.price > 0)
    .filter((product) => {
      const key = `${product.name.toLowerCase()}-${product.price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function extractMetaImage(html, baseUrl) {
  const match = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  return absoluteUrl(match?.[1], baseUrl);
}

function absoluteUrl(value, baseUrl) {
  if (!value) return "";
  const first = firstValue(value);
  try {
    return new URL(first, baseUrl).href;
  } catch {
    return "";
  }
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePrice(value) {
  const normalized = String(value).replace(".", "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function stripHtml(value) {
  return String(value).replace(/<[^>]+>/g, "");
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

module.exports = {
  flowerSearchTool,
  searchFlowers,
  criteriaFromSearchParams
};
