require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const path = require('path');

const config = require('./config');
const connectDB = require('./config/database');
const { connectRedis, getRedis } = require('./config/redis');
const logger = require('./utils/logger');
const { sendError } = require('./utils/response');

// Routes
const authRoutes = require('./modules/auth/auth.routes');
const documentRoutes = require('./modules/documents/document.routes');
const departmentRoutes = require('./modules/departments/department.routes');
const docTypeRoutes = require('./modules/doctypes/doctype.routes');
const reportRoutes = require('./modules/reports/report.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const { initFileSizeLimitsFromDb } = require('./modules/documents/document.upload');

const app = express();

// ─── Compression ─────────────────────────────────────────────────────────────
app.use(compression());

// ─── Security Middleware ───────────────────────────────────────────────────────
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  })
);

app.use(
  cors({
    origin: config.cors.origin.length > 0 ? config.cors.origin : false,
    credentials: config.cors.credentials,
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders,
  })
);

// ─── Session (deferred shim — ต้อง register ก่อน routes) ───────────────────
// เหตุ: initSession() เป็น async แต่ session middleware ต้องอยู่ก่อน routes
// จึงลง shim ที่นี่ แล้วแทนที่ด้วย session จริงใน initSession()
let redisClient;
let _sessionMiddleware = (req, res, next) => next(); // no-op จนกว่า Redis พร้อม
app.use((req, res, next) => _sessionMiddleware(req, res, next));

async function initSession() {
  redisClient = await connectRedis();
  const store = new RedisStore({ client: redisClient, prefix: 'docs:sess:' });

  _sessionMiddleware = session({
    name: config.session.cookieName,
    secret: config.session.secret,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true, // nginx เสมอส่ง X-Forwarded-Proto: https + trust proxy: 1
      sameSite: 'lax',
      maxAge: config.session.maxAge,
    },
  });
}

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── NoSQL Injection Protection ──────────────────────────────────────────────
app.use(mongoSanitize());

// ─── Logger ───────────────────────────────────────────────────────────────────
if (config.env !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.info(msg.trim()) },
    })
  );
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/doctypes', docTypeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

// ─── Serve React Frontend (production) ───────────────────────────────────────
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => sendError(res, 404, 'ไม่พบ endpoint ที่ร้องขอ'));

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error(`[Unhandled] ${err.message}`, { stack: err.stack });
  sendError(res, 500, 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์');
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * เตรียม DB + Session (ใช้ใน test ด้วย)
 */
async function init() {
  await connectDB();
  await initFileSizeLimitsFromDb();
  await initSession();
}

async function start() {
  await init();
  app.listen(config.port, () => {
    logger.info(`Server started on port ${config.port} [${config.env}]`);
  });
}

// เริ่ม server เฉพาะตอน run โดยตรง (ไม่ใช่ require จาก test)
if (require.main === module) {
  start().catch((err) => {
    logger.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

module.exports = { app, init, start }; // export สำหรับ test
