"use strict";

const crypto = require("crypto");

// ---- In-memory "DB" ----
// Map<symbolLowercase, { name: string, likes: number, ips: Set<string> }>
const stockStore = new Map();

function getHashedIP(ip) {
  // anonymize IP so we’re not storing raw personal data
  return crypto.createHash("sha256").update(ip).digest("hex");
}

// Ensure a stock record exists; return it
function ensureStock(symbol) {
  const key = symbol.toLowerCase();
  if (!stockStore.has(key)) {
    stockStore.set(key, {
      name: key,
      likes: 0,
      ips: new Set(),
    });
  }
  return stockStore.get(key);
}

module.exports = function (app) {
  app.route("/api/stock-prices").get(async function (req, res) {
    let responseObject = { stockData: {} };
    let twoStocks = false;
    let stocksAccum = [];

    // ---- Output final response ----
    function outputResponse() {
      return res.json(responseObject);
    }

    // ---- Fetch price from FCC proxy and attach to localStock ----
    async function getPrice(localStock) {
      const requestUrl =
        "https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/" +
        localStock.name +
        "/quote";

      try {
        const r = await fetch(requestUrl);
        const data = await r.json();

        const latestPrice = data.latestPrice;
        localStock.price =
          typeof latestPrice === "number"
            ? Number(latestPrice.toFixed(2))
            : null;
      } catch (e) {
        // network/proxy fail fallback
        localStock.price = null;
      }

      return localStock;
    }

    // ---- After getPrice, decide to build 1-stock or 2-stock response ----
    function processOneStock(stockDoc) {
      responseObject.stockData.stock = stockDoc.name;
      responseObject.stockData.price = stockDoc.price;
      responseObject.stockData.likes = stockDoc.likes;
      outputResponse();
    }

    function processTwoStocks(stockDoc) {
      const entry = {
        stock: stockDoc.name,
        price: stockDoc.price,
        likes: stockDoc.likes,
      };
      stocksAccum.push(entry);

      if (stocksAccum.length === 2) {
        const diff = stocksAccum[0].likes - stocksAccum[1].likes;
        const diff2 = -diff;

        stocksAccum[0].rel_likes = diff;
        stocksAccum[1].rel_likes = diff2;

        responseObject.stockData = stocksAccum;
        outputResponse();
      }
    }

    // ---- Like logic for single-stock request ----
    // If IP already liked, immediately respond with error string like FCC wants.
    function likeSingleStockOrError(symbol) {
      const hashedIP = getHashedIP(req.ip || "0.0.0.0");
      const record = ensureStock(symbol);

      if (record.ips.has(hashedIP)) {
        // Important: return true to indicate we already responded
        res.json("Error: Only 1 Like per IP Allowed");
        return true;
      }

      record.likes += 1;
      record.ips.add(hashedIP);
      return false;
    }

    // ---- Like logic for two-stock request ----
    // FCC test for 2-stock+like assumes we *don't* throw the duplicate-like error.
    function likeTwoStockNoError(symbol) {
      const hashedIP = getHashedIP(req.ip || "0.0.0.0");
      const record = ensureStock(symbol);
      if (!record.ips.has(hashedIP)) {
        record.likes += 1;
        record.ips.add(hashedIP);
      }
    }

    // ---- Pipeline for handling ONE stock symbol ----
    async function handleSingleStock(symbol, likeFlag) {
      if (likeFlag) {
        const earlyReturned = likeSingleStockOrError(symbol);
        if (earlyReturned) {
          return; // we already sent the error response
        }
      }

      const rec = ensureStock(symbol);
      await getPrice(rec);
      processOneStock(rec);
    }

    // ---- Pipeline for handling TWO stocks ----
    async function handleTwoStocks(symbols, likeFlag) {
      twoStocks = true;

      // if likeFlag, like BOTH w/out duplicate-like error
      if (likeFlag) {
        likeTwoStockNoError(symbols[0]);
        likeTwoStockNoError(symbols[1]);
      } else {
        ensureStock(symbols[0]);
        ensureStock(symbols[1]);
      }

      // Fetch both prices "in parallel"
      const recA = ensureStock(symbols[0]);
      const recB = ensureStock(symbols[1]);

      const [pricedA, pricedB] = await Promise.all([
        getPrice(recA),
        getPrice(recB),
      ]);

      // Now build 2-stock response. Each call pushes one.
      processTwoStocks(pricedA);
      processTwoStocks(pricedB);
    }

    // ---- INPUT DISPATCH ----
    const q = req.query.stock;
    const likeFlag = req.query.like === true || req.query.like === "true";

    if (typeof q === "string") {
      await handleSingleStock(q, likeFlag);
    } else if (Array.isArray(q) && q.length === 2) {
      await handleTwoStocks(q, likeFlag);
    } else {
      return res
        .status(400)
        .json({ error: "Please supply stock or [stock,stock]" });
    }
  });
};
