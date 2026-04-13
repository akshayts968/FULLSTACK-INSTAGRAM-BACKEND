const express = require('express');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { sendMessage, getMessages, deleteMessage, respondMessageRequest } = require('../controllers/messageController');
const { requireObjectIdParams, validatePaginationQuery } = require('../middlewares/apiGuards');

const router = express.Router();

router.post('/:sendId/:rId', requireObjectIdParams(['sendId', 'rId']), sendMessage);
router.get('/:userId/:receiverId', requireObjectIdParams(['userId', 'receiverId']), validatePaginationQuery, getMessages);
router.put('/request/:requestId', requireObjectIdParams(['requestId']), respondMessageRequest);
router.delete('/:messageId', requireObjectIdParams(['messageId']), deleteMessage);

module.exports = router;
