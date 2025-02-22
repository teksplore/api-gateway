// api-gateway/index.js

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const promClient = require('prom-client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const LOG_FILE = path.join(__dirname, 'error.log');

// Prometheus Metrics Setup
const { collectDefaultMetrics } = promClient;
const register = new promClient.Registry();
collectDefaultMetrics({ register });

const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests received',
  labelNames: ['method', 'route', 'status'],
});
register.registerMetric(httpRequestCounter);

const httpErrorCounter = new promClient.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors encountered',
  labelNames: ['method', 'route', 'status'],
});
register.registerMetric(httpErrorCounter);

// Microservices Endpoints
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4000',
  tasks: process.env.TASK_SERVICE_URL || 'http://localhost:4001',
  billing: process.env.BILLING_SERVICE_URL || 'http://localhost:4002',
};

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests, please try again later.',
});
app.use(limiter);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Access Denied: No Token Provided' });

  const token = authHeader.split(' ')[1];
  return jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid Token' });
    }
    req.user = user;
    return next();
  });
};

// Request Monitoring Middleware
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
    if (res.statusCode >= 400) {
      httpErrorCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
    }
  });
  next();
});

// API Gateway Routing with Authentication
app.use('/api/auth', createProxyMiddleware({ target: SERVICES.auth, changeOrigin: true }));
app.use('/api/tasks', authenticateToken, createProxyMiddleware({ target: SERVICES.tasks, changeOrigin: true }));
app.use('/api/billing', authenticateToken, createProxyMiddleware({ target: SERVICES.billing, changeOrigin: true }));

// Prometheus Metrics Endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Error Handling Middleware
app.use((err, req, res) => {
  const errorLog = `${new Date().toISOString()} - ${err.stack}\n`;
  fs.appendFile(LOG_FILE, errorLog, (error) => {
    if (error) console.error('Error logging to file:', error);
  });
  console.error(err.stack);
  httpErrorCounter.inc({ method: req.method, route: req.path, status: res.statusCode || 500 });
  res.status(500).json({ message: 'Internal Server Error' });
});

// Example Route
app.get('/', (req, res) => {
  res.json({ message: 'API Gateway is running' });
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
});
