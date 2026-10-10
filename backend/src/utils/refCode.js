const crypto = require('crypto');

// Unambiguous alphabet (removes 0, O, 1, I, L to prevent human confusion)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function generateRandomPart(length = 4) {
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

function formatDatePart(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * Generates a unique reference code, e.g. REQ-20261007-K7M2
 * @param {string} prefix - 'REQ' | 'APP' | 'ROLE'
 * @param {Date} [date] - Optional date
 * @returns {string}
 */
function generateRefCode(prefix = 'REQ', date = new Date()) {
  const dateStr = formatDatePart(date);
  const randomStr = generateRandomPart(4);
  return `${prefix.toUpperCase()}-${dateStr}-${randomStr}`;
}

/**
 * Helper to generate a unique ref code with database collision retry
 * @param {object} client - pg pool or client
 * @param {string} tableName - 'client_requests' | 'applications' | 'roles'
 * @param {string} prefix - 'REQ' | 'APP' | 'ROLE'
 * @param {Date} [date]
 * @returns {Promise<string>}
 */
async function generateUniqueRefCode(client, tableName, prefix = 'REQ', date = new Date()) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRefCode(prefix, date);
    const check = await client.query(`SELECT 1 FROM ${tableName} WHERE ref_code = $1 LIMIT 1;`, [code]);
    if (check.rows.length === 0) {
      return code;
    }
  }
  // Fallback with timestamp extra entropy if ever needed
  return `${prefix.toUpperCase()}-${formatDatePart(date)}-${generateRandomPart(6)}`;
}

module.exports = {
  generateRefCode,
  generateUniqueRefCode,
  ALPHABET
};
