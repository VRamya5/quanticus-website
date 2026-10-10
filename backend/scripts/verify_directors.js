const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false);
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@quanticus.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Quanticus@Admin2026!';

async function runVerification() {
  console.log('================================================================');
  console.log('  STARTING DIRECTORS & REMOVALS VERIFICATION SUITE');
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

  let sessionCookie = '';

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Unauthenticated Admin Route Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 1. UNAUTHENTICATED ACCESS PROTECTION ---');
    const unauthGet = await fetch(`${BASE_URL}/admin/api/directors`);
    assert(unauthGet.status === 401, 'GET /admin/api/directors rejects unauthenticated requests with 401');

    const unauthPost = await fetch(`${BASE_URL}/admin/api/directors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
      body: JSON.stringify({ name: 'Hacker', role: 'Fake' })
    });
    assert(unauthPost.status === 401, 'POST /admin/api/directors rejects unauthenticated requests with 401');

    // -------------------------------------------------------------------------
    // TEST 2: Admin Login
    // -------------------------------------------------------------------------
    console.log('\n--- 2. ADMIN LOGIN ---');
    const loginRes = await fetch(`${BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': BASE_URL },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.success === true, 'Admin login successful');

    const rawCookies = loginRes.headers.get('set-cookie');
    assert(!!rawCookies, 'Session cookie received');
    sessionCookie = rawCookies ? rawCookies.split(';')[0] : '';

    // -------------------------------------------------------------------------
    // TEST 3: Admin GET /admin/api/directors
    // -------------------------------------------------------------------------
    console.log('\n--- 3. ADMIN LIST DIRECTORS ---');
    const adminListRes = await fetch(`${BASE_URL}/admin/api/directors`, {
      headers: { 'Cookie': sessionCookie }
    });
    const adminListData = await adminListRes.json();
    assert(adminListRes.status === 200, 'GET /admin/api/directors returns 200');
    assert(adminListData.success === true && Array.isArray(adminListData.items), 'Returns success and items array');
    assert(adminListData.items.length >= 4, `Found ${adminListData.items.length} initial directors (>= 4)`);

    // -------------------------------------------------------------------------
    // TEST 4: Add Director with Photo
    // -------------------------------------------------------------------------
    console.log('\n--- 4. CREATE DIRECTOR WITH REAL PHOTO ---');
    // Generate valid sample image buffer (400x400 blue PNG)
    const validPngBuffer = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 4,
        background: { r: 29, g: 78, b: 216, alpha: 1 }
      }
    }).png().toBuffer();

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    let bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\nVikram Malhotra\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="role"\r\n\r\nChief Technology Officer\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="is_visible"\r\n\r\ntrue\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="vikram.png"\r\nContent-Type: image/png\r\n\r\n`),
      validPngBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const createRes = await fetch(`${BASE_URL}/admin/api/directors`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Origin': BASE_URL,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer
    });

    const createData = await createRes.json();
    assert(createRes.status === 201, 'POST /admin/api/directors returns 201 Created');
    assert(createData.success === true && createData.item.name === 'Vikram Malhotra', 'Director created with correct name');
    assert(!!createData.item.photo_filename, `Photo processed and saved as: ${createData.item.photo_filename}`);
    assert(createData.item.photo_url.startsWith('/uploads/directors/'), `Public photo URL generated: ${createData.item.photo_url}`);

    const newDirectorId = createData.item.id;
    const initialPhotoFilename = createData.item.photo_filename;

    // Verify photo exists on disk and is 800x800 webp
    const photoPathOnDisk = path.join(__dirname, '../uploads/directors', initialPhotoFilename);
    assert(fs.existsSync(photoPathOnDisk), 'Photo file exists in /uploads/directors/ on disk');

    const photoMeta = await sharp(fs.readFileSync(photoPathOnDisk)).metadata();
    assert(photoMeta.format === 'webp', `Converted format is WebP (got ${photoMeta.format})`);
    assert(photoMeta.width === 800 && photoMeta.height === 800, `Cropped & resized to 800x800 (got ${photoMeta.width}x${photoMeta.height})`);

    // Verify public static URL is reachable
    const photoHttpRes = await fetch(`${BASE_URL}${createData.item.photo_url}`);
    assert(photoHttpRes.status === 200, 'Public photo HTTP endpoint returns 200 OK');

    // Verify public API returns the new director
    const publicRes1 = await fetch(`${BASE_URL}/api/directors`);
    const publicData1 = await publicRes1.json();
    const foundInPublic = publicData1.directors.find(d => d.id === newDirectorId);
    assert(!!foundInPublic && foundInPublic.name === 'Vikram Malhotra', 'New director appears in public GET /api/directors');

    // -------------------------------------------------------------------------
    // TEST 5: Update Director & Replace Photo (Verify Old Photo Cleaned Up)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. UPDATE DIRECTOR & REPLACE PHOTO ---');
    const validJpgBuffer = await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 3,
        background: { r: 37, g: 99, b: 235 }
      }
    }).jpeg().toBuffer();

    const boundary2 = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    let updateBodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary2}\r\nContent-Disposition: form-data; name="name"\r\n\r\nVikram M. Malhotra\r\n`),
      Buffer.from(`--${boundary2}\r\nContent-Disposition: form-data; name="role"\r\n\r\nCo-Founder & CTO\r\n`),
      Buffer.from(`--${boundary2}\r\nContent-Disposition: form-data; name="is_visible"\r\n\r\ntrue\r\n`),
      Buffer.from(`--${boundary2}\r\nContent-Disposition: form-data; name="photo"; filename="vikram_new.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      validJpgBuffer,
      Buffer.from(`\r\n--${boundary2}--\r\n`)
    ]);

    const updateRes = await fetch(`${BASE_URL}/admin/api/directors/${newDirectorId}`, {
      method: 'PUT',
      headers: {
        'Cookie': sessionCookie,
        'Origin': BASE_URL,
        'Content-Type': `multipart/form-data; boundary=${boundary2}`
      },
      body: updateBodyBuffer
    });

    const updateData = await updateRes.json();
    assert(updateRes.status === 200 && updateData.success === true, 'PUT /admin/api/directors/:id returns 200');
    assert(updateData.item.name === 'Vikram M. Malhotra', 'Director name updated successfully');
    assert(updateData.item.photo_filename !== initialPhotoFilename, 'New photo filename assigned');
    
    // Brief wait for Windows file handle release
    await new Promise(r => setTimeout(r, 400));
    assert(!fs.existsSync(photoPathOnDisk), 'OLD photo file was deleted from disk successfully');

    const newPhotoPathOnDisk = path.join(__dirname, '../uploads/directors', updateData.item.photo_filename);
    assert(fs.existsSync(newPhotoPathOnDisk), 'NEW photo file exists on disk');

    // -------------------------------------------------------------------------
    // TEST 6: Toggle Visibility (Hide and Show)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. TOGGLE VISIBILITY ---');
    const toggleHideRes = await fetch(`${BASE_URL}/admin/api/directors/${newDirectorId}/toggle-visibility`, {
      method: 'PATCH',
      headers: { 'Cookie': sessionCookie, 'Origin': BASE_URL }
    });
    const toggleHideData = await toggleHideRes.json();
    assert(toggleHideRes.status === 200 && toggleHideData.item.is_visible === false, 'Director hidden via toggle');

    // Check public API does NOT include hidden director
    const publicRes2 = await fetch(`${BASE_URL}/api/directors`);
    const publicData2 = await publicRes2.json();
    const hiddenInPublic = publicData2.directors.find(d => d.id === newDirectorId);
    assert(!hiddenInPublic, 'Hidden director does NOT appear in public GET /api/directors');

    // Toggle back to visible
    const toggleShowRes = await fetch(`${BASE_URL}/admin/api/directors/${newDirectorId}/toggle-visibility`, {
      method: 'PATCH',
      headers: { 'Cookie': sessionCookie, 'Origin': BASE_URL }
    });
    const toggleShowData = await toggleShowRes.json();
    assert(toggleShowRes.status === 200 && toggleShowData.item.is_visible === true, 'Director made visible again');

    // -------------------------------------------------------------------------
    // TEST 7: Reorder Directors
    // -------------------------------------------------------------------------
    console.log('\n--- 7. REORDER DIRECTORS ---');
    const currentListRes = await fetch(`${BASE_URL}/admin/api/directors`, {
      headers: { 'Cookie': sessionCookie }
    });
    const currentListData = await currentListRes.json();
    const currentIds = currentListData.items.map(d => d.id);
    const reversedIds = [...currentIds].reverse();

    const reorderRes = await fetch(`${BASE_URL}/admin/api/directors/reorder`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Origin': BASE_URL,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ order: reversedIds })
    });
    const reorderData = await reorderRes.json();
    assert(reorderRes.status === 200 && reorderData.success === true, 'POST /admin/api/directors/reorder succeeds');

    const verifyListRes = await fetch(`${BASE_URL}/admin/api/directors`, {
      headers: { 'Cookie': sessionCookie }
    });
    const verifyListData = await verifyListRes.json();
    assert(verifyListData.items[0].id === reversedIds[0], `First director is now ID ${reversedIds[0]}`);

    // Restore original order
    await fetch(`${BASE_URL}/admin/api/directors/reorder`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Origin': BASE_URL,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ order: currentIds })
    });

    // -------------------------------------------------------------------------
    // TEST 8: Delete Director (Verify Photo Cleaned Up)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. DELETE DIRECTOR ---');
    const deleteRes = await fetch(`${BASE_URL}/admin/api/directors/${newDirectorId}`, {
      method: 'DELETE',
      headers: { 'Cookie': sessionCookie, 'Origin': BASE_URL }
    });
    const deleteData = await deleteRes.json();
    assert(deleteRes.status === 200 && deleteData.success === true, 'DELETE /admin/api/directors/:id succeeds');
    
    // Brief wait for Windows file handle release
    await new Promise(r => setTimeout(r, 400));
    assert(!fs.existsSync(newPhotoPathOnDisk), 'Director photo deleted from disk on director deletion');

    const publicRes3 = await fetch(`${BASE_URL}/api/directors`);
    const publicData3 = await publicRes3.json();
    assert(!publicData3.directors.find(d => d.id === newDirectorId), 'Deleted director no longer in public API');

    // -------------------------------------------------------------------------
    // TEST 9: Reject Fake Image (PDF renamed to .jpg) & 10MB Image
    // -------------------------------------------------------------------------
    console.log('\n--- 9. MALICIOUS & OVERSIZED FILE REJECTIONS ---');

    // 9a. PDF disguised as .jpg
    const fakeJpgBuffer = Buffer.from('%PDF-1.4 Fake PDF Content That Claims To Be A JPG');
    const boundaryFake = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    let fakeBody = Buffer.concat([
      Buffer.from(`--${boundaryFake}\r\nContent-Disposition: form-data; name="name"\r\n\r\nFake Director\r\n`),
      Buffer.from(`--${boundaryFake}\r\nContent-Disposition: form-data; name="role"\r\n\r\nDirector\r\n`),
      Buffer.from(`--${boundaryFake}\r\nContent-Disposition: form-data; name="photo"; filename="fake_pdf.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      fakeJpgBuffer,
      Buffer.from(`\r\n--${boundaryFake}--\r\n`)
    ]);

    const fakeRes = await fetch(`${BASE_URL}/admin/api/directors`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Origin': BASE_URL,
        'Content-Type': `multipart/form-data; boundary=${boundaryFake}`
      },
      body: fakeBody
    });
    const fakeData = await fakeRes.json();
    assert(fakeRes.status === 400 && fakeData.success === false, 'PDF renamed to .jpg is REJECTED with 400');

    // 9b. 10MB Image
    const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
    const boundaryOver = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    let overBody = Buffer.concat([
      Buffer.from(`--${boundaryOver}\r\nContent-Disposition: form-data; name="name"\r\n\r\nBig Director\r\n`),
      Buffer.from(`--${boundaryOver}\r\nContent-Disposition: form-data; name="role"\r\n\r\nDirector\r\n`),
      Buffer.from(`--${boundaryOver}\r\nContent-Disposition: form-data; name="photo"; filename="giant.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      oversizedBuffer,
      Buffer.from(`\r\n--${boundaryOver}--\r\n`)
    ]);

    const overRes = await fetch(`${BASE_URL}/admin/api/directors`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'Origin': BASE_URL,
        'Content-Type': `multipart/form-data; boundary=${boundaryOver}`
      },
      body: overBody
    });
    const overData = await overRes.json();
    assert(overRes.status === 400 && overData.success === false, '10 MB image is REJECTED with 400 (exceeds 3MB limit)');

    // -------------------------------------------------------------------------
    // TEST 10: Dynamic Scale Test (2 directors vs 6 directors)
    // -------------------------------------------------------------------------
    console.log('\n--- 10. DYNAMIC SCALE TEST (2 vs 6 DIRECTORS) ---');
    const scaleCurrentRes = await fetch(`${BASE_URL}/admin/api/directors`, { headers: { 'Cookie': sessionCookie } });
    const scaleCurrentData = await scaleCurrentRes.json();
    for (const d of scaleCurrentData.items) {
      if (!d.is_visible) {
        await fetch(`${BASE_URL}/admin/api/directors/${d.id}/toggle-visibility`, { method: 'PATCH', headers: { 'Cookie': sessionCookie, 'Origin': BASE_URL } });
      }
    }

    const visibleListRes = await fetch(`${BASE_URL}/admin/api/directors`, { headers: { 'Cookie': sessionCookie } });
    const visibleListData = await visibleListRes.json();
    const toggleId1 = visibleListData.items[visibleListData.items.length - 1].id;
    const toggleId2 = visibleListData.items[visibleListData.items.length - 2].id;

    // Hide 2 directors -> verify 2 visible
    await fetch(`${BASE_URL}/admin/api/directors/${toggleId1}/toggle-visibility`, { method: 'PATCH', headers: { 'Cookie': sessionCookie, 'Origin': BASE_URL } });
    await fetch(`${BASE_URL}/admin/api/directors/${toggleId2}/toggle-visibility`, { method: 'PATCH', headers: { 'Cookie': sessionCookie, 'Origin': BASE_URL } });

    const scale2Res = await fetch(`${BASE_URL}/api/directors`);
    const scale2Data = await scale2Res.json();
    assert(scale2Data.directors.length === 2, `Tested with 2 visible directors: count = ${scale2Data.directors.length}`);

    // Show them back
    await fetch(`${BASE_URL}/admin/api/directors/${toggleId1}/toggle-visibility`, { method: 'PATCH', headers: { 'Cookie': sessionCookie, 'Origin': BASE_URL } });
    await fetch(`${BASE_URL}/admin/api/directors/${toggleId2}/toggle-visibility`, { method: 'PATCH', headers: { 'Cookie': sessionCookie, 'Origin': BASE_URL } });

    // Add 2 extra directors -> total 6
    const b1 = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    await fetch(`${BASE_URL}/admin/api/directors`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookie, 'Origin': BASE_URL, 'Content-Type': `multipart/form-data; boundary=${b1}` },
      body: Buffer.from(`--${b1}\r\nContent-Disposition: form-data; name="name"\r\n\r\nDirector Five\r\n--${b1}\r\nContent-Disposition: form-data; name="role"\r\n\r\nDirector\r\n--${b1}--\r\n`)
    });

    const b2 = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    await fetch(`${BASE_URL}/admin/api/directors`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookie, 'Origin': BASE_URL, 'Content-Type': `multipart/form-data; boundary=${b2}` },
      body: Buffer.from(`--${b2}\r\nContent-Disposition: form-data; name="name"\r\n\r\nDirector Six\r\n--${b2}\r\nContent-Disposition: form-data; name="role"\r\n\r\nDirector\r\n--${b2}--\r\n`)
    });

    const scale6Res = await fetch(`${BASE_URL}/api/directors`);
    const scale6Data = await scale6Res.json();
    assert(scale6Data.directors.length === 6, `Tested with 6 visible directors: count = ${scale6Data.directors.length}`);

    // Clean up the 2 extra directors
    const listForCleanup = await (await fetch(`${BASE_URL}/admin/api/directors`, { headers: { 'Cookie': sessionCookie } })).json();
    for (const d of listForCleanup.items) {
      if (d.name === 'Director Five' || d.name === 'Director Six') {
        await fetch(`${BASE_URL}/admin/api/directors/${d.id}`, { method: 'DELETE', headers: { 'Cookie': sessionCookie, 'Origin': BASE_URL } });
      }
    }

    const finalPublic = await (await fetch(`${BASE_URL}/api/directors`)).json();
    assert(finalPublic.directors.length === 4, 'Restored to clean 4 seeded directors');

    // -------------------------------------------------------------------------
    // TEST 11: Privacy & Security Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 11. PRIVACY & SECURITY VERIFICATION ---');
    // Ensure /uploads root or /uploads/resumes cannot be accessed statically
    const resumeTestPath = path.join(__dirname, '../uploads/test_private_doc.pdf');
    fs.writeFileSync(resumeTestPath, 'Private Resume Content');

    const privateRes = await fetch(`${BASE_URL}/uploads/test_private_doc.pdf`);
    assert(privateRes.status === 404, 'Root /uploads is NOT statically served (returns 404)');

    try { fs.unlinkSync(resumeTestPath); } catch {}

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification();
