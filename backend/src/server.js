///////////////////////////////////////////////////////////////////////////////////////
// APP CONFIGURATION
///////////////////////////////////////////////////////////////////////////////////////
// Express setup
const express = require('express');
const app = express();
require('dotenv').config();
const HOST = process.env.APP_HOST;
const PORT = process.env.APP_PORT;
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const cookieParser = require('cookie-parser');
app.use(cookieParser());
const { generalLimiter } = require('./middleware/rateLimiters');
app.use(generalLimiter);
app.set('trust proxy', 1);
const db = require('./db');

// API documentation setup
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API routes
const API_PREFIX = '/api';
const apiRoutes = require('./routes');
app.use(API_PREFIX, apiRoutes);
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

///////////////////////////////////////////////////////////////////////////////////////
// SERVER STARTUP
///////////////////////////////////////////////////////////////////////////////////////
const server = app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  console.log(`API is available at http://${HOST}:${PORT}${API_PREFIX}`);
});

let isShuttingDown = false;
let forceShutdownTimer = null;

const shutdown = () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('Gracefully shutting down...');

  // Stop accepting new connections first.
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

  // If something hangs (e.g., active connections/queries), force exit.
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