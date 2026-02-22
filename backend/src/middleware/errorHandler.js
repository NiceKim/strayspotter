/**
 * Global error handler middleware.
 * Catches errors and returns appropriate JSON response.
 */
function errorHandler(err, req, res, next) {
  console.error('Global error handler caught:', err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.expose ? err.message : 'Internal Server Error';

  res.status(statusCode).json({ message });
}

module.exports = errorHandler;
