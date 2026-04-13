const express = require('express');
const {
  createAlbum,
  getAlbumsByUser,
  getAlbumDetails,
  addAlbumItems,
  respondAlbumInvite
} = require('../controllers/albumController');
const { requireObjectIdParams } = require('../middlewares/apiGuards');

const router = express.Router();

router.post('/', createAlbum);
router.get('/user/:userId', requireObjectIdParams(['userId']), getAlbumsByUser);
router.get('/:albumId/view/:userId', requireObjectIdParams(['albumId', 'userId']), getAlbumDetails);
router.post('/:albumId/items', requireObjectIdParams(['albumId']), addAlbumItems);
router.put('/:albumId/invite/respond', requireObjectIdParams(['albumId']), respondAlbumInvite);

module.exports = router;
