const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const { handleDirectorPhotoUpload, processDirectorPhotoToBuffer } = require('../middleware/upload');
const { sanitizeText } = require('../utils/validators');
const { generateUniqueRefCode } = require('../utils/refCode');

// Helper to escape CSV cell contents & protect against CSV formula injection
function formatCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Protect against CSV formula injection: prepend single quote if starts with =, +, -, @, Tab, CR
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

// =========================================================================
// 1. AUTHENTICATION ENDPOINTS (Mounted at /api/admin/*)
// =========================================================================

// POST /api/admin/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const email = sanitizeText(req.body.email).toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both email and password.'
      });
    }

    const result = await pool.query('SELECT id, email, password_hash FROM admins WHERE email = $1;', [email]);

    // Generic error message for security
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const admin = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // Save admin details in session
    req.session.adminId = admin.id;
    req.session.adminEmail = admin.email;

    return res.json({
      success: true,
      message: 'Login successful',
      admin: {
        id: admin.id,
        email: admin.email
      }
    });
  } catch (err) {
    console.error('Error during admin login:', err.message);
    return res.status(500).json({
      success: false,
      error: 'An unexpected authentication error occurred.'
    });
  }
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error during logout:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to log out.' });
    }
    res.clearCookie('quanticus_sid');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
});

// GET /api/admin/me
router.get('/me', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.json({
      authenticated: true,
      admin: {
        id: req.session.adminId,
        email: req.session.adminEmail
      }
    });
  }
  return res.status(401).json({ authenticated: false, error: 'Not authenticated.' });
});

// All subsequent /api/admin/* endpoints require admin authentication
router.use(requireAdmin);

// =========================================================================
// 2. CLIENT REQUESTS (CONTACT INQUIRIES)
// =========================================================================

// GET /api/admin/contact - List with search, status filter, and summary counts
router.get('/contact', async (req, res) => {
  try {
    const searchVal = req.query.search || req.query.q;
    const { status } = req.query;
    let query = 'SELECT id, ref_code, full_name, email, requirement_area, message, status, created_at FROM client_requests WHERE 1=1';
    const params = [];

    if (status && ['new', 'read', 'handled'].includes(status)) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (searchVal && searchVal.trim()) {
      params.push(`%${searchVal.trim()}%`);
      query += ` AND (ref_code ILIKE $${params.length} OR full_name ILIKE $${params.length} OR email ILIKE $${params.length} OR requirement_area ILIKE $${params.length} OR message ILIKE $${params.length})`;
    }

    query += ' ORDER BY created_at DESC;';

    const listRes = await pool.query(query, params);

    // Summary counts
    const countRes = await pool.query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'new') AS new_count,
        COUNT(*) FILTER (WHERE status = 'read') AS read_count,
        COUNT(*) FILTER (WHERE status = 'handled') AS handled_count
      FROM client_requests;
    `);

    res.json({
      success: true,
      items: listRes.rows,
      counts: {
        total: parseInt(countRes.rows[0].total, 10),
        new: parseInt(countRes.rows[0].new_count, 10),
        read: parseInt(countRes.rows[0].read_count, 10),
        handled: parseInt(countRes.rows[0].handled_count, 10)
      }
    });
  } catch (err) {
    console.error('Error fetching client requests:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve client requests.' });
  }
});

// GET /api/admin/contact/export/csv - Filter-aware CSV Export
router.get('/contact/export/csv', async (req, res) => {
  try {
    const searchVal = req.query.search || req.query.q;
    const { status } = req.query;
    let query = 'SELECT id, ref_code, full_name, email, requirement_area, message, status, created_at FROM client_requests WHERE 1=1';
    const params = [];

    if (status && ['new', 'read', 'handled'].includes(status)) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (searchVal && searchVal.trim()) {
      params.push(`%${searchVal.trim()}%`);
      query += ` AND (ref_code ILIKE $${params.length} OR full_name ILIKE $${params.length} OR email ILIKE $${params.length} OR requirement_area ILIKE $${params.length} OR message ILIKE $${params.length})`;
    }

    query += ' ORDER BY created_at DESC;';

    const result = await pool.query(query, params);
    
    const headers = ['Reference ID', 'Database ID', 'Full Name', 'Email', 'Requirement Area', 'Message', 'Status', 'Received At'];
    let csv = headers.map(formatCsvCell).join(',') + '\r\n';

    result.rows.forEach((row) => {
      const line = [
        row.ref_code || `REQ-${row.id}`,
        row.id,
        row.full_name,
        row.email,
        row.requirement_area,
        row.message,
        row.status,
        new Date(row.created_at).toISOString()
      ].map(formatCsvCell).join(',');
      csv += line + '\r\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="client_requests_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Error exporting contact CSV:', err.message);
    res.status(500).json({ success: false, error: 'Failed to export CSV.' });
  }
});

// GET /api/admin/contact/:id
router.get('/contact/:id', async (req, res) => {
  try {
    const isNumeric = /^\d+$/.test(req.params.id);
    const query = isNumeric 
      ? 'SELECT id, ref_code, full_name, email, requirement_area, message, status, created_at FROM client_requests WHERE id = $1;' 
      : 'SELECT id, ref_code, full_name, email, requirement_area, message, status, created_at FROM client_requests WHERE ref_code = $1;';
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const result = await pool.query(query, [param]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Client request not found.' });
    }
    res.json({ success: true, item: result.rows[0] });
  } catch (err) {
    console.error('Error fetching client request details:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve client request.' });
  }
});

// PATCH /api/admin/contact/:id/status
router.patch('/contact/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'read', 'handled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }

    const isNumeric = /^\d+$/.test(req.params.id);
    const query = isNumeric 
      ? 'UPDATE client_requests SET status = $1 WHERE id = $2 RETURNING id, ref_code, full_name, email, requirement_area, message, status, created_at;' 
      : 'UPDATE client_requests SET status = $1 WHERE ref_code = $2 RETURNING id, ref_code, full_name, email, requirement_area, message, status, created_at;';
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const result = await pool.query(query, [status, param]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Client request not found.' });
    }

    res.json({ success: true, item: result.rows[0] });
  } catch (err) {
    console.error('Error updating contact status:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update status.' });
  }
});

// DELETE /api/admin/contact/:id
router.delete('/contact/:id', async (req, res) => {
  try {
    const isNumeric = /^\d+$/.test(req.params.id);
    const query = isNumeric 
      ? 'DELETE FROM client_requests WHERE id = $1 RETURNING id, ref_code;' 
      : 'DELETE FROM client_requests WHERE ref_code = $1 RETURNING id, ref_code;';
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const result = await pool.query(query, [param]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Client request not found.' });
    }
    res.json({ success: true, message: 'Client request deleted.' });
  } catch (err) {
    console.error('Error deleting client request:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete client request.' });
  }
});

// =========================================================================
// 3. JOB APPLICATIONS
// =========================================================================

// GET /api/admin/applications - List with search, role filter, status filter (NEVER selects BYTEA resume_data)
router.get('/applications', async (req, res) => {
  try {
    const searchVal = req.query.search || req.query.q;
    const { role_id, status } = req.query;
    let query = `
      SELECT 
        a.id, a.ref_code, a.role_id, a.role_title, a.full_name, a.email, a.phone, 
        a.cover_message, a.resume_original_name, a.resume_size, 
        (a.resume_data IS NOT NULL) AS has_resume, a.status, a.created_at, 
        r.title as current_role_title 
      FROM applications a 
      LEFT JOIN roles r ON a.role_id = r.id 
      WHERE 1=1
    `;
    const params = [];

    if (status && ['new', 'reviewed', 'shortlisted', 'rejected'].includes(status)) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    if (role_id && !isNaN(parseInt(role_id, 10))) {
      params.push(parseInt(role_id, 10));
      query += ` AND a.role_id = $${params.length}`;
    }

    if (searchVal && searchVal.trim()) {
      params.push(`%${searchVal.trim()}%`);
      query += ` AND (a.ref_code ILIKE $${params.length} OR a.full_name ILIKE $${params.length} OR a.email ILIKE $${params.length} OR a.phone ILIKE $${params.length} OR a.role_title ILIKE $${params.length} OR a.cover_message ILIKE $${params.length})`;
    }

    query += ' ORDER BY a.created_at DESC;';

    const listRes = await pool.query(query, params);

    // Summary counts
    const countRes = await pool.query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'new') AS new_count,
        COUNT(*) FILTER (WHERE status = 'reviewed') AS reviewed_count,
        COUNT(*) FILTER (WHERE status = 'shortlisted') AS shortlisted_count,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count
      FROM applications;
    `);

    res.json({
      success: true,
      items: listRes.rows,
      counts: {
        total: parseInt(countRes.rows[0].total, 10),
        new: parseInt(countRes.rows[0].new_count, 10),
        reviewed: parseInt(countRes.rows[0].reviewed_count, 10),
        shortlisted: parseInt(countRes.rows[0].shortlisted_count, 10),
        rejected: parseInt(countRes.rows[0].rejected_count, 10)
      }
    });
  } catch (err) {
    console.error('Error fetching applications:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve applications.' });
  }
});

// GET /api/admin/applications/export/csv - Filter-aware CSV export
router.get('/applications/export/csv', async (req, res) => {
  try {
    const searchVal = req.query.search || req.query.q;
    const { role_id, status } = req.query;
    let query = `
      SELECT 
        a.id, a.ref_code, a.role_id, a.role_title, a.full_name, a.email, a.phone, 
        a.cover_message, a.resume_original_name, a.status, a.created_at, 
        r.title as current_role_title 
      FROM applications a 
      LEFT JOIN roles r ON a.role_id = r.id 
      WHERE 1=1
    `;
    const params = [];

    if (status && ['new', 'reviewed', 'shortlisted', 'rejected'].includes(status)) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    if (role_id && !isNaN(parseInt(role_id, 10))) {
      params.push(parseInt(role_id, 10));
      query += ` AND a.role_id = $${params.length}`;
    }

    if (searchVal && searchVal.trim()) {
      params.push(`%${searchVal.trim()}%`);
      query += ` AND (a.ref_code ILIKE $${params.length} OR a.full_name ILIKE $${params.length} OR a.email ILIKE $${params.length} OR a.phone ILIKE $${params.length} OR a.role_title ILIKE $${params.length} OR a.cover_message ILIKE $${params.length})`;
    }

    query += ' ORDER BY a.created_at DESC;';

    const result = await pool.query(query, params);
    
    const headers = ['Reference ID', 'Database ID', 'Role Title', 'Full Name', 'Email', 'Phone', 'Cover Message', 'Resume Original Name', 'Status', 'Applied At'];
    let csv = headers.map(formatCsvCell).join(',') + '\r\n';

    result.rows.forEach((row) => {
      const line = [
        row.ref_code || `APP-${row.id}`,
        row.id,
        row.role_title,
        row.full_name,
        row.email,
        row.phone,
        row.cover_message || '',
        row.resume_original_name,
        row.status,
        new Date(row.created_at).toISOString()
      ].map(formatCsvCell).join(',');
      csv += line + '\r\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="job_applications_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Error exporting applications CSV:', err.message);
    res.status(500).json({ success: false, error: 'Failed to export CSV.' });
  }
});

// GET /api/admin/applications/:id
router.get('/applications/:id', async (req, res) => {
  try {
    const isNumeric = /^\d+$/.test(req.params.id);
    const query = isNumeric 
      ? `SELECT a.id, a.ref_code, a.role_id, a.role_title, a.full_name, a.email, a.phone, 
                a.cover_message, a.resume_original_name, a.resume_size, 
                (a.resume_data IS NOT NULL) AS has_resume, a.status, a.created_at 
         FROM applications a WHERE a.id = $1;`
      : `SELECT a.id, a.ref_code, a.role_id, a.role_title, a.full_name, a.email, a.phone, 
                a.cover_message, a.resume_original_name, a.resume_size, 
                (a.resume_data IS NOT NULL) AS has_resume, a.status, a.created_at 
         FROM applications a WHERE a.ref_code = $1;`;
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const result = await pool.query(query, [param]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }
    res.json({ success: true, item: result.rows[0] });
  } catch (err) {
    console.error('Error fetching application details:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve application.' });
  }
});

// PATCH /api/admin/applications/:id/status
router.patch('/applications/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'reviewed', 'shortlisted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }

    const isNumeric = /^\d+$/.test(req.params.id);
    const query = isNumeric 
      ? 'UPDATE applications SET status = $1 WHERE id = $2 RETURNING id, ref_code, role_id, role_title, full_name, email, phone, cover_message, resume_original_name, status, created_at;' 
      : 'UPDATE applications SET status = $1 WHERE ref_code = $2 RETURNING id, ref_code, role_id, role_title, full_name, email, phone, cover_message, resume_original_name, status, created_at;';
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const result = await pool.query(query, [status, param]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    res.json({ success: true, item: result.rows[0] });
  } catch (err) {
    console.error('Error updating application status:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update status.' });
  }
});

// DELETE /api/admin/applications/:id
router.delete('/applications/:id', async (req, res) => {
  try {
    const isNumeric = /^\d+$/.test(req.params.id);
    const query = isNumeric 
      ? 'DELETE FROM applications WHERE id = $1 RETURNING id, ref_code;' 
      : 'DELETE FROM applications WHERE ref_code = $1 RETURNING id, ref_code;';
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const result = await pool.query(query, [param]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    res.json({ success: true, message: 'Application deleted successfully.' });
  } catch (err) {
    console.error('Error deleting application:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete application.' });
  }
});

// GET /api/admin/applications/:id/resume - Stream Resume Directly from DB BYTEA
router.get('/applications/:id/resume', async (req, res) => {
  try {
    const isNumeric = /^\d+$/.test(req.params.id);
    const query = isNumeric 
      ? 'SELECT id, resume_data, resume_mime, resume_original_name, resume_size FROM applications WHERE id = $1;' 
      : 'SELECT id, resume_data, resume_mime, resume_original_name, resume_size FROM applications WHERE ref_code = $1;';
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const result = await pool.query(query, [param]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    const app = result.rows[0];
    if (!app.resume_data) {
      return res.status(404).json({ success: false, error: 'Resume file data not found in database.' });
    }

    const safeName = (app.resume_original_name || `resume_${app.id}.pdf`).replace(/[\r\n"]/g, '_');
    const encodedName = encodeURIComponent(safeName);

    res.setHeader('Content-Type', app.resume_mime || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`);
    if (app.resume_size) {
      res.setHeader('Content-Length', app.resume_size);
    }

    return res.send(app.resume_data);
  } catch (err) {
    console.error('Error streaming resume from DB:', err.message);
    res.status(500).json({ success: false, error: 'Failed to download resume.' });
  }
});

// =========================================================================
// 4. ROLES MANAGEMENT
// =========================================================================

// GET /api/admin/roles - List all roles with application count
router.get('/roles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, r.ref_code, r.title, r.department, r.description, r.tag, r.status, r.created_at, COUNT(a.id) AS applications_count 
      FROM roles r 
      LEFT JOIN applications a ON r.id = a.role_id 
      GROUP BY r.id 
      ORDER BY r.id ASC;
    `);
    res.json({ success: true, items: result.rows });
  } catch (err) {
    console.error('Error fetching admin roles:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve roles.' });
  }
});

// POST /api/admin/roles - Create new role
router.post('/roles', async (req, res) => {
  try {
    const title = sanitizeText(req.body.title);
    const department = sanitizeText(req.body.department);
    const description = sanitizeText(req.body.description);
    const tag = sanitizeText(req.body.tag);
    const status = req.body.status === 'open' ? 'open' : 'closed';

    if (!title || !department || !description || !tag) {
      return res.status(400).json({
        success: false,
        error: 'Please provide title, department, description, and tag.'
      });
    }

    const refCode = await generateUniqueRefCode(pool, 'roles', 'ROLE');

    const query = `
      INSERT INTO roles (ref_code, title, department, description, tag, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const result = await pool.query(query, [refCode, title, department, description, tag, status]);
    res.status(201).json({ success: true, item: result.rows[0] });
  } catch (err) {
    console.error('Error creating role:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create role.' });
  }
});

// PUT /api/admin/roles/:id - Update existing role
router.put('/roles/:id', async (req, res) => {
  try {
    const title = sanitizeText(req.body.title);
    const department = sanitizeText(req.body.department);
    const description = sanitizeText(req.body.description);
    const tag = sanitizeText(req.body.tag);
    const status = req.body.status === 'open' ? 'open' : 'closed';

    if (!title || !department || !description || !tag) {
      return res.status(400).json({
        success: false,
        error: 'Please provide title, department, description, and tag.'
      });
    }

    const isNumeric = /^\d+$/.test(req.params.id);
    const query = isNumeric
      ? `UPDATE roles SET title = $1, department = $2, description = $3, tag = $4, status = $5 WHERE id = $6 RETURNING *;`
      : `UPDATE roles SET title = $1, department = $2, description = $3, tag = $4, status = $5 WHERE ref_code = $6 RETURNING *;`;
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const result = await pool.query(query, [title, department, description, tag, status, param]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Role not found.' });
    }

    res.json({ success: true, item: result.rows[0] });
  } catch (err) {
    console.error('Error updating role:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update role.' });
  }
});

// PATCH /api/admin/roles/:id/toggle-status - Toggle open/closed
router.patch('/roles/:id/toggle-status', async (req, res) => {
  try {
    const isNumeric = /^\d+$/.test(req.params.id);
    const checkQuery = isNumeric
      ? 'SELECT id, status FROM roles WHERE id = $1;'
      : 'SELECT id, status FROM roles WHERE ref_code = $1;';
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const roleCheck = await pool.query(checkQuery, [param]);
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Role not found.' });
    }

    const { id: roleId, status: currentStatus } = roleCheck.rows[0];
    const nextStatus = currentStatus === 'open' ? 'closed' : 'open';

    const result = await pool.query(
      'UPDATE roles SET status = $1 WHERE id = $2 RETURNING *;',
      [nextStatus, roleId]
    );

    res.json({ success: true, item: result.rows[0] });
  } catch (err) {
    console.error('Error toggling role status:', err.message);
    res.status(500).json({ success: false, error: 'Failed to toggle role status.' });
  }
});

// DELETE /api/admin/roles/:id - Delete role
router.delete('/roles/:id', async (req, res) => {
  try {
    const isNumeric = /^\d+$/.test(req.params.id);
    const query = isNumeric
      ? 'DELETE FROM roles WHERE id = $1 RETURNING id, ref_code;'
      : 'DELETE FROM roles WHERE ref_code = $1 RETURNING id, ref_code;';
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const result = await pool.query(query, [param]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Role not found.' });
    }
    res.json({ success: true, message: 'Role deleted successfully.' });
  } catch (err) {
    console.error('Error deleting role:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete role.' });
  }
});

// =========================================================================
// 5. DIRECTORS MANAGEMENT
// =========================================================================

// GET /api/admin/directors - List all directors (NEVER selects BYTEA photo_data)
router.get('/directors', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, ref_code, name, role, sort_order, is_visible, 
             (photo_data IS NOT NULL) AS has_photo, photo_updated_at, updated_at, created_at 
      FROM directors 
      ORDER BY sort_order ASC, id ASC;
    `);
    const items = result.rows.map((row) => {
      const v = row.photo_updated_at 
        ? new Date(row.photo_updated_at).getTime() 
        : (row.updated_at ? new Date(row.updated_at).getTime() : Date.now());
      return {
        ...row,
        photo_url: row.has_photo ? `/api/directors/${row.id}/photo?v=${v}` : null
      };
    });
    res.json({ success: true, items });
  } catch (err) {
    console.error('Error fetching admin directors:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve directors.' });
  }
});

// POST /api/admin/directors - Create director with in-memory photo processing
router.post('/directors', handleDirectorPhotoUpload, async (req, res) => {
  try {
    const name = sanitizeText(req.body.name);
    const role = sanitizeText(req.body.role);
    const isVisible = req.body.is_visible !== 'false' && req.body.is_visible !== false;

    if (!name || name.length < 2 || name.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Please provide director name (2 to 255 characters).'
      });
    }

    if (!role || role.length < 2 || role.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Please provide director role (2 to 255 characters).'
      });
    }

    let photoBuffer = null;
    let photoMime = null;
    if (req.file) {
      try {
        const processed = await processDirectorPhotoToBuffer(req.file.buffer, req.file.originalname);
        photoBuffer = processed.buffer;
        photoMime = processed.mime;
      } catch (uploadErr) {
        return res.status(400).json({
          success: false,
          error: uploadErr.message
        });
      }
    }

    const refCode = await generateUniqueRefCode(pool, 'directors', 'DIR');

    // Get next sort order
    const sortRes = await pool.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM directors;');
    const nextOrder = parseInt(sortRes.rows[0].next_order, 10);

    const insertQuery = `
      INSERT INTO directors (ref_code, name, role, photo_data, photo_mime, photo_updated_at, sort_order, is_visible)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7)
      RETURNING id, ref_code, name, role, sort_order, is_visible, (photo_data IS NOT NULL) AS has_photo, photo_updated_at, created_at, updated_at;
    `;

    const result = await pool.query(insertQuery, [refCode, name, role, photoBuffer, photoMime, nextOrder, isVisible]);
    const row = result.rows[0];
    const v = row.photo_updated_at ? new Date(row.photo_updated_at).getTime() : Date.now();
    const createdItem = {
      ...row,
      photo_url: row.has_photo ? `/api/directors/${row.id}/photo?v=${v}` : null
    };

    res.status(201).json({ success: true, item: createdItem });
  } catch (err) {
    console.error('Error creating director:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create director.' });
  }
});

// POST /api/admin/directors/reorder - Reorder directors in one transaction
router.post('/directors/reorder', async (req, res) => {
  const order = req.body.order || req.body.ids;
  if (!Array.isArray(order) || order.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Please provide an array of director IDs to reorder.'
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < order.length; i++) {
      const id = parseInt(order[i], 10);
      if (isNaN(id)) continue;
      await client.query(
        'UPDATE directors SET sort_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;',
        [i, id]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Directors reordered successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error reordering directors:', err.message);
    res.status(500).json({ success: false, error: 'Failed to reorder directors.' });
  } finally {
    client.release();
  }
});

// PUT /api/admin/directors/:id - Update director with in-memory photo processing
router.put('/directors/:id', handleDirectorPhotoUpload, async (req, res) => {
  try {
    const name = sanitizeText(req.body.name);
    const role = sanitizeText(req.body.role);
    const isVisible = req.body.is_visible !== 'false' && req.body.is_visible !== false;
    const removePhoto = req.body.remove_photo === 'true' || req.body.remove_photo === true;

    if (!name || name.length < 2 || name.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Please provide director name (2 to 255 characters).'
      });
    }

    if (!role || role.length < 2 || role.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Please provide director role (2 to 255 characters).'
      });
    }

    const isNumeric = /^\d+$/.test(req.params.id);
    const checkQuery = isNumeric
      ? 'SELECT id, photo_mime FROM directors WHERE id = $1;'
      : 'SELECT id, photo_mime FROM directors WHERE ref_code = $1;';
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const existingRes = await pool.query(checkQuery, [param]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Director not found.' });
    }

    const existing = existingRes.rows[0];

    if (req.file) {
      // New photo uploaded
      try {
        const processed = await processDirectorPhotoToBuffer(req.file.buffer, req.file.originalname);
        const updateQuery = `
          UPDATE directors 
          SET name = $1, role = $2, photo_data = $3, photo_mime = $4, photo_updated_at = CURRENT_TIMESTAMP, is_visible = $5, updated_at = CURRENT_TIMESTAMP 
          WHERE id = $6 
          RETURNING id, ref_code, name, role, sort_order, is_visible, (photo_data IS NOT NULL) AS has_photo, photo_updated_at, created_at, updated_at;
        `;
        const result = await pool.query(updateQuery, [name, role, processed.buffer, processed.mime, isVisible, existing.id]);
        const row = result.rows[0];
        const v = row.photo_updated_at ? new Date(row.photo_updated_at).getTime() : Date.now();
        return res.json({
          success: true,
          item: {
            ...row,
            photo_url: row.has_photo ? `/api/directors/${row.id}/photo?v=${v}` : null
          }
        });
      } catch (uploadErr) {
        return res.status(400).json({
          success: false,
          error: uploadErr.message
        });
      }
    } else if (removePhoto) {
      // Remove photo
      const updateQuery = `
        UPDATE directors 
        SET name = $1, role = $2, photo_data = NULL, photo_mime = NULL, photo_updated_at = CURRENT_TIMESTAMP, is_visible = $3, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $4 
        RETURNING id, ref_code, name, role, sort_order, is_visible, (photo_data IS NOT NULL) AS has_photo, photo_updated_at, created_at, updated_at;
      `;
      const result = await pool.query(updateQuery, [name, role, isVisible, existing.id]);
      const row = result.rows[0];
      return res.json({
        success: true,
        item: {
          ...row,
          photo_url: null
        }
      });
    } else {
      // Keep existing photo
      const updateQuery = `
        UPDATE directors 
        SET name = $1, role = $2, is_visible = $3, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $4 
        RETURNING id, ref_code, name, role, sort_order, is_visible, (photo_data IS NOT NULL) AS has_photo, photo_updated_at, created_at, updated_at;
      `;
      const result = await pool.query(updateQuery, [name, role, isVisible, existing.id]);
      const row = result.rows[0];
      const v = row.photo_updated_at ? new Date(row.photo_updated_at).getTime() : Date.now();
      return res.json({
        success: true,
        item: {
          ...row,
          photo_url: row.has_photo ? `/api/directors/${row.id}/photo?v=${v}` : null
        }
      });
    }
  } catch (err) {
    console.error('Error updating director:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update director.' });
  }
});

// PATCH /api/admin/directors/:id/toggle-visibility - Toggle visibility
router.patch('/directors/:id/toggle-visibility', async (req, res) => {
  try {
    const isNumeric = /^\d+$/.test(req.params.id);
    const checkQuery = isNumeric
      ? 'SELECT id, is_visible FROM directors WHERE id = $1;'
      : 'SELECT id, is_visible FROM directors WHERE ref_code = $1;';
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const checkRes = await pool.query(checkQuery, [param]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Director not found.' });
    }

    const currentVisible = checkRes.rows[0].is_visible;
    const nextVisible = !currentVisible;

    const result = await pool.query(
      `UPDATE directors 
       SET is_visible = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, ref_code, name, role, sort_order, is_visible, (photo_data IS NOT NULL) AS has_photo, photo_updated_at, created_at, updated_at;`,
      [nextVisible, checkRes.rows[0].id]
    );

    const row = result.rows[0];
    const v = row.photo_updated_at ? new Date(row.photo_updated_at).getTime() : Date.now();
    const item = {
      ...row,
      photo_url: row.has_photo ? `/api/directors/${row.id}/photo?v=${v}` : null
    };

    res.json({ success: true, item });
  } catch (err) {
    console.error('Error toggling director visibility:', err.message);
    res.status(500).json({ success: false, error: 'Failed to toggle visibility.' });
  }
});

// DELETE /api/admin/directors/:id - Delete director
router.delete('/directors/:id', async (req, res) => {
  try {
    const isNumeric = /^\d+$/.test(req.params.id);
    const query = isNumeric
      ? 'DELETE FROM directors WHERE id = $1 RETURNING id, ref_code;'
      : 'DELETE FROM directors WHERE ref_code = $1 RETURNING id, ref_code;';
    const param = isNumeric ? parseInt(req.params.id, 10) : req.params.id;

    const result = await pool.query(query, [param]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Director not found.' });
    }

    res.json({ success: true, message: 'Director deleted successfully.' });
  } catch (err) {
    console.error('Error deleting director:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete director.' });
  }
});

module.exports = router;
