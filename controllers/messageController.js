const Message = require('../model/Message');
const Notification = require('../model/Notification');
const User = require('../model/User');

const sendMessage = async (req, res) => {
    const { sendId, rId } = req.params;
    const { content, media } = req.body;
    try {
        const message = new Message({
            sender: sendId,
            receiver: rId,
            content: content || "",
            media: media || []
        });
        await message.save();
        
        const senderUser = await User.findById(sendId);
        if (senderUser) {
            const notif = new Notification({
                recipient: rId,
                sender: sendId,
                type: 'message',
                content: content ? (content.length > 25 ? content.slice(0, 25) + "..." : content) : "Sent an attachment",
                link: `/message/${senderUser.username}`
            });
            await notif.save();
        }

        res.json(message);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

const getMessages = async (req, res) => {
    const { userId, receiverId } = req.params;
    try {
        const messages = await Message.find({
            $or: [
                { sender: userId, receiver: receiverId },
                { sender: receiverId, receiver: userId }
            ]
        }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

const deleteMessage = async (req, res) => {
    await Message.findByIdAndDelete(req.params.messageId);
    res.status(200).json({ message: 'Message deleted successfully' });
};

const msgImage = async (req, res) => {
    await Message.findByIdAndDelete(req.params.messageId);
    res.status(200).json({ message: 'Message deleted successfully' });
};
module.exports = { sendMessage, getMessages, deleteMessage };
