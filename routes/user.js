const express = require('express');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { getUser, updateUser, followUser, fetchAllUsers,updatePassUser } = require('../controllers/userController');
const upload = require ('../config/upload')
const router = express.Router();

router.get('/:id', getUser);
router.get('/by-username/:username', require('../controllers/userController').getUserByUsername);
router.put('/:id/forgotten', updatePassUser);
//app.post('/:id/edit',upload.single('profile') , 
router.put('/:id/edit',upload.single('profile'), updateUser);
router.post('/:id/story', upload.single('story'), require('../controllers/userController').uploadStory);
router.post('/:id/highlight', upload.single('highlight'), require('../controllers/userController').uploadHighlight);
//app.put("/user/:id/:uId", 
router.put('/:id/:uId',followUser);
router.get('/all', fetchAllUsers);
router.get('/search/all', require('../controllers/userController').searchUsers);

module.exports = router;
