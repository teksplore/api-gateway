const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const {createProxyMiddleware} = require("http-proxy-middleware");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Microservices Endpoints
const SERVICES = {
    auth: process.env.AUTH_SERVICE_URL || "http://localhost:4000",
    tasks: process.env.TASK_SERVICE_URL || "http://localhost:4001",
    billing: process.env.BILLING_SERVICE_URL || "http://localhost:4002"
};

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// Rate limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: "Too many requests, please try again later"
});
app.use(limiter)

// Authentication middleware
const authenticationToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ message: "Access Denied: No token provided" });
    
    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
    if(err) return res.status(403).json({ message: "Invalid Token "});
    req.user = user;
    next();
    });
};


// API Gateway Routing
app.use("/api/auth", createProxyMiddleware({ target: SERVICES.auth, changeOrigin: true }));
app.use("/api/taska", createProxyMiddleware({ target: SERVICES.tasks, changeOrigin: true }));
app.use("/api/billing", createProxyMiddleware({ target: SERVICES.billing, changeOrigin: true }));

// Example route
app.get("/", (req, res) => {
    res.json({message: "API gateway is running"})
});

// Health check
app.get("/health", (req, res) => {
    res.status(200).json({status: "healthy"})
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 API gateway is running on port ${PORT}`)
})