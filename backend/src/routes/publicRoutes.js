const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { handleResumeUpload } = require('../middleware/upload');
const { contactFormLimiter, applicationFormLimiter } = require('../middleware/rateLimiter');
const { checkHoneypot } = require('../middleware/auth');
const { isValidEmail, sanitizeText, isValidPhone } = require('../utils/validators');
const { generateUniqueRefCode } = require('../utils/refCode');

// GET /api/health - Lightweight health check for Render
router.get('/health', (req, res) => {
  res.json({ ok: true });
});

// GET /api/roles - Public list of all roles
router.get('/roles', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, ref_code, title, department, description, tag, status, created_at 
       FROM roles 
       ORDER BY id ASC;`
    );
    res.json({
      success: true,
      roles: result.rows
    });
  } catch (err) {
    console.error('Error fetching roles:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve career opportunities.'
    });
  }
});

// GET /api/directors - Public list of visible directors (NEVER selects BYTEA photo_data)
router.get('/directors', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, role, (photo_data IS NOT NULL) AS has_photo, photo_updated_at, updated_at 
       FROM directors 
       WHERE is_visible = true 
       ORDER BY sort_order ASC, id ASC;`
    );
    const directors = result.rows.map((row) => {
      const v = row.photo_updated_at 
        ? new Date(row.photo_updated_at).getTime() 
        : (row.updated_at ? new Date(row.updated_at).getTime() : Date.now());
      return {
        id: row.id,
        name: row.name,
        role: row.role,
        photo_url: row.has_photo ? `/api/directors/${row.id}/photo?v=${v}` : null
      };
    });
    res.json({
      success: true,
      directors
    });
  } catch (err) {
    console.error('Error fetching public directors:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve directors list.'
    });
  }
});

// GET /api/directors/:id/photo - Public director photo endpoint with caching & ETag
router.get('/directors/:id/photo', async (req, res) => {
  try {
    const isNumeric = /^\d+$/.test(req.params.id);
    const query = isNumeric
      ? 'SELECT id, is_visible, photo_data, photo_mime, photo_updated_at FROM directors WHERE id = $1;'
      : 'SELECT id, is_visible, photo_data, photo_mime, photo_updated_at FROM directors WHERE ref_code = $1;';
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const result = await pool.query(query, [param]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Director not found.' });
    }

    const director = result.rows[0];

    // Hidden directors return 404 on the public route unless requested by authenticated admin
    const isAdmin = Boolean(req.session && req.session.adminId);
    if (!director.is_visible && !isAdmin) {
      return res.status(404).json({ success: false, error: 'Photo not found or inaccessible.' });
    }

    if (!director.photo_data) {
      return res.status(404).json({ success: false, error: 'No photo available for this director.' });
    }

    const lastModifiedTime = director.photo_updated_at ? new Date(director.photo_updated_at).getTime() : 0;
    const etag = `W/"dir-photo-${director.id}-${lastModifiedTime}"`;

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.setHeader('Content-Type', director.photo_mime || 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('ETag', etag);
    return res.send(director.photo_data);
  } catch (err) {
    console.error('Error serving director photo:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load director photo.' });
  }
});

// POST /api/contact - Public contact form submission
router.post('/contact', contactFormLimiter, checkHoneypot, async (req, res) => {
  try {
    const fullName = sanitizeText(req.body.fullName || req.body.full_name || req.body.name);
    const email = sanitizeText(req.body.email);
    const requirementArea = sanitizeText(req.body.requirementArea || req.body.requirement_area || req.body.requirement);
    const message = sanitizeText(req.body.message);

    // Validation
    if (!fullName || fullName.length < 2 || fullName.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Please provide your full name (2 to 255 characters).'
      });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.'
      });
    }

    if (!requirementArea || requirementArea.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Please select a valid requirement area.'
      });
    }

    if (!message || message.length < 5 || message.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a message between 5 and 5,000 characters.'
      });
    }

    const refCode = await generateUniqueRefCode(pool, 'client_requests', 'REQ');

    const query = `
      INSERT INTO client_requests (ref_code, full_name, email, requirement_area, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, ref_code, created_at;
    `;
    const result = await pool.query(query, [refCode, fullName, email, requirementArea, message]);

    return res.status(201).json({
      success: true,
      message: 'Thank you for reaching out! We will connect with you shortly.',
      id: result.rows[0].id,
      ref_code: result.rows[0].ref_code
    });
  } catch (err) {
    console.error('Error saving contact request:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Unable to save your message. Please try again or email us directly.'
    });
  }
});

// POST /api/applications - Public job application submission (In-Database Resume Storage)
router.post('/applications', applicationFormLimiter, handleResumeUpload, checkHoneypot, async (req, res) => {
  try {
    const fullName = sanitizeText(req.body.fullName || req.body.full_name || req.body.name);
    const email = sanitizeText(req.body.email);
    const phone = sanitizeText(req.body.phone);
    const coverMessage = sanitizeText(req.body.coverMessage || req.body.cover_message || req.body.message);
    const roleIdInput = req.body.roleId || req.body.role_id;
    const roleTitleInput = sanitizeText(req.body.roleTitle || req.body.role_title || req.body.role);

    // 1. Validate fields
    if (!fullName || fullName.length < 2 || fullName.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Please provide your full name (2 to 255 characters).'
      });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.'
      });
    }

    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid phone number (5 to 50 digits/characters).'
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        error: 'Resume is required. Please upload a PDF, DOC, or DOCX file (max 4MB).'
      });
    }

    // 2. Verify Role exists AND is currently open
    let roleRow = null;
    if (roleIdInput && !isNaN(parseInt(roleIdInput, 10))) {
      const roleRes = await pool.query('SELECT id, title, status FROM roles WHERE id = $1;', [parseInt(roleIdInput, 10)]);
      if (roleRes.rows.length > 0) {
        roleRow = roleRes.rows[0];
      }
    }

    if (!roleRow && roleTitleInput) {
      const roleRes = await pool.query('SELECT id, title, status FROM roles WHERE LOWER(title) = LOWER($1);', [roleTitleInput]);
      if (roleRes.rows.length > 0) {
        roleRow = roleRes.rows[0];
      }
    }

    if (!roleRow) {
      return res.status(400).json({
        success: false,
        error: 'The selected role could not be found.'
      });
    }

    if (roleRow.status !== 'open') {
      return res.status(400).json({
        success: false,
        error: 'This role is currently closed and not accepting applications.'
      });
    }

    // 3. Generate unique ref_code
    const refCode = await generateUniqueRefCode(pool, 'applications', 'APP');

    // 4. Save application directly to DB BYTEA (no disk write)
    const insertQuery = `
      INSERT INTO applications (
        ref_code, role_id, role_title, full_name, email, phone, 
        cover_message, resume_original_name, resume_data, resume_mime, resume_size
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, ref_code, created_at;
    `;

    const result = await pool.query(insertQuery, [
      refCode,
      roleRow.id,
      roleRow.title,
      fullName,
      email,
      phone,
      coverMessage || null,
      req.file.originalname,
      req.file.buffer,
      req.file.mimetype || 'application/pdf',
      req.file.size
    ]);

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully! Our team will review your profile.',
      id: result.rows[0].id,
      ref_code: result.rows[0].ref_code
    });
  } catch (err) {
    console.error('Error saving job application:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Unable to submit your application. Please try again.'
    });
  }
});

module.exports = router;
