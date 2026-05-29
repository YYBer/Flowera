const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
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

let offerCache = null;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/offers") {
      const force = url.searchParams.get("refresh") === "1";
      const payload = await getOffers(force);
      return sendJSON(res, 200, payload);
    }

    const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const filePath = path.normalize(path.join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) return sendText(res, 403, "Forbidden");

    const data = await readFile(filePath);
    const contentType = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") return sendText(res, 404, "Not found");
    console.error(error);
    sendText(res, 500, "Server error");
  }
});

server.listen(PORT, () => {
  console.log(`Flowera server running at http://127.0.0.1:${PORT}/`);
});

async function getOffers(force = false) {
  if (!force && offerCache && Date.now() - offerCache.createdAt < CACHE_TTL_MS) {
    return { ...offerCache.payload, cached: true };
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

  const payload = {
    offers: offers.sort((a, b) => a.price - b.price).slice(0, 12),
    sourceStatus,
    fetchedAt: new Date().toISOString(),
    cached: false
  };

  offerCache = { createdAt: Date.now(), payload };
  return payload;
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

function inferBaseScore(source, name, total) {
  let score = 72;
  if (isFloristNetwork(source)) score += 10;
  if (source.id === "blume2000") score += 8;
  if (source.id === "rewe") score += 4;
  if (/rose|rosen/i.test(name)) score += 6;
  if (/mix|garten|sommer|tulpen/i.test(name)) score += 5;
  if (total <= 25) score += 8;
  if (total > 55) score -= 8;
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

function sendJSON(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}
