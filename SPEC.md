# Flowera Backend SPEC

## Purpose

Flowera is a conversational flower procurement app for German flower delivery. The backend should move the prototype from static/demo behavior toward a real data and tool-driven service that can power both the current web UI and a future Skybridge MCP/ChatGPT app.

The first backend milestone is to keep the current browser experience working while formalizing the data contract, tool boundaries, and checkout handoff needed for Skybridge.

## Current State

- `server.js` serves the static app and exposes `GET /api/offers`.
- `GET /api/offers` fetches merchant pages from REWE, Blume2000, 24blooms, Fleurop, and Amazon.de.
- Product data is parsed from HTML and JSON-LD when available.
- Delivery fees, ETA, checkout links, fit scoring, and longevity are inferred locally.
- `app.js` renders offers, refinements, source status, and a checkout handoff drawer.
- `skybridge.mcpd.json` is a placeholder descriptor and is not connected to a real Skybridge deployment.

## Product Goals

- Let a user ask for flowers in natural language and receive ranked, explainable offers.
- Support refinement by occasion, recipient relationship, style, color preferences, budget, location, address, and delivery date.
- Keep offer data structured enough for both UI rendering and AI assistant reasoning.
- Make checkout handoff explicit, auditable, and easy to replace with merchant APIs later.
- Preserve graceful degradation when live merchant pages fail or cannot be parsed.

## Non-Goals

- Do not place real orders without a user confirmation flow.
- Do not store payment details.
- Do not scrape behind authentication or bypass merchant protections.
- Do not require a full Skybridge deployment before the local backend contract is usable.

## Backend API

### `GET /api/offers`

Returns ranked flower offers from configured merchant sources.

Query parameters:

- `refresh=1`: bypasses in-memory cache.
- `flowerType`: optional requested flower type.
- `location`: optional city or region.
- `address`: optional delivery address.
- `budgetMin`: optional minimum total budget in EUR.
- `budgetMax`: optional maximum total budget in EUR.
- `deliveryDate`: optional ISO date or user-facing delivery date.
- `occasion`: optional occasion key.
- `relationship`: optional recipient relationship key.
- `loveColors`: optional comma-separated colors.
- `avoidColors`: optional comma-separated colors.
- `style`: optional visual style key.

Response shape:

```json
{
  "offers": [
    {
      "id": "blume2000-0",
      "sourceId": "blume2000",
      "merchant": "Blume2000",
      "type": "Fresh bouquet",
      "product": "Mixed bouquet",
      "image": "https://example.com/image.jpg",
      "fallbackImage": "./assets/products/spring-mix.png",
      "productUrl": "https://merchant.example/product",
      "sourceUrl": "https://merchant.example/search",
      "checkoutUrl": "https://merchant.example/cart",
      "badge": "Live from source",
      "price": 29.99,
      "delivery": 5.95,
      "arrival": "Delivery varies by address",
      "eta": "Merchant ETA",
      "score": 86,
      "longevity": 7,
      "mode": "Open Blume2000 cart",
      "api": "live page fetch",
      "fit": {
        "occasion": ["birthday"],
        "relationship": ["friend"],
        "style": ["wild"],
        "colors": ["mixed"]
      }
    }
  ],
  "sourceStatus": [
    {
      "id": "blume2000",
      "merchant": "Blume2000",
      "ok": true,
      "sourceUrl": "https://merchant.example/search",
      "checkoutUrl": "https://merchant.example/cart",
      "message": "4 offers parsed"
    }
  ],
  "fetchedAt": "2026-05-31T12:00:00.000Z",
  "cached": false
}
```

### `POST /api/checkout-intent`

Future endpoint for creating an explicit checkout handoff. The initial implementation can return a merchant URL and structured payload without placing an order.

Request shape:

```json
{
  "offerId": "blume2000-0",
  "refinement": {
    "occasion": "birthday",
    "relationship": "friend",
    "loveColors": "pink, white",
    "avoidColors": "yellow",
    "style": "soft"
  },
  "delivery": {
    "address": "Prenzlauer Allee 42, 10405 Berlin",
    "date": "2026-06-01"
  },
  "messageCard": "Happy birthday!"
}
```

Response shape:

```json
{
  "status": "handoff_ready",
  "checkoutUrl": "https://merchant.example/cart",
  "requiresUserConfirmation": true,
  "payload": {}
}
```

## Skybridge Tool Plan

### `searchFlowers`

Primary tool for assistant-driven search.

Input:

- `flowerType`
- `location`
- `address`
- `budgetMin`
- `budgetMax`
- `deliveryDate`
- `occasion`
- `relationship`
- `lovedColors`
- `avoidedColors`
- `style`

Output:

- `offers`
- `recommendedOfferId`
- `reason`
- `sourceStatus`
- `fetchedAt`

### `refineFlowerSearch`

Tool for applying incremental refinements without losing prior state.

Input:

- `currentCriteria`
- `changes`

Output:

- merged criteria
- updated offers
- explanation of changed ranking

### `prepareCheckout`

Tool for checkout handoff after the user picks an offer.

Input:

- `offerId`
- `delivery`
- `messageCard`
- `refinement`

Output:

- checkout URL
- confirmation requirements
- item summary
- handoff payload

## Widget State Contract

The Skybridge widget should expose state that the assistant can read:

```json
{
  "criteria": {
    "flowerType": "Rosen",
    "location": "Berlin",
    "address": "Prenzlauer Allee 42, 10405 Berlin",
    "budgetMin": 25,
    "budgetMax": 55,
    "deliveryDate": "2026-06-01"
  },
  "refinement": {
    "occasion": "",
    "relationship": "",
    "loveColors": "",
    "avoidColors": "",
    "style": ""
  },
  "selectedOfferId": "blume2000-0",
  "checkoutIntent": null
}
```

The local UI now publishes this state through four compatible surfaces:

- `window.FloweraWidgetState`: latest state snapshot.
- `window.FloweraWidget.getState()`: imperative getter for the host or test harness.
- `flowera:widget-state`: browser event emitted after each meaningful state change.
- `#flowera-widget-state`: JSON script element mirroring the latest snapshot.

State updates should happen when the user:

- selects or deselects an offer
- changes occasion, relationship, colors, or style
- changes min or max budget
- opens checkout handoff
- refreshes live offers

The widget also exposes host-callable helpers:

- `window.FloweraWidget.setCriteria(criteria)`
- `window.FloweraWidget.setRefinement(refinement)`
- `window.FloweraWidget.selectOffer(offerId)`
- `window.FloweraWidget.clearCheckoutIntent()`
- `window.FloweraWidget.subscribe(callback)`

## Data Source Strategy

Phase 1 keeps the current live-page fetch approach and makes the API contract explicit.

Phase 2 adds per-merchant adapters:

- `fetchReweOffers(criteria)`
- `fetchBlume2000Offers(criteria)`
- `fetchFleuropOffers(criteria)`
- `fetchAmazonOffers(criteria)`

Phase 3 replaces page parsing with official APIs or affiliate feeds where available.

Each adapter should return a normalized internal product shape:

```json
{
  "name": "Product name",
  "price": 29.99,
  "image": "https://example.com/image.jpg",
  "productUrl": "https://example.com/product",
  "availability": "unknown",
  "delivery": {
    "fee": 5.95,
    "eta": "Merchant ETA"
  }
}
```

## Error Handling

- A failed source should not fail the full response.
- Source failures must appear in `sourceStatus`.
- If no offers are parseable, the API should return `offers: []` with source messages.
- Network timeouts should be capped per source.
- Cached responses should be clearly marked with `cached: true`.

## Security And Privacy

- Keep merchant credentials and API keys in environment variables.
- Do not expose API keys to the browser.
- Treat delivery addresses as sensitive request data.
- Avoid persisting addresses until an explicit order workflow exists.
- Validate and bound user-provided query parameters before sending them to merchant APIs.

## Implementation Milestones

1. Add `SPEC.md` and align the existing backend with this contract.
2. Make `/api/offers` accept criteria query parameters instead of fixed frontend criteria only.
3. Move merchant source fetching into adapter functions.
4. Add `POST /api/checkout-intent`.
5. Update `skybridge.mcpd.json` to describe the real tools.
6. Migrate or wrap the app with a Skybridge MCP server when deployment credentials are ready.
