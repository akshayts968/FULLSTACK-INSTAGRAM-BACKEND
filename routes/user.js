const express = require('express');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { getUser, updateUser, followUser, fetchAllUsers, updatePassUser, uploadStory, deleteStory, uploadHighlight, deleteHighlight, deleteHighlightMedia, respondFollowRequest, getFollowList } = require('../controllers/userController');
const { requireObjectIdParams, validatePaginationQuery } = require('../middlewares/apiGuards');
const upload = require ('../config/upload')
const router = express.Router();

router.get('/by-username/:username', require('../controllers/userController').getUserByUsername);
router.get('/all', fetchAllUsers);
router.get('/search/all', require('../controllers/userController').searchUsers);
router.get('/:id', requireObjectIdParams(['id']), getUser);
router.put('/:id/forgotten', requireObjectIdParams(['id']), updatePassUser);
//app.post('/:id/edit',upload.single('profile') , 
router.put('/:id/edit', requireObjectIdParams(['id']), upload.single('profile'), updateUser);
router.post('/:id/story', requireObjectIdParams(['id']), upload.array('story', 10), uploadStory);
router.delete('/:id/story/:storyId', requireObjectIdParams(['id', 'storyId']), deleteStory);
router.post('/:id/highlight', requireObjectIdParams(['id']), upload.single('highlight'), uploadHighlight);
router.delete('/:id/highlight/:groupName/media/:mediaIndex', requireObjectIdParams(['id']), deleteHighlightMedia);
router.delete('/:id/highlight/:groupName', requireObjectIdParams(['id']), deleteHighlight);
router.put('/:id/request/:requesterId', requireObjectIdParams(['id', 'requesterId']), respondFollowRequest);
router.get('/:id/follows', requireObjectIdParams(['id']), validatePaginationQuery, getFollowList);
//app.put("/user/:id/:uId", 
router.put('/:id/:uId', requireObjectIdParams(['id', 'uId']), followUser);

module.exports = router;
