function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return false;
  // Standard RFC 5322 compatible email pattern
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

function sanitizeText(val) {
  if (typeof val !== 'string') return '';
  return val.trim();
}

function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (trimmed.length < 5 || trimmed.length > 50) return false;
  // Allow numbers, spaces, plus, hyphens, parentheses
  return /^[0-9+\-\s()]{5,50}$/.test(trimmed);
}

module.exports = {
  isValidEmail,
  sanitizeText,
  isValidPhone
};
