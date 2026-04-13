const mongoose = require('mongoose');

const requireObjectIdParams = (paramNames = []) => (req, res, next) => {
  for (const name of paramNames) {
    const value = req.params[name];
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({ message: `Invalid parameter: ${name}` });
    }
  }
  return next();
};

const validatePaginationQuery = (req, res, next) => {
  const { offset, limit } = req.query;
  if (offset !== undefined && Number.isNaN(Number(offset))) {
    return res.status(400).json({ message: 'Invalid query: offset must be numeric' });
  }
  if (limit !== undefined && Number.isNaN(Number(limit))) {
    return res.status(400).json({ message: 'Invalid query: limit must be numeric' });
  }
  return next();
};

module.exports = { requireObjectIdParams, validatePaginationQuery };
