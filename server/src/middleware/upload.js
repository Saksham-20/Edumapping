// server/src/middleware/upload.js
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Define allowed file types. Both the declared MIME type and the extension
  // must match: the extension is what decides how the file is served later,
  // so nothing that a browser would render as a page (.html, .svg, .js) can
  // get in under an innocent-looking MIME type.
  const allowedTypes = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
  };

  const fileExtension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;

  if (allowedTypes[mimeType] && allowedTypes[mimeType].includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('This file type is not accepted. Upload a PDF, a Word document, or a JPG, PNG or WebP image.'), false);
  }
};

// MIME types in words for error messages: "a PDF" rather than "application/pdf".
const TYPE_WORDS = {
  'application/pdf': 'a PDF',
  'application/msword': 'a Word document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'a Word document',
  'image/jpeg': 'a JPG image',
  'image/jpg': 'a JPG image',
  'image/png': 'a PNG image',
  'image/webp': 'a WebP image'
};
const describeTypes = (types) => {
  const words = [...new Set(types.map((t) => TYPE_WORDS[t] || t))];
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}` : words[0];
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 5 // Maximum 5 files per request
  },
  fileFilter: fileFilter
});

// Specific upload configurations
const uploadSingle = (fieldName, allowedTypes = []) => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);
    
    singleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'File Too Large',
            message: `This file is larger than ${Math.round((parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024) / (1024 * 1024))} MB. Upload a smaller file.`
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(413).json({
            error: 'Too Many Files',
            message: 'Too many files uploaded'
          });
        }
        return res.status(400).json({
          error: 'Upload Error',
          message: err.message
        });
      } else if (err) {
        return res.status(400).json({
          error: 'File Error',
          message: err.message
        });
      }

      // Additional type checking if specified
      if (allowedTypes.length > 0 && req.file) {
        if (!allowedTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            error: 'Invalid File Type',
            message: `Upload ${describeTypes(allowedTypes)}.`
          });
        }
      }

      next();
    });
  };
};

const uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    const multipleUpload = upload.array(fieldName, maxCount);
    
    multipleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'File Too Large',
            message: 'One or more files exceed the maximum size limit'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(413).json({
            error: 'Too Many Files',
            message: `Maximum ${maxCount} files allowed`
          });
        }
        return res.status(400).json({
          error: 'Upload Error',
          message: err.message
        });
      } else if (err) {
        return res.status(400).json({
          error: 'File Error',
          message: err.message
        });
      }

      next();
    });
  };
};

// Specific upload types
const uploadResume = uploadSingle('resume', ['application/pdf']);
const uploadProfilePicture = uploadSingle('profilePicture', ['image/jpeg', 'image/png', 'image/webp']);
// Generic upload used by POST /api/files/upload.
const uploadFile = uploadSingle('file');
const uploadDocument = uploadSingle('document');
const uploadMultipleDocuments = uploadMultiple('documents', 3);

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadResume,
  uploadProfilePicture,
  uploadFile,
  uploadDocument,
  uploadMultipleDocuments
};