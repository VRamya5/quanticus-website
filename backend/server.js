const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');

// Load environment variables (.env in root or backend)
const rootEnv = path.join(__dirname, '../.env');
const backendEnv = path.join(__dirname, '.env');
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else if (fs.existsSync(backendEnv)) {
  require('dotenv').config({ path: backendEnv });
} else {
  require('dotenv').config();
}

const pool = require('./src/db/pool');
const { verifyOrigin } = require('./src/middleware/auth');
const publicRoutes = require('./src/routes/publicRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// 1. Trust Proxy Configuration for Vercel + Render
const trustProxyHops = parseInt(process.env.TRUST_PROXY || '2', 10);
app.set('trust proxy', trustProxyHops);

// 2. Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: isProduction ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 3. Request Parsers with strict size limits
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// 4. State-Changing Origin / CSRF Verification
app.use(verifyOrigin);

// 5. Session Storage with connect-pg-simple & express-session
const sessionSecret = process.env.SESSION_SECRET || 'quanticus_secure_default_session_secret_2026';

app.use(
  session({
    store: new pgSession({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15 // Prune expired sessions every 15 mins
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'quanticus_sid',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    }
  })
);

// 6. Mount API Routes
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// 7. Static Assets Delivery for Local Development & Direct Mode
const frontendDir = path.join(__dirname, '../frontend');

if (fs.existsSync(frontendDir)) {
  app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(frontendDir, 'favicon.ico'));
  });

  app.use('/assets', express.static(path.join(frontendDir, 'assets')));
  app.use('/css', express.static(path.join(frontendDir, 'css')));
  app.use('/js', express.static(path.join(frontendDir, 'js')));
  app.use('/admin', express.static(path.join(frontendDir, 'admin')));

  // Direct clean URL handling for /admin and root
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(frontendDir, 'admin/index.html'));
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

// 8. 404 Handler for Unmatched Routes
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.accepts('json')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found.' });
  }
  if (fs.existsSync(path.join(frontendDir, 'index.html'))) {
    return res.status(404).sendFile(path.join(frontendDir, 'index.html'));
  }
  res.status(404).send('Not Found');
});

// 9. Global Error Handler (Never leaks stack traces or internal secrets)
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.message);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    success: false,
    error: 'An unexpected server error occurred. Please try again later.'
  });
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Quanticus server running on http://localhost:${PORT}`);
    console.log(`Admin Portal available at http://localhost:${PORT}/admin`);
  });
}

module.exports = app;
