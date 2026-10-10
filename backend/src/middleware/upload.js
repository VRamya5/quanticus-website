const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false);

// ---------------------------------------------------------------------------
// Resume Upload Handler (Memory Storage, 4MB Limit)
// ---------------------------------------------------------------------------
const ALLOWED_RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const ALLOWED_RESUME_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream' // Some browsers send octet-stream for docx/pdf
];

function validatePdfMagicBytes(buffer) {
  if (!buffer || buffer.length < 5) return false;
  // %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2D;
}

function resumeFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  const isValidExt = ALLOWED_RESUME_EXTENSIONS.includes(ext);
  const isValidMime = ALLOWED_RESUME_MIMES.includes(mime) || isValidExt;

  if (isValidExt && isValidMime) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only PDF, DOC, and DOCX documents are accepted.');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
}

const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024 // 4 MB limit (compatible with Vercel proxy payload limits)
  },
  fileFilter: resumeFileFilter
}).single('resume');

function handleResumeUpload(req, res, next) {
  uploadResume(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds 4MB limit. Please upload a smaller file.'
        });
      }
      if (err.code === 'INVALID_FILE_TYPE' || (err.message && err.message.includes('Invalid file type'))) {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      return res.status(400).json({
        success: false,
        error: `File upload error: ${err.message}`
      });
    }

    // Secondary buffer validation if PDF
    if (req.file) {
      const ext = path.extname(req.file.originalname || '').toLowerCase();
      if (ext === '.pdf') {
        if (!validatePdfMagicBytes(req.file.buffer)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid PDF document. File content does not match standard PDF structure.'
          });
        }
      }
    }

    next();
  });
}

// ---------------------------------------------------------------------------
// Director Photo Upload & In-Memory Processing (Memory Storage -> Magic Bytes -> Sharp WebP)
// ---------------------------------------------------------------------------
const ALLOWED_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function validateImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return 'png';
  }

  // WebP: RIFF header (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024 // 3 MB max
  }
}).single('photo');

function handleDirectorPhotoUpload(req, res, next) {
  photoUpload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'Photo size exceeds 3MB limit. Please upload a smaller image.'
        });
      }
      return res.status(400).json({
        success: false,
        error: `Photo upload error: ${err.message}`
      });
    }
    next();
  });
}

/**
 * Validates extension + magic bytes, crops to square (800x800), converts to WebP, strips metadata.
 * Returns in-memory WebP Buffer (no disk write).
 * @param {Buffer} buffer 
 * @param {string} originalName 
 * @returns {Promise<{ buffer: Buffer, mime: string }>}
 */
async function processDirectorPhotoToBuffer(buffer, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  if (!ALLOWED_PHOTO_EXTENSIONS.includes(ext)) {
    throw new Error('Invalid file type. Only JPG, PNG, and WebP images are accepted.');
  }

  const detectedType = validateImageMagicBytes(buffer);
  if (!detectedType) {
    throw new Error('Invalid image file format. The file content does not match a valid JPG, PNG, or WebP image.');
  }

  const processedBuffer = await sharp(buffer)
    .rotate() // Auto-orient from EXIF if present
    .resize(800, 800, {
      fit: 'cover',
      position: 'center'
    })
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  return {
    buffer: processedBuffer,
    mime: 'image/webp'
  };
}

module.exports = {
  handleResumeUpload,
  handleDirectorPhotoUpload,
  processDirectorPhotoToBuffer,
  validatePdfMagicBytes,
  validateImageMagicBytes
};
