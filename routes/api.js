'use strict';

const crypto = require('crypto');
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

// ---- In-memory "DB" ----
// Structure:
// {
//   aapl: { name: 'aapl', likes: 3, ips: Set(['hash1','hash2']) },
//   msft: { name: 'msft', likes: 0, ips: Set() }
// }
const stockStore = new Map();

function getHashedIP(ip) {
  // anonymize IP so we’re not storing raw personal data
  return crypto.createHash('sha256').update(ip).digest('hex');
}

// Ensure a stock record exists; return it
function ensureStock(symbol) {
  const key = symbol.toLowerCase();
  if (!stockStore.has(key)) {
    stockStore.set(key, {
      name: key,
      likes: 0,
      ips: new Set()
    });
  }
  return stockStore.get(key);
}

module.exports = function (app) {
  app.route('/api/stock-prices').get(function (req, res) {
    let responseObject = { stockData: {} };
    let twoStocks = false; // tracks 1 vs 2 stock flow
    let stocksAccum = [];  // used in 2-stock mode

    // ---- Output final response ----
    function outputResponse() {
      return res.json(responseObject);
    }

    // ---- Fetch price from FCC proxy and attach to localStock, then continue ----
    function getPrice(localStock, nextStep) {
      const xhr = new XMLHttpRequest();
      const requestUrl =
        'https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/' +
        localStock.name +
        '/quote';

      xhr.open('GET', requestUrl, true);
      xhr.onload = () => {
        let apiResponse;
        try {
          apiResponse = JSON.parse(xhr.responseText);
        } catch (e) {
          // If proxy gives nonsense, default price to null to avoid crash
          localStock.price = null;
          return nextStep(localStock, finalizeStepFor(localStock));
        }

        // latestPrice should be a number. We'll keep it as Number.
        const latestPrice = apiResponse.latestPrice;
        // Guard: make sure it's numeric
        localStock.price =
          typeof latestPrice === 'number'
            ? Number(latestPrice.toFixed(2))
            : null;

        nextStep(localStock, finalizeStepFor(localStock));
      };
      xhr.onerror = () => {
        // network or proxy failure
        localStock.price = null;
        nextStep(localStock, finalizeStepFor(localStock));
      };
      xhr.send();
    }

    // ---- After getPrice, where do we go? ----
    function finalizeStepFor(localStock) {
      return twoStocks ? processTwoStocks : processOneStock;
    }

    // ---- Handle like logic for ONE stock symbol ----
    // This mirrors the FCC logic:
    // - If IP already liked -> send error json string
    // - Else increment likes and record IP, then proceed
    function likeStock(symbol, onDone) {
      const hashedIP = getHashedIP(req.ip || '0.0.0.0');
      const record = ensureStock(symbol);

      if (record.ips.has(hashedIP)) {
        // FCC walkthrough returns a string message in res.json(...) for dup like
        return res.json('Error: Only 1 Like per IP Allowed');
      }

      record.likes += 1;
      record.ips.add(hashedIP);

      // after liking, we continue the flow by fetching price etc.
      onDone(symbol);
    }

    // ---- Find or update stock (simulate DB findOneAndUpdate)
    // documentUpdate is ignored in our memory version except for likes/IP, which we already applied.
    // After "finding", call nextStep(stockRecord, nextStepAfterThat)
    function findOrUpdateStock(symbol, _documentUpdate, nextStep) {
      const record = ensureStock(symbol);
      nextStep(record, finalizeStepFor(record));
    }

    // ---- Response builder for 1-stock case ----
    function processOneStock(stockDoc, nextStep) {
      responseObject.stockData.stock = stockDoc.name;
      responseObject.stockData.price = stockDoc.price;
      responseObject.stockData.likes = stockDoc.likes;
      nextStep();
    }

    // ---- Response builder for 2-stock case ----
    function processTwoStocks(stockDoc, nextStep) {
      const entry = {
        stock: stockDoc.name,
        price: stockDoc.price,
        likes: stockDoc.likes
      };
      stocksAccum.push(entry);

      if (stocksAccum.length === 2) {
        // compute rel_likes
        const diff =
          stocksAccum[0].likes - stocksAccum[1].likes;
        const diff2 = -diff;

        stocksAccum[0].rel_likes = diff;
        stocksAccum[1].rel_likes = diff2;

        responseObject.stockData = stocksAccum;
        nextStep();
      } else {
        // wait for the other stock to finish
        return;
      }
    }

    // ---- Helper to drive one stock through pipeline ----
    function handleSingleStock(symbol, likeFlag) {
      // If like=true, we must try likeStock first.
      if (likeFlag) {
        likeStock(symbol, function afterLike() {
          // after liking, simulate DB update, then get price
          findOrUpdateStock(
            symbol,
            {},
            function afterFind(record) {
              getPrice(record, function afterPrice(rec, builder) {
                builder(rec, outputResponse);
              });
            }
          );
        });
      } else {
        // no like: just ensure record, then get price
        findOrUpdateStock(
          symbol,
          {},
          function afterFind(record) {
            getPrice(record, function afterPrice(rec, builder) {
              builder(rec, outputResponse);
            });
          }
        );
      }
    }

    // ---- Helper to drive two stocks through pipeline ----
    // We basically run both in parallel-ish. Each completion pushes to stocksAccum.
    function handleTwoStocks(symbols, likeFlag) {
      twoStocks = true;

      function runForSymbol(sym) {
        if (likeFlag) {
          // "Like both" behavior:
          // difference from 1-stock:
          // FCC 2-stock test never triggers the duplicate-like error path.
          // We'll apply same logic as single like, but if already liked,
          // we will NOT early-return error because that would kill both.
          const hashedIP = getHashedIP(req.ip || '0.0.0.0');
          const rec = ensureStock(sym);
          if (!rec.ips.has(hashedIP)) {
            rec.likes += 1;
            rec.ips.add(hashedIP);
          }
        }

        // After (maybe) liking, continue:
        findOrUpdateStock(
          sym,
          {},
          function afterFind(record) {
            getPrice(record, function afterPrice(rec, builder) {
              builder(rec, outputResponse);
            });
          }
        );
      }

      runForSymbol(symbols[0]);
      runForSymbol(symbols[1]);
    }

    // ---- INPUT DISPATCH ----
    const q = req.query.stock;
    const likeFlag =
      req.query.like === true ||
      req.query.like === 'true';

    if (typeof q === 'string') {
      // single stock
      handleSingleStock(q, likeFlag);
    } else if (Array.isArray(q) && q.length === 2) {
      // two stocks
      handleTwoStocks(q, likeFlag);
    } else {
      // bad input
      return res
        .status(400)
        .json({ error: 'Please supply stock or [stock,stock]' });
    }
  });
};
