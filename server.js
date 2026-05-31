const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { criteriaFromSearchParams, flowerSearchTool } = require("./tools/searchFlowersTool");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;

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

    if (req.method === "GET" && url.pathname === "/api/tools") {
      return sendJSON(res, 200, { tools: [toolDescriptor(flowerSearchTool)] });
    }

    if (req.method === "GET" && url.pathname === "/api/offers") {
      const payload = await flowerSearchTool.execute(criteriaFromSearchParams(url.searchParams));
      return sendJSON(res, 200, payload);
    }

    if (req.method === "POST" && url.pathname === "/api/tools/searchFlowers") {
      const input = await readJSONBody(req);
      const payload = await flowerSearchTool.execute(input);
      return sendJSON(res, 200, payload);
    }

    if (req.method !== "GET") return sendText(res, 405, "Method not allowed");

    const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const filePath = path.normalize(path.join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) return sendText(res, 403, "Forbidden");

    const data = await readFile(filePath);
    const contentType = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") return sendText(res, 404, "Not found");
    if (error.code === "BAD_JSON") return sendJSON(res, 400, { error: "Invalid JSON body" });
    console.error(error);
    sendText(res, 500, "Server error");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Flowera server running at http://127.0.0.1:${PORT}/`);
});

function toolDescriptor(tool) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  };
}

async function readJSONBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON body");
    error.code = "BAD_JSON";
    throw error;
  }
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
