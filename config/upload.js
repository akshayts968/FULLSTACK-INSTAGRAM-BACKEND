const multer = require('multer');

// Store file in memory to securely proxy stream it to Cloudinary later safely
const storage = multer.memoryStorage();

// Set file size limit to 50MB for video support
const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } 
});

module.exports = upload;