const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const pool = require('./pool');
const { generateRefCode } = require('../utils/refCode');

async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log('Starting database setup and migrations...');

    await client.query('BEGIN');

    // 1. Roles Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        ref_code TEXT,
        title VARCHAR(255) NOT NULL,
        department VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        tag VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'closed' CHECK (status IN ('open', 'closed')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS ref_code TEXT;
    `);

    // 2. Client Requests Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_requests (
        id SERIAL PRIMARY KEY,
        ref_code TEXT,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        requirement_area VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'read', 'handled')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE client_requests ADD COLUMN IF NOT EXISTS ref_code TEXT;
    `);

    // 3. Applications Table (with in-database BYTEA resume storage)
    await client.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        ref_code TEXT,
        role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
        role_title VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        cover_message TEXT,
        resume_filename VARCHAR(255),
        resume_original_name VARCHAR(255) NOT NULL,
        resume_data BYTEA,
        resume_mime VARCHAR(100),
        resume_size INTEGER,
        status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'shortlisted', 'rejected')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure all columns exist for existing database instances
    await client.query(`
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS ref_code TEXT;
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS resume_data BYTEA;
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS resume_mime VARCHAR(100);
      ALTER TABLE applications ADD COLUMN IF NOT EXISTS resume_size INTEGER;
      ALTER TABLE applications ALTER COLUMN resume_filename DROP NOT NULL;
    `);

    // 4. Admins Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Connect PG Simple Session Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" VARCHAR NOT NULL COLLATE "default",
        "sess" JSON NOT NULL,
        "expire" TIMESTAMP(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

    // 6. Seed Roles if table is empty
    const roleCountRes = await client.query('SELECT COUNT(*) AS count FROM roles;');
    const roleCount = parseInt(roleCountRes.rows[0].count, 10);

    if (roleCount === 0) {
      console.log('Seeding initial roles from existing Careers section...');
      const seedRoles = [
        {
          title: 'Software Developer',
          department: 'Engineering & Development',
          description: 'Build and maintain web applications, internal tools, and backend services used across our group businesses.',
          tag: 'Engineering',
          status: 'open'
        },
        {
          title: 'IT Support',
          department: 'Support & Infrastructure',
          description: 'Handle hardware, system setups, network troubleshooting, and day-to-day technical assistance for our teams.',
          tag: 'Operations',
          status: 'closed'
        },
        {
          title: 'Delivery Manager',
          department: 'Project & Delivery Leadership',
          description: 'Keep projects on track, coordinate between business stakeholders and engineers, and ensure smooth delivery.',
          tag: 'Management',
          status: 'closed'
        },
        {
          title: 'Internships',
          department: 'Emerging Talent & Graduates',
          description: 'Work alongside our developers on live systems and build practical software engineering experience.',
          tag: 'Early Career',
          status: 'open'
        }
      ];

      for (const role of seedRoles) {
        const code = generateRefCode('ROLE');
        await client.query(
          `INSERT INTO roles (ref_code, title, department, description, tag, status)
           VALUES ($1, $2, $3, $4, $5, $6);`,
          [code, role.title, role.department, role.description, role.tag, role.status]
        );
      }
      console.log(`Seeded ${seedRoles.length} default roles.`);
    }

    // 7. Migration: Backfill ref_code for any existing rows that lack one
    const unassignedRoles = await client.query('SELECT id, created_at FROM roles WHERE ref_code IS NULL;');
    for (const r of unassignedRoles.rows) {
      const code = generateRefCode('ROLE', r.created_at ? new Date(r.created_at) : new Date());
      await client.query('UPDATE roles SET ref_code = $1 WHERE id = $2;', [code, r.id]);
    }

    const unassignedRequests = await client.query('SELECT id, created_at FROM client_requests WHERE ref_code IS NULL;');
    for (const req of unassignedRequests.rows) {
      const code = generateRefCode('REQ', req.created_at ? new Date(req.created_at) : new Date());
      await client.query('UPDATE client_requests SET ref_code = $1 WHERE id = $2;', [code, req.id]);
    }

    const unassignedApps = await client.query('SELECT id, created_at FROM applications WHERE ref_code IS NULL;');
    for (const a of unassignedApps.rows) {
      const code = generateRefCode('APP', a.created_at ? new Date(a.created_at) : new Date());
      await client.query('UPDATE applications SET ref_code = $1 WHERE id = $2;', [code, a.id]);
    }

    // Enforce NOT NULL and Unique Indexes on ref_code
    await client.query(`
      ALTER TABLE roles ALTER COLUMN ref_code SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS roles_ref_code_idx ON roles(ref_code);

      ALTER TABLE client_requests ALTER COLUMN ref_code SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS client_requests_ref_code_idx ON client_requests(ref_code);

      ALTER TABLE applications ALTER COLUMN ref_code SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS applications_ref_code_idx ON applications(ref_code);
    `);

    // 8. Directors Table (with in-database BYTEA photo storage)
    await client.query(`
      CREATE TABLE IF NOT EXISTS directors (
        id SERIAL PRIMARY KEY,
        ref_code TEXT,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        photo_filename VARCHAR(255),
        photo_data BYTEA,
        photo_mime VARCHAR(50) DEFAULT 'image/webp',
        photo_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_visible BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE directors ADD COLUMN IF NOT EXISTS ref_code TEXT;
      ALTER TABLE directors ADD COLUMN IF NOT EXISTS photo_filename VARCHAR(255);
      ALTER TABLE directors ADD COLUMN IF NOT EXISTS photo_data BYTEA;
      ALTER TABLE directors ADD COLUMN IF NOT EXISTS photo_mime VARCHAR(50) DEFAULT 'image/webp';
      ALTER TABLE directors ADD COLUMN IF NOT EXISTS photo_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE directors ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE directors ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE directors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);

    // Seed Directors if table is empty
    const directorCountRes = await client.query('SELECT COUNT(*) AS count FROM directors;');
    const directorCount = parseInt(directorCountRes.rows[0].count, 10);

    if (directorCount === 0) {
      console.log('Seeding initial directors from existing Directors section...');
      const seedDirectors = [
        { name: 'Dileep Keerthi Kumar', role: 'Director', sort_order: 0 },
        { name: 'Parameswaran Sathesh', role: 'Director', sort_order: 1 },
        { name: 'Srinivasan Anand', role: 'Director', sort_order: 2 },
        { name: 'Anish Gupta', role: 'Director', sort_order: 3 }
      ];

      for (const dir of seedDirectors) {
        const code = generateRefCode('DIR');
        await client.query(
          `INSERT INTO directors (ref_code, name, role, photo_filename, photo_data, photo_mime, photo_updated_at, sort_order, is_visible)
           VALUES ($1, $2, $3, NULL, NULL, 'image/webp', CURRENT_TIMESTAMP, $4, true);`,
          [code, dir.name, dir.role, dir.sort_order]
        );
      }
      console.log(`Seeded ${seedDirectors.length} default directors.`);
    }

    const unassignedDirectors = await client.query('SELECT id, created_at FROM directors WHERE ref_code IS NULL;');
    for (const d of unassignedDirectors.rows) {
      const code = generateRefCode('DIR', d.created_at ? new Date(d.created_at) : new Date());
      await client.query('UPDATE directors SET ref_code = $1 WHERE id = $2;', [code, d.id]);
    }

    await client.query(`
      ALTER TABLE directors ALTER COLUMN ref_code SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS directors_ref_code_idx ON directors(ref_code);
      CREATE INDEX IF NOT EXISTS directors_sort_order_idx ON directors(sort_order);
    `);

    // 9. Safe Migration: Migrate any existing files on disk into database BYTEA
    const uploadsDir = path.join(__dirname, '../../../uploads');
    const directorsUploadsDir = path.join(uploadsDir, 'directors');

    if (fs.existsSync(uploadsDir)) {
      console.log('Checking for legacy files on disk to migrate to database...');
      
      // Migrate applications resumes
      const pendingResumes = await client.query(
        'SELECT id, resume_filename, resume_original_name FROM applications WHERE resume_filename IS NOT NULL AND resume_data IS NULL;'
      );

      for (const row of pendingResumes.rows) {
        const filePath = path.join(uploadsDir, row.resume_filename);
        if (fs.existsSync(filePath)) {
          const fileBuffer = fs.readFileSync(filePath);
          const ext = path.extname(row.resume_original_name || row.resume_filename).toLowerCase();
          const mime = ext === '.pdf' ? 'application/pdf' : (ext === '.doc' ? 'application/msword' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
          await client.query(
            'UPDATE applications SET resume_data = $1, resume_mime = $2, resume_size = $3 WHERE id = $4;',
            [fileBuffer, mime, fileBuffer.length, row.id]
          );
          console.log(`Migrated resume file to DB for application ID ${row.id}`);
        }
      }

      // Migrate director photos
      const pendingPhotos = await client.query(
        'SELECT id, photo_filename FROM directors WHERE photo_filename IS NOT NULL AND photo_data IS NULL;'
      );

      for (const row of pendingPhotos.rows) {
        const filePath = path.join(directorsUploadsDir, row.photo_filename);
        if (fs.existsSync(filePath)) {
          const fileBuffer = fs.readFileSync(filePath);
          await client.query(
            'UPDATE directors SET photo_data = $1, photo_mime = $2, photo_updated_at = CURRENT_TIMESTAMP WHERE id = $3;',
            [fileBuffer, 'image/webp', row.id]
          );
          console.log(`Migrated photo file to DB for director ID ${row.id}`);
        }
      }
    }

    // 10. Seed Admin if provided in env
    const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : null;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminEmail && adminPassword) {
      const adminCheck = await client.query('SELECT id FROM admins WHERE email = $1;', [adminEmail]);
      if (adminCheck.rows.length === 0) {
        console.log(`Creating initial admin account for ${adminEmail}...`);
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        await client.query(
          'INSERT INTO admins (email, password_hash) VALUES ($1, $2);',
          [adminEmail, passwordHash]
        );
        console.log('Admin account created successfully.');
      } else {
        console.log(`Admin account for ${adminEmail} already exists. Skipping.`);
      }
    }

    await client.query('COMMIT');
    console.log('Database schema, migrations, and initial data setup completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during database setup:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;
