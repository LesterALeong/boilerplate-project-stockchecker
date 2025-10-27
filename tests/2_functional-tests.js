/*
 *
 *       Functional Tests
 *
 */

const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function () {
  suite('GET /api/stock-prices => stockData object', function () {
    test('1 stock', function (done) {
      chai
        .request(server)
        .get('/api/stock-prices')
        .query({ stock: 'goog' })
        .end(function (err, res) {
          assert.equal(res.status, 200);
          assert.property(res.body, 'stockData');
          assert.equal(res.body.stockData.stock, 'goog');
          assert.isNumber(res.body.stockData.price);
          assert.isNumber(res.body.stockData.likes);
          done();
        });
    });

    test('1 stock with like', function (done) {
      chai
        .request(server)
        .get('/api/stock-prices')
        .query({ stock: 'aapl', like: true })
        .end(function (err, res) {
          assert.equal(res.status, 200);
          assert.property(res.body, 'stockData');
          assert.equal(res.body.stockData.stock, 'aapl');
          assert.isNumber(res.body.stockData.price);
          assert.equal(res.body.stockData.likes, 1);
          done();
        });
    });

    test('1 stock with like again (ensure likes arent double counted)', function (done) {
      chai
        .request(server)
        .get('/api/stock-prices')
        .query({ stock: 'aapl', like: true })
        .end(function (err, res) {
          assert.equal(res.status, 200);
          assert.equal(res.body, 'Error: Only 1 Like per IP Allowed');
          done();
        });
    });

    test('2 stocks', function (done) {
      chai
        .request(server)
        .get('/api/stock-prices')
        .query({ stock: ['aapl', 'amzn'] })
        .end(function (err, res) {
          assert.equal(res.status, 200);
          assert.property(res.body, 'stockData');
          const stockData = res.body.stockData;
          assert.isArray(stockData);
          assert.lengthOf(stockData, 2);

          // We'll normalize by finding each symbol first
          const first = stockData[0];
          const second = stockData[1];

          // We expect aapl to have likes=1, amzn=0
          let aaplObj, amznObj;
          if (first.stock === 'aapl') {
            aaplObj = first;
            amznObj = second;
          } else {
            aaplObj = second;
            amznObj = first;
          }

          assert.equal(aaplObj.stock, 'aapl');
          assert.isNumber(aaplObj.price);
          assert.equal(aaplObj.likes, 1);
          assert.equal(aaplObj.rel_likes, 1);

          assert.equal(amznObj.stock, 'amzn');
          assert.isNumber(amznObj.price);
          assert.equal(amznObj.likes, 0);
          assert.equal(amznObj.rel_likes, -1);

          done();
        });
    });

    test('2 stocks with like', function (done) {
      chai
        .request(server)
        .get('/api/stock-prices')
        .query({ stock: ['spot', 'amzn'], like: true })
        .end(function (err, res) {
          assert.equal(res.status, 200);
          assert.property(res.body, 'stockData');
          const stockData = res.body.stockData;
          assert.isArray(stockData);
          assert.lengthOf(stockData, 2);

          // After liking both, both should have likes 1 and rel_likes 0
          const first = stockData[0];
          const second = stockData[1];

          let spotObj, amznObj;
          if (first.stock === 'spot') {
            spotObj = first;
            amznObj = second;
          } else {
            spotObj = second;
            amznObj = first;
          }

          assert.equal(spotObj.stock, 'spot');
          assert.isNumber(spotObj.price);
          assert.equal(spotObj.likes, 1);
          assert.equal(spotObj.rel_likes, 0);

          assert.equal(amznObj.stock, 'amzn');
          assert.isNumber(amznObj.price);
          // amzn was 0 likes before, now like=true in 2-stock flow increments it
          assert.equal(amznObj.likes, 1);
          assert.equal(amznObj.rel_likes, 0);

          done();
        });
    });
  });
});
