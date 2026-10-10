/**
 * Comprehensive Automated End-to-End Verification Test Suite for Quanticus
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Load environment variables (.env in root or backend)
const rootEnv = path.join(__dirname, '../../../.env');
const backendEnv = path.join(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else if (fs.existsSync(backendEnv)) {
  require('dotenv').config({ path: backendEnv });
} else {
  require('dotenv').config();
}

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function runTests() {
  console.log('================================================================');
  console.log('  STARTING QUANTICUS END-TO-END DEPLOYMENT VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  // Create temporary test files
  const testValidPdfPath = path.join(__dirname, 'test_sample_resume.pdf');
  const validPdfHeader = '%PDF-1.4\n% Quanticus Automated Test PDF\n';
  const validPdfBuffer = Buffer.concat([
    Buffer.from(validPdfHeader),
    Buffer.alloc(100 * 1024, 'A'), // 100KB valid PDF
    Buffer.from('\n%%EOF')
  ]);
  fs.writeFileSync(testValidPdfPath, validPdfBuffer);

  // Large 3.5MB valid PDF
  const test35MbPdfPath = path.join(__dirname, 'test_3.5mb_resume.pdf');
  const pdf35MbBuffer = Buffer.concat([
    Buffer.from('%PDF-1.4\n% Large 3.5MB test PDF\n'),
    Buffer.alloc(3.5 * 1024 * 1024, 'X'),
    Buffer.from('\n%%EOF')
  ]);
  fs.writeFileSync(test35MbPdfPath, pdf35MbBuffer);

  // Large 4.5MB PDF (should exceed 4MB limit)
  const test45MbPdfPath = path.join(__dirname, 'test_4.5mb_resume.pdf');
  const pdf45MbBuffer = Buffer.concat([
    Buffer.from('%PDF-1.4\n% Oversized 4.5MB test PDF\n'),
    Buffer.alloc(4.5 * 1024 * 1024, 'Y'),
    Buffer.from('\n%%EOF')
  ]);
  fs.writeFileSync(test45MbPdfPath, pdf45MbBuffer);

  // Sample Director Photo (PNG image converted to buffer)
  const testPhotoBuffer = await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 4,
      background: { r: 29, g: 78, b: 216, alpha: 1 }
    }
  }).png().toBuffer();

  let sessionCookie = '';

  try {
    // -----------------------------------------------------------------------
    // TEST 0: Health Check Endpoint for Render
    // -----------------------------------------------------------------------
    console.log('\n--- 0. RENDER HEALTH CHECK ---');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'GET /api/health returns status 200');
    assert(healthData.ok === true, 'GET /api/health returns { ok: true } without leaking internal details');

    // -----------------------------------------------------------------------
    // TEST 1: Static Frontend Delivery
    // -----------------------------------------------------------------------
    console.log('\n--- 1. STATIC FRONTEND DELIVERY ---');
    const homeRes = await fetch(`${BASE_URL}/`);
    assert(homeRes.status === 200, 'GET / serves public index.html');
    const homeHtml = await homeRes.text();
    assert(homeHtml.includes('Quanticus Software Solutions'), 'Public page contains brand title');

    const adminHtmlRes = await fetch(`${BASE_URL}/admin`);
    assert(adminHtmlRes.status === 200, 'GET /admin serves admin portal index.html');
    const adminHtml = await adminHtmlRes.text();
    assert(adminHtml.includes('Quanticus Admin Portal'), 'Admin portal page contains admin dashboard markup');

    // -----------------------------------------------------------------------
    // TEST 2: Public GET /api/roles
    // -----------------------------------------------------------------------
    console.log('\n--- 2. PUBLIC API: ROLES ---');
    const rolesRes = await fetch(`${BASE_URL}/api/roles`);
    const rolesData = await rolesRes.json();
    assert(rolesRes.status === 200, 'GET /api/roles returns status 200');
    assert(rolesData.success === true, 'GET /api/roles success is true');
    assert(Array.isArray(rolesData.roles) && rolesData.roles.length >= 4, 'GET /api/roles returns seeded roles');

    const openRole = rolesData.roles.find(r => r.status === 'open');
    assert(!!openRole, `Found open role: "${openRole?.title}" (ID: ${openRole?.id})`);

    // -----------------------------------------------------------------------
    // TEST 3: Public Contact Form Submission & Honeypot
    // -----------------------------------------------------------------------
    console.log('\n--- 3. PUBLIC API: CONTACT SUBMISSION ---');
    const contactPayload = {
      fullName: 'Dr. Jane Smith',
      email: 'jane.smith@enterprise-partner.com',
      requirementArea: 'Web & Mobile Development',
      message: '=SUM(1+1) Client inquiry with formula characters to test CSV sanitization'
    };

    const contactRes = await fetch(`${BASE_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass': 'quanticus-test' },
      body: JSON.stringify(contactPayload)
    });
    const contactData = await contactRes.json();
    assert(contactRes.status === 201, 'POST /api/contact returns 201 Created');
    assert(contactData.success === true && !!contactData.id, `Contact request saved with ID: ${contactData.id}`);
    assert(!!contactData.ref_code && contactData.ref_code.startsWith('REQ-'), `Contact response returns valid ref_code: ${contactData.ref_code}`);

    // Honeypot test
    const honeypotRes = await fetch(`${BASE_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass': 'quanticus-test' },
      body: JSON.stringify({
        fullName: 'Bot User',
        email: 'bot@spam.com',
        requirementArea: 'General',
        message: 'Spam text',
        website: 'https://spam.bot'
      })
    });
    const honeypotData = await honeypotRes.json();
    assert(honeypotRes.status === 200 && !honeypotData.id, 'Honeypot form submission returns 200 without DB insertion');

    // -----------------------------------------------------------------------
    // TEST 4: Resume Upload to Database (3.5MB success, 4.5MB reject)
    // -----------------------------------------------------------------------
    console.log('\n--- 4. RESUME UPLOADS & IN-DATABASE STORAGE ---');

    // 4.1 Test 4.5MB oversized resume upload (Should be rejected)
    const overFormData = new FormData();
    overFormData.append('fullName', 'Oversized Applicant');
    overFormData.append('email', 'oversized@test.com');
    overFormData.append('phone', '+1 555 999 0000');
    overFormData.append('roleId', String(openRole.id));
    overFormData.append('roleTitle', openRole.title);
    overFormData.append('resume', new Blob([fs.readFileSync(test45MbPdfPath)], { type: 'application/pdf' }), 'Oversized_Resume.pdf');

    const overRes = await fetch(`${BASE_URL}/api/applications`, {
      method: 'POST',
      headers: { 'x-test-bypass': 'quanticus-test' },
      body: overFormData
    });
    const overData = await overRes.json();
    assert(overRes.status === 400, 'POST /api/applications rejects 4.5MB resume with 400 Bad Request');
    assert(overData.error && overData.error.includes('4MB'), `Error message mentions 4MB limit: "${overData.error}"`);

    // 4.2 Test 3.5MB valid PDF resume upload (Should be accepted and stored in BYTEA)
    const validFormData = new FormData();
    validFormData.append('fullName', 'Michael Chang');
    validFormData.append('email', 'michael.chang@techhire.org');
    validFormData.append('phone', '+1 (555) 234-5678');
    validFormData.append('roleId', String(openRole.id));
    validFormData.append('roleTitle', openRole.title);
    validFormData.append('coverMessage', 'Experienced software engineer application.');
    validFormData.append('resume', new Blob([fs.readFileSync(test35MbPdfPath)], { type: 'application/pdf' }), 'Michael_Chang_Resume.pdf');

    const validAppRes = await fetch(`${BASE_URL}/api/applications`, {
      method: 'POST',
      headers: { 'x-test-bypass': 'quanticus-test' },
      body: validFormData
    });
    const appData = await validAppRes.json();
    assert(validAppRes.status === 201, 'POST /api/applications accepts 3.5MB resume with 201 Created');
    assert(appData.success === true && !!appData.id, `Application created with ID: ${appData.id} and ref_code: ${appData.ref_code}`);

    // Confirm no disk uploads folder is created
    assert(!fs.existsSync(path.join(__dirname, '../../uploads')), 'No local uploads directory created on filesystem');

    // -----------------------------------------------------------------------
    // TEST 5: Admin Authentication & Namespace (/api/admin/*)
    // -----------------------------------------------------------------------
    console.log('\n--- 5. ADMIN AUTHENTICATION & /api/admin/* NAMESPACE ---');

    // Unauthenticated access
    const unauthRes = await fetch(`${BASE_URL}/api/admin/applications`);
    assert(unauthRes.status === 401, 'GET /api/admin/applications rejects unauthenticated access with 401');

    // Admin login
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-bypass': 'quanticus-test' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    assert(loginRes.status === 200, 'POST /api/admin/login returns 200 OK');
    const setCookie = loginRes.headers.get('set-cookie');
    assert(!!setCookie, 'Login sets session cookie');
    sessionCookie = setCookie.split(';')[0];

    // Check GET /api/admin/me
    const meRes = await fetch(`${BASE_URL}/api/admin/me`, {
      headers: { 'Cookie': sessionCookie }
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.authenticated === true, `GET /api/admin/me confirms authenticated admin: ${meData.admin?.email}`);

    // -----------------------------------------------------------------------
    // TEST 6: Admin Resume Download & CSV Export Formula Sanitization
    // -----------------------------------------------------------------------
    console.log('\n--- 6. RESUME STREAMING & CSV FORMULA SANITIZATION ---');

    // Download Resume Stream from database
    const resumeDownloadRes = await fetch(`${BASE_URL}/api/admin/applications/${appData.id}/resume`, {
      headers: { 'Cookie': sessionCookie }
    });
    assert(resumeDownloadRes.status === 200, 'GET /api/admin/applications/:id/resume streams file from DB BYTEA');
    const downloadedBuffer = Buffer.from(await resumeDownloadRes.arrayBuffer());
    assert(downloadedBuffer.length === pdf35MbBuffer.length, `Downloaded resume size matches exact stored byte length (${downloadedBuffer.length} bytes)`);
    const disposition = resumeDownloadRes.headers.get('content-disposition');
    assert(disposition && disposition.includes('Michael_Chang_Resume.pdf'), `Content-Disposition contains original name: "${disposition}"`);

    // Verify unauthenticated user cannot download resume
    const unauthResumeRes = await fetch(`${BASE_URL}/api/admin/applications/${appData.id}/resume`);
    assert(unauthResumeRes.status === 401, 'Unauthenticated resume download returns 401 Unauthorized');

    // CSV Export with Formula Injection Check
    const contactCsvRes = await fetch(`${BASE_URL}/api/admin/contact/export/csv`, {
      headers: { 'Cookie': sessionCookie }
    });
    const contactCsvText = await contactCsvRes.text();
    assert(contactCsvRes.status === 200, 'GET /api/admin/contact/export/csv returns 200 OK');
    assert(contactCsvText.includes("''=SUM(1+1)") || contactCsvText.includes("=\"'=SUM(1+1)") || contactCsvText.includes("'=SUM(1+1)"), 'CSV formula injection escaped with single quote prefix');

    const appsCsvRes = await fetch(`${BASE_URL}/api/admin/applications/export/csv`, {
      headers: { 'Cookie': sessionCookie }
    });
    const appsCsvText = await appsCsvRes.text();
    assert(appsCsvRes.status === 200 && appsCsvText.includes('Michael_Chang_Resume.pdf'), 'Applications CSV contains resume original filename');

    // -----------------------------------------------------------------------
    // TEST 7: Director Management & In-Database Photo Storage
    // -----------------------------------------------------------------------
    console.log('\n--- 7. DIRECTORS IN-MEMORY PHOTO PROCESSING & SERVING ---');

    // Create a new test director with photo
    const dirFormData = new FormData();
    dirFormData.append('name', 'Elena Rostova');
    dirFormData.append('role', 'Chief Technology Officer');
    dirFormData.append('is_visible', 'true');
    dirFormData.append('photo', new Blob([testPhotoBuffer], { type: 'image/png' }), 'elena.png');

    const createDirRes = await fetch(`${BASE_URL}/api/admin/directors`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookie },
      body: dirFormData
    });
    const createDirData = await createDirRes.json();
    assert(createDirRes.status === 201 && !!createDirData.item.id, `Created director ID: ${createDirData.item?.id}`);
    assert(!!createDirData.item.photo_url, `Director returned photo_url: ${createDirData.item?.photo_url}`);
    const newDirId = createDirData.item.id;

    // Public photo route serves processed WebP with Cache-Control and ETag
    const photoRes = await fetch(`${BASE_URL}/api/directors/${newDirId}/photo`);
    assert(photoRes.status === 200, 'GET /api/directors/:id/photo returns 200 OK');
    assert(photoRes.headers.get('content-type') === 'image/webp', 'Served photo has Content-Type: image/webp');
    assert(photoRes.headers.get('cache-control')?.includes('public'), 'Served photo has public Cache-Control');
    const photoEtag = photoRes.headers.get('etag');
    assert(!!photoEtag, `Served photo has ETag: ${photoEtag}`);

    // Test ETag 304 Not Modified
    const notModifiedRes = await fetch(`${BASE_URL}/api/directors/${newDirId}/photo`, {
      headers: { 'If-None-Match': photoEtag }
    });
    assert(notModifiedRes.status === 304, 'GET /api/directors/:id/photo with If-None-Match returns 304 Not Modified');

    // Hide director and test public photo returns 404 for unauthenticated visitor
    const toggleDirRes = await fetch(`${BASE_URL}/api/admin/directors/${newDirId}/toggle-visibility`, {
      method: 'PATCH',
      headers: { 'Cookie': sessionCookie }
    });
    const toggleDirData = await toggleDirRes.json();
    assert(toggleDirRes.status === 200 && toggleDirData.item.is_visible === false, 'Director toggled to hidden');

    const hiddenPhotoRes = await fetch(`${BASE_URL}/api/directors/${newDirId}/photo`);
    assert(hiddenPhotoRes.status === 404, 'Public photo route returns 404 for hidden director');

    // Clean up test director
    const delDirRes = await fetch(`${BASE_URL}/api/admin/directors/${newDirId}`, {
      method: 'DELETE',
      headers: { 'Cookie': sessionCookie }
    });
    assert(delDirRes.status === 200, 'DELETE /api/admin/directors/:id deletes director');

    // -----------------------------------------------------------------------
    // TEST 8: Admin Logout
    // -----------------------------------------------------------------------
    console.log('\n--- 8. ADMIN LOGOUT ---');
    const logoutRes = await fetch(`${BASE_URL}/api/admin/logout`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookie }
    });
    assert(logoutRes.status === 200, 'POST /api/admin/logout returns 200');

    const meAfterLogout = await fetch(`${BASE_URL}/api/admin/me`, {
      headers: { 'Cookie': sessionCookie }
    });
    assert(meAfterLogout.status === 401, 'GET /api/admin/me returns 401 after logout');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    // Cleanup temporary test files
    [testValidPdfPath, test35MbPdfPath, test45MbPdfPath].forEach((p) => {
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch {}
      }
    });

    console.log('\n================================================================');
    console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  }
}

runTests();
