const express = require('express');
const { getNotifications, markAsRead, markSenderAsRead, deleteNotification } = require('../controllers/notificationController');

const router = express.Router();

router.get('/:userId', getNotifications);
router.put('/:userId/read', markAsRead);
router.put('/:userId/read-sender', markSenderAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
