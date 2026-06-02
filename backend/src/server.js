const app = require('./app');
const db = require('./db');

const HOST = process.env.APP_HOST;
const PORT = process.env.APP_PORT;

const server = app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  console.log(`API is available at http://${HOST}:${PORT}/api`);
});

let isShuttingDown = false;
let forceShutdownTimer = null;

const shutdown = () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('Gracefully shutting down...');

  server.close(() => {
    if (forceShutdownTimer) clearTimeout(forceShutdownTimer);

    db.pool
      .end()
      .then(() => {
        console.log('Server closed');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error while closing DB pool:', err);
        process.exit(1);
      });
  });

  forceShutdownTimer = setTimeout(() => {
    console.error('Forcing shutdown...');
    process.exit(1);
  }, 10000);
  if (typeof forceShutdownTimer.unref === 'function') {
    forceShutdownTimer.unref();
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
