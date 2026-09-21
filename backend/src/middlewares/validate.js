function validate(schema) {
  return (req, res, next) => {
    const r = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!r.success) {
      return res.status(400).json({ error: 'Validação falhou', details: r.error.flatten() });
    }
    req.validated = r.data;
    next();
  };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const safe = { error: err.message || 'Erro interno' };
  if (process.env.NODE_ENV !== 'production') safe.stack = err.stack;
  res.status(err.status || 500).json(safe);
}

module.exports = { validate, errorHandler };
