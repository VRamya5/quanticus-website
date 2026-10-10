const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });


console.log('================================================================');
console.log('  TESTING LIVE SERVER & FUNCTIONALITY (PORT 3000)');
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

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  try {
    // 1. GET / (Public site)
    const home = await request({ hostname: 'localhost', port: 3000, path: '/', method: 'GET' });
    assert(home.statusCode === 200, 'GET / returns 200 OK');
    assert(home.body.includes('Quanticus Software Solutions'), 'Public site HTML contains title');
    assert(home.body.includes('href="/assets/favicon.svg"'), 'Public site links favicon.svg');
    assert(home.body.includes('href="/assets/favicon.png"'), 'Public site links favicon.png');
    assert(home.body.includes('href="/favicon.ico"'), 'Public site links favicon.ico');
    assert(home.body.includes('id="work"'), 'Public site contains Work section');
    assert(home.body.includes('id="process"'), 'Public site contains Process section');
    assert(home.body.includes('id="directors"'), 'Public site contains Directors section');

    // 2. Favicon endpoints
    const favIco = await request({ hostname: 'localhost', port: 3000, path: '/favicon.ico', method: 'GET' });
    assert(favIco.statusCode === 200, 'GET /favicon.ico returns 200 OK (no 404)');

    const favPng = await request({ hostname: 'localhost', port: 3000, path: '/assets/favicon.png', method: 'GET' });
    assert(favPng.statusCode === 200, 'GET /assets/favicon.png returns 200 OK (no 404)');

    const favSvg = await request({ hostname: 'localhost', port: 3000, path: '/assets/favicon.svg', method: 'GET' });
    assert(favSvg.statusCode === 200, 'GET /assets/favicon.svg returns 200 OK (no 404)');

    // 3. GET /admin (Admin login page)
    const adminPage = await request({ hostname: 'localhost', port: 3000, path: '/admin', method: 'GET' });
    assert(adminPage.statusCode === 200, 'GET /admin returns 200 OK');
    assert(adminPage.body.includes('Admin Portal'), 'Admin page HTML contains Admin Portal title');
    assert(adminPage.body.includes('login-brand-logo'), 'Admin page contains login-brand-logo');
    assert(adminPage.body.includes('Build What\'s Next.'), 'Admin page contains slogan Build What\'s Next.');

    // 4. Test CSS Slogan Layout Tokens
    const mainCss = await request({ hostname: 'localhost', port: 3000, path: '/css/main.css', method: 'GET' });
    assert(mainCss.statusCode === 200, 'GET /css/main.css returns 200 OK');
    assert(mainCss.body.includes('.brand-logo,') && mainCss.body.includes('display: flex;') && mainCss.body.includes('flex-direction: column;'), 'main.css sets .brand-logo to flex-direction: column');
    assert(mainCss.body.includes('.logo-plate,') && mainCss.body.includes('display: block;'), 'main.css sets .logo-plate to display: block');

    const adminCss = await request({ hostname: 'localhost', port: 3000, path: '/admin/admin.css', method: 'GET' });
    assert(adminCss.statusCode === 200, 'GET /admin/admin.css returns 200 OK');
    assert(adminCss.body.includes('.login-brand-logo') && adminCss.body.includes('flex-direction: column;'), 'admin.css sets .login-brand-logo to flex-direction: column');
    assert(adminCss.body.includes('.login-brand-logo') && adminCss.body.includes('align-items: center;'), 'admin.css sets .login-brand-logo to align-items: center');
    assert(adminCss.body.includes('.login-header') && adminCss.body.includes('text-align: center;'), 'admin.css sets .login-header to text-align: center');
    assert(adminPage.body.includes('<div class="login-brand-logo"'), 'Admin login logo is a non-clickable div, not an <a> link');


    // 5. Test JS files delivered via HTTP are free of syntax errors
    const appJs = await request({ hostname: 'localhost', port: 3000, path: '/js/app.js', method: 'GET' });
    assert(appJs.statusCode === 200, 'GET /js/app.js returns 200 OK');

    const adminJs = await request({ hostname: 'localhost', port: 3000, path: '/admin/admin.js', method: 'GET' });
    assert(adminJs.statusCode === 200, 'GET /admin/admin.js returns 200 OK');

    // 6. Test Admin Login API Functionality
    // A) Empty fields
    const emptyLoginRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ email: '', password: '' }));
    assert(emptyLoginRes.statusCode === 400, 'POST /admin/login with empty fields returns 400 Bad Request');
    const emptyJson = JSON.parse(emptyLoginRes.body);
    assert(emptyJson.success === false && emptyJson.error, 'Empty login returns proper validation error message: ' + emptyJson.error);

    // B) Wrong password
    const wrongLoginRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ email: 'admin@quanticus.com', password: 'wrongpassword123' }));
    assert(wrongLoginRes.statusCode === 401, 'POST /admin/login with wrong password returns 401 Unauthorized');
    const wrongJson = JSON.parse(wrongLoginRes.body);
    assert(wrongJson.success === false && wrongJson.error.includes('Invalid email or password'), 'Wrong password returns error: ' + wrongJson.error);

    // C) Correct password
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@quanticus.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Quanticus@Admin2026!';

    const correctLoginRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000'
      }
    }, JSON.stringify({ email: adminEmail, password: adminPassword }));
    assert(correctLoginRes.statusCode === 200, 'POST /admin/login with correct credentials returns 200 OK');
    const correctJson = JSON.parse(correctLoginRes.body);
    assert(correctJson.success === true && correctJson.admin, 'Correct login returns success: true and admin object');
    assert(correctLoginRes.headers['set-cookie'], 'Set-Cookie header received for authenticated session');



    const cookie = correctLoginRes.headers['set-cookie'][0].split(';')[0];

    // D) Authenticated requests with session
    const contactRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/admin/api/contact',
      method: 'GET',
      headers: { 'Cookie': cookie }
    });
    assert(contactRes.statusCode === 200, 'Authenticated GET /admin/api/contact returns 200 OK');

    const appsRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/admin/api/applications',
      method: 'GET',
      headers: { 'Cookie': cookie }
    });
    assert(appsRes.statusCode === 200, 'Authenticated GET /admin/api/applications returns 200 OK');


    const rolesRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/admin/api/roles',
      method: 'GET',
      headers: { 'Cookie': cookie }
    });
    assert(rolesRes.statusCode === 200, 'Authenticated GET /admin/api/roles returns 200 OK');

    const directorsRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/admin/api/directors',
      method: 'GET',
      headers: { 'Cookie': cookie }
    });
    assert(directorsRes.statusCode === 200, 'Authenticated GET /admin/api/directors returns 200 OK');

    console.log('\n================================================================');
    console.log(`  LIVE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test run failed with error:', err);
    process.exit(1);
  }
}

runTests();

