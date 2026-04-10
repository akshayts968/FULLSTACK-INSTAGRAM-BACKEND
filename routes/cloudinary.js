const express = require('express');
const {createImage} = require('../controllers/cloudinaryController');
const upload = require ('../config/upload')

const router = express.Router();
//app.get("/fetchcomment", 
//router.get('/',  allComment);router.post('/upload', ,
router.post('/upload',upload.array('Image', 10),createImage);
/*router.get('/:id', getComments);
router.put('/:commentId',editComment);
router.delete('/:commentId',deleteComment);*/

module.exports = router;
