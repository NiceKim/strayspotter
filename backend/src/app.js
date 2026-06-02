require('dotenv').config();

const Sentry = require("@sentry/node");
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
});

const path = require('path');
const express = require('express');
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const cookieParser = require('cookie-parser');
app.use(cookieParser());
const { generalLimiter } = require('./middleware/rateLimiters');
app.use(generalLimiter);
app.set('trust proxy', 1);

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const API_PREFIX = '/api';
const apiRoutes = require('./routes');
app.use(API_PREFIX, apiRoutes);
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const errorHandler = require('./middleware/errorHandler');
Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

module.exports = app;
