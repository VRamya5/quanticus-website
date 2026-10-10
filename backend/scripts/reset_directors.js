const pool = require('../src/db/pool');
const { generateRefCode } = require('../src/utils/refCode');

async function resetDirectors() {
  try {
    await pool.query('DELETE FROM directors WHERE name NOT IN ($1, $2, $3, $4);', [
      'Dileep Keerthi Kumar',
      'Parameswaran Sathesh',
      'Srinivasan Anand',
      'Anish Gupta'
    ]);

    const existing = await pool.query('SELECT name FROM directors;');
    const names = existing.rows.map(r => r.name);

    const defaultDirs = [
      { name: 'Dileep Keerthi Kumar', role: 'Director', sort_order: 0 },
      { name: 'Parameswaran Sathesh', role: 'Director', sort_order: 1 },
      { name: 'Srinivasan Anand', role: 'Director', sort_order: 2 },
      { name: 'Anish Gupta', role: 'Director', sort_order: 3 }
    ];

    for (const d of defaultDirs) {
      if (!names.includes(d.name)) {
        const code = generateRefCode('DIR');
        await pool.query(
          'INSERT INTO directors (ref_code, name, role, sort_order, is_visible) VALUES ($1, $2, $3, $4, true);',
          [code, d.name, d.role, d.sort_order]
        );
        console.log('Inserted missing director:', d.name);
      }
    }

    for (let i = 0; i < defaultDirs.length; i++) {
      await pool.query('UPDATE directors SET sort_order = $1, is_visible = true WHERE name = $2;', [i, defaultDirs[i].name]);
    }

    const finalCheck = await pool.query('SELECT id, ref_code, name, role, sort_order, is_visible FROM directors ORDER BY sort_order ASC;');
    console.log('Clean 4 DB directors:');
    console.table(finalCheck.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error resetting directors:', err);
    process.exit(1);
  }
}

resetDirectors();
