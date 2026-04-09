require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4040,
  timezone: 'Asia/Bangkok',
  dateFormat: 'DD/MM/YYYY',
  currency: 'THB',

  mongo: {
    uri: process.env.MONGO_URI,
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  session: {
    secret: process.env.SESSION_SECRET,
    maxAge: 8 * 60 * 60 * 1000, // 8 ชั่วโมง
    cookieName: 'docs_session',
  },

  ums: {
    baseUrl: process.env.UMS_BASE_URL || 'https://nssv.nsm.go.th/ums',
    loginPath: process.env.UMS_LOGIN_PATH || '/login',
    projectId: process.env.UMS_PROJECT_ID || '69cfa30f156114bd2461271b',
    callbackUrl: process.env.APP_CALLBACK_URL || 'https://app.nsm.go.th/docs/api/auth/callback',
    meEndpoint: '/api/auth/me',
  },

  cors: {
    origin: (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },

  storage: {
    basePath: process.env.DOC_STORAGE_PATH || '/data/archives/uploads',
    downloadPath: process.env.DOC_DOWNLOAD_PATH || '/data/archives/documents/download',
    maxDocSizeMB: parseInt(process.env.MAX_DOC_SIZE_MB, 10) || 50,
    maxImgSizeMB: parseInt(process.env.MAX_IMG_SIZE_MB, 10) || 3,
    maxImagesPerDoc: parseInt(process.env.MAX_IMAGES_PER_DOC, 10) || 4,
    allowedDocMimes: [
      'application/pdf',
    ],
    // DOW: รองรับ PDF + Word + Excel
    allowedDowMimes: [
      'application/pdf',
      'application/msword',                                                             // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',       // .docx
      'application/vnd.ms-excel',                                                      // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',             // .xlsx
    ],
    allowedImgMimes: ['image/jpeg', 'image/png', 'image/webp'],
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 300,
    authWindowMs: 15 * 60 * 1000,
    authMax: 20,
  },
};

module.exports = config;
