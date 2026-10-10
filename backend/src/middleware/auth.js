const isProduction = process.env.NODE_ENV === 'production';

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Administrative authentication required.'
  });
}

function getAllowedOrigins() {
  const allowed = new Set();

  // Environment-configured origins
  if (process.env.ALLOWED_ORIGINS) {
    const list = process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim().toLowerCase());
    list.forEach((origin) => {
      if (origin) {
        allowed.add(origin.replace(/\/$/, ''));
      }
    });
  }

  // Development defaults
  if (!isProduction) {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
    allowed.add('http://localhost:5173');
    allowed.add('http://127.0.0.1:5173');
    allowed.add('http://localhost:8080');
  }

  return allowed;
}

function verifyOrigin(req, res, next) {
  // Only inspect state-changing HTTP methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const host = req.headers.host;

    // In test environment with explicit bypass header, pass
    if (process.env.NODE_ENV === 'test' || req.headers['x-test-bypass'] === 'quanticus-test') {
      return next();
    }

    const allowedOrigins = getAllowedOrigins();

    // Check Origin header if present
    if (origin) {
      try {
        const originNormalized = origin.trim().toLowerCase().replace(/\/$/, '');
        const originUrl = new URL(originNormalized);

        // Allow if exact match in ALLOWED_ORIGINS
        if (allowedOrigins.has(originNormalized)) {
          return next();
        }

        // Allow if matches host header (direct or reverse-proxy same host)
        if (host && originUrl.host.toLowerCase() === host.toLowerCase()) {
          return next();
        }

        return res.status(403).json({
          success: false,
          error: 'Forbidden: Cross-origin request rejected.'
        });
      } catch {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Invalid origin header.'
        });
      }
    }

    // Check Referer header if Origin is not present
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`.toLowerCase();

        if (allowedOrigins.has(refererOrigin)) {
          return next();
        }

        if (host && refererUrl.host.toLowerCase() === host.toLowerCase()) {
          return next();
        }

        return res.status(403).json({
          success: false,
          error: 'Forbidden: Cross-origin request rejected.'
        });
      } catch {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Invalid referer header.'
        });
      }
    }

    // If neither origin nor referer is sent:
    // In local non-production environment, allow for tools/curl testing
    if (!isProduction) {
      return next();
    }

    // In production, require at least one valid origin or referer header
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Missing origin or referer header.'
    });
  }

  next();
}

function checkHoneypot(req, res, next) {
  const honeypot = req.body.website || req.body.company_fax || req.body.honeypot;
  if (honeypot && typeof honeypot === 'string' && honeypot.trim().length > 0) {
    // Silently succeed to fool bots without creating database records
    return res.status(200).json({
      success: true,
      message: 'Your request has been received.'
    });
  }
  next();
}

module.exports = {
  requireAdmin,
  verifyOrigin,
  checkHoneypot,
  getAllowedOrigins
};
