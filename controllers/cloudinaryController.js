const createImage = async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }
  
      console.log('Received files for upload');
      const cloudinary = require('../config/cloudinary');
  
      const streamUpload = (file) => {
          return new Promise((resolve, reject) => {
              let stream = cloudinary.uploader.upload_stream(
                  { folder: "wanderlust_DEV", resource_type: "auto" },
                  (error, result) => {
                      if (result) resolve(result);
                      else reject(error);
                  }
              );
              stream.end(file.buffer);
          });
      };
      
      const uploadedUrls = [];
      for (const file of req.files) {
        if (!file.buffer) continue;
        const uploadResult = await streamUpload(file);
        uploadedUrls.push(uploadResult.secure_url);
      }
  
      // Respond with uploaded URLs
      res.json({ urls: uploadedUrls });
    } catch (error) {
      console.error('Error uploading files:', error);
      res.status(500).json({ error: 'File upload failed' });
    }
  };
  
 
module.exports = { createImage };