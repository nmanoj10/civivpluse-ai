import multer from 'multer';
import path from 'path';
import os from 'os';
import { ApiError } from '../utils/ApiError';

// Maps allowed extensions to their valid MIME types
// Prevents disguised uploads like "malicious.php.jpg"
const EXTENSION_MIME_MAP: Record<string, string[]> = {
  '.jpg':  ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png':  ['image/png'],
  '.webp': ['image/webp'],
  '.gif':  ['image/gif'],
  '.mp4':  ['video/mp4'],
  '.mov':  ['video/quicktime'],
};

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
]);

// Store temporarily in OS temp dir — always deleted after ImageKit upload
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, os.tmpdir());
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

const fileFilter = (_req: any, file: any, cb: any) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimesForExt = EXTENSION_MIME_MAP[ext];

  // Reject unknown extensions
  if (!allowedMimesForExt) {
    return cb(new ApiError(400, `File extension '${ext}' is not allowed. Supported: jpg, png, webp, gif, mp4, mov`), false);
  }

  // Reject MIME type mismatch (catches disguised files)
  if (!allowedMimesForExt.includes(file.mimetype)) {
    return cb(new ApiError(400, `File MIME type '${file.mimetype}' does not match extension '${ext}'. Possible malicious upload.`), false);
  }

  // Reject unknown MIME types even if extension matches
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new ApiError(400, `Unsupported file format: ${file.mimetype}`), false);
  }

  cb(null, true);
};

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max (matches ImageKit free tier limit)
    files: 5,                    // Maximum 5 files per request
  },
  fileFilter,
});
