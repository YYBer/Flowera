# Flowera

Flowera is a prototype UI and local backend for a conversational German flower procurement agent. It helps a user describe a flower delivery need, refine the occasion and recipient context, compare live merchant offers, and hand off to the selected merchant checkout.

The current build is a local-first prototype: it serves the browser UI, fetches public merchant pages, parses offer data when available, ranks the results, and exposes a Skybridge-style tool endpoint for future agent integration.

## What It Does

- Chat-first flower search for German delivery use cases.
- Progressive refinement for occasion, recipient, aesthetic, loved colors, avoided colors, and palette.
- Live offer fetching from REWE, Blume2000, 24blooms, Fleurop, and Amazon.de.
- Ranked bouquet cards with price, delivery estimate, merchant status, fit explanation, and checkout handoff link.
- Maximum of six visible recommendations in the UI, with more ranked offers retained in the API response.
- Mobile-friendly bouquet selection carousel.
- Browser widget state published through `window.FloweraWidgetState`, the `flowera:widget-state` event, `#flowera-widget-state`, and `postMessage`.
- Mock Skybridge MCPD descriptor in `skybridge.mcpd.json`.

## Run Locally

Install dependencies if needed:

```bash
npm install
```

Start the local server:

```bash
npm run start:local
```

Open:

```text
http://127.0.0.1:4173/
```

The server defaults to port `4173`. To use another port:

```bash
PORT=5000 npm run start:local
```

## Scripts

```bash
npm run start:local   # Run the local Node server
npm run dev           # Run Skybridge dev tooling
npm run start         # Run Skybridge start
npm run build         # Run Skybridge build
npm run deploy        # Deploy with Alpic using Node 24 runtime
```

## Local API

### `GET /api/offers`

Fetches and ranks flower offers for the UI.

Supported query parameters:

- `flowerType`
- `location`
- `address`
- `budgetMin`
- `budgetMax`
- `deliveryDate`
- `occasion`
- `relationship`
- `lovedColors` or `loveColors`
- `avoidedColors` or `avoidColors`
- `style`
- `refresh=1` to bypass the in-memory cache

Example:

```bash
curl "http://127.0.0.1:4173/api/offers?flowerType=Rosen&location=Berlin&budgetMax=55&occasion=anniversary&lovedColors=red,pink"
```

### `GET /api/tools`

Returns the available tool descriptors.

```bash
curl "http://127.0.0.1:4173/api/tools"
```

### `POST /api/tools/searchFlowers`

Skybridge-style tool endpoint for structured flower search.

Example:

```bash
curl -X POST "http://127.0.0.1:4173/api/tools/searchFlowers" \
  -H "Content-Type: application/json" \
  -d '{
    "flowerType": "Rosen",
    "location": "Berlin",
    "address": "Prenzlauer Allee 42, 10405 Berlin",
    "budgetMin": 25,
    "budgetMax": 55,
    "deliveryDate": "Tomorrow",
    "occasion": "anniversary",
    "relationship": "partner",
    "lovedColors": "red,pink",
    "style": "soft"
  }'
```

The response includes:

- `criteria`: normalized search criteria.
- `offers`: ranked merchant offers.
- `recommendedOfferId`: the current best match.
- `reason`: explanation for the recommendation.
- `sourceStatus`: fetch and parse status for each merchant.
- `fetchedAt`: ISO timestamp.
- `cached`: whether the response came from the in-memory cache.

## Project Structure

```text
.
├── app.js                    # Browser UI state, rendering, refinement, checkout handoff
├── assets/                   # Local fallback product imagery
├── index.html                # Main UI shell
├── server.js                 # Static server and local API routes
├── skybridge.mcpd.json       # Prototype Skybridge descriptor
├── styles.css                # UI styling
└── tools/searchFlowersTool.js # Merchant fetch, parsing, ranking, and tool schema
```

## Current Constraints

- Merchant pages are fetched from public HTML and JSON-LD, so parsing quality depends on each merchant page structure.
- Checkout is a handoff to merchant URLs; Flowera does not place orders.
- Payment details are not collected or stored.
- The Skybridge descriptor is still a prototype descriptor, not a production deployment configuration.
- Offer data is cached in memory for 10 minutes per normalized criteria set.

## Deployment Notes

The package includes Skybridge and Alpic scripts, but real deployment still depends on the final merchant routes, deployment credentials, and production tool hosting choices.
