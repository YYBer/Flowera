import * as z from "zod";
import { McpServer } from "skybridge/server";

const { searchFlowers } = require("../tools/searchFlowersTool.js") as {
  searchFlowers: (input: Record<string, unknown>) => Promise<SearchFlowersOutput>;
};

type FlowerOffer = {
  id: string;
  merchant: string;
  product: string;
  price: number;
  delivery: number;
  match?: number;
  checkoutUrl: string;
  productUrl?: string;
  sourceUrl: string;
  fit?: {
    occasion?: string[];
    relationship?: string[];
    style?: string[];
    colors?: string[];
  };
};

type SearchFlowersOutput = {
  tool: string;
  criteria: Record<string, unknown>;
  offers: FlowerOffer[];
  recommendedOfferId: string | null;
  reason: string;
  sourceStatus: Array<Record<string, unknown>>;
  fetchedAt: string;
  cached: boolean;
};

const server = new McpServer(
  {
    name: "flowera-procurement-agent",
    version: "0.1.0"
  },
  {}
);

server.registerTool(
  {
    name: "searchFlowers",
    title: "Search Flowers",
    description: "Search German flower merchants and render ranked delivery offers in Flowera.",
    inputSchema: {
      flowerType: z.string().default("Rosen"),
      location: z.string().default("Berlin"),
      address: z.string().default("Prenzlauer Allee 42, 10405 Berlin"),
      budgetMin: z.number().optional(),
      budgetMax: z.number().optional(),
      deliveryDate: z.string().default("Tomorrow"),
      occasion: z.string().optional(),
      relationship: z.string().optional(),
      lovedColors: z.string().optional(),
      avoidedColors: z.string().optional(),
      style: z.string().optional(),
      refresh: z.boolean().optional()
    },
    view: {
      component: "search-flowers" as never,
      description: "Interactive Flowera offer carousel with shared widget state.",
      prefersBorder: true
    },
    _meta: {
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Searching flower delivery offers...",
      "openai/toolInvocation/invoked": "Flower offers ready"
    }
  },
  async (input) => {
    const result = await searchFlowers(input);
    return {
      content: [
        {
          type: "text" as const,
          text: result.reason
        }
      ],
      structuredContent: result
    };
  }
);

void server.run();

export type AppServer = typeof server;
