const Notification = require('../model/Notification');

const getNotifications = async (req, res) => {
    try {
        const userId = req.params.userId;
        const notifications = await Notification.find({ recipient: userId })
            .populate('sender', 'name username profile')
            .sort({ createdAt: -1 })
            .limit(30);
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

const markAsRead = async (req, res) => {
    try {
        const userId = req.params.userId;
        await Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true });
        res.json({ message: 'Notifications marked as read' });
    } catch (error) {
        console.error('Error updating notifications:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
};

const markSenderAsRead = async (req, res) => {
    try {
        const userId = req.params.userId;
        const User = require('../model/User');
        const senderUsername = req.body.senderUsername;
        
        const sender = await User.findOne({ username: senderUsername });
        if (sender) {
            await Notification.updateMany({ recipient: userId, sender: sender._id, isRead: false }, { isRead: true });
        }
        res.json({ message: 'Notifications from sender marked as read' });
    } catch (error) {
        console.error('Error clearing sender notifications:', error);
        res.status(500).json({ error: 'Failed to update sender notifications' });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.findByIdAndDelete(id);
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete notification' });
    }
};

module.exports = { getNotifications, markAsRead, markSenderAsRead, deleteNotification };
