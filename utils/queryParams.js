const invalidQuery = (name, expected) => {
  const error = new Error(`Invalid "${name}" query parameter. Expected ${expected}.`);
  error.statusCode = 400;
  return error;
};

const parseIntegerParam = (value, name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min) throw invalidQuery(name, `an integer from ${min} to ${max}`);
  return Math.min(parsed, max);
};

const parseNumberParam = (value, name) => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw invalidQuery(name, 'a non-negative number');
  return parsed;
};

module.exports = { parseIntegerParam, parseNumberParam };
