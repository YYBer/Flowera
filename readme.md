# Flowera

Flowera is a prototype UI for a conversational German flower procurement agent.

This first pass focuses on the interface only:

- chat-first Skybridge-style flower search
- mock MCPD descriptor in `skybridge.mcpd.json`
- server-backed live fetch cards for 24blooms, Fleurop, Blume2000, Amazon.de, and Rewe
- card-first bouquet grid with direct merchant `Buy now` links
- maximum of six visible bouquet recommendations
- mobile carousel for bouquet selection
- progressive refinement for occasion, recipient, aesthetic, and colour
- automatic step progression after each refinement choice

Run `node server.js` and open `http://127.0.0.1:4173/`. API integration and real Skybridge deployment are intentionally left out until the merchant routes and deployment credentials are chosen.
