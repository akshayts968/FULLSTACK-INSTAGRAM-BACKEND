const test = require('node:test');
const assert = require('node:assert/strict');
const { requireObjectIdParams, validatePaginationQuery } = require('../middlewares/apiGuards');

const makeRes = () => {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

test('requireObjectIdParams rejects malformed id', () => {
  const req = { params: { userId: 'bad-id' } };
  const res = makeRes();
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  requireObjectIdParams(['userId'])(req, res, next);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
});

test('validatePaginationQuery rejects malformed limit', () => {
  const req = { query: { offset: '0', limit: 'abc' } };
  const res = makeRes();
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  validatePaginationQuery(req, res, next);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
});

test('validatePaginationQuery accepts numeric values', () => {
  const req = { query: { offset: '10', limit: '5' } };
  const res = makeRes();
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  validatePaginationQuery(req, res, next);
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});
