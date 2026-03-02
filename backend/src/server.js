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
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);
const cookieParser = require('cookie-parser');
app.use(cookieParser());

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

///////////////////////////////////////////////////////////////////////////////////////
// SERVER STARTUP
///////////////////////////////////////////////////////////////////////////////////////
const server = app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  console.log(`API is available at http://${HOST}:${PORT}${API_PREFIX}`);
});

process.on('SIGINT', () => {
  console.log('Gracefully shutting down...');
  db.pool.end();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});