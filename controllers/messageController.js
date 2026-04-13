const Message = require('../model/Message');
const Notification = require('../model/Notification');
const User = require('../model/User');
const MessageRequest = require('../model/MessageRequest');
const mongoose = require('mongoose');

const sendMessage = async (req, res) => {
    const { sendId, rId } = req.params;
    const { content, media } = req.body;
    try {
        const senderUser = await User.findById(sendId).select('username');
        const recipientUser = await User.findById(rId).select('followers');
        if (!senderUser || !recipientUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const senderIdStr = String(sendId);
        const senderFollowsRecipient = (recipientUser.followers || []).some((id) => String(id) === senderIdStr);

        let requestDoc = await MessageRequest.findOne({
            $or: [
                { requester: sendId, recipient: rId },
                { requester: rId, recipient: sendId }
            ]
        });

        // Auto-accept request when recipient replies back in chat.
        if (requestDoc && requestDoc.status === 'pending' && String(requestDoc.requester) === String(rId) && String(requestDoc.recipient) === String(sendId)) {
            requestDoc.status = 'accepted';
            await requestDoc.save();
        }

        const hasAcceptedRequest = requestDoc && requestDoc.status === 'accepted';

        if (!senderFollowsRecipient && !hasAcceptedRequest) {
            const senderToRecipientCount = await Message.countDocuments({ sender: sendId, receiver: rId });
            if (senderToRecipientCount >= 1) {
                return res.status(403).json({
                    code: 'MESSAGE_REQUEST_LIMIT',
                    message: 'You can only send one message request until they accept.'
                });
            }

            if (!requestDoc) {
                requestDoc = await MessageRequest.create({
                    requester: sendId,
                    recipient: rId,
                    status: 'pending'
                });
            } else if (requestDoc.status === 'rejected' && String(requestDoc.requester) === String(sendId) && String(requestDoc.recipient) === String(rId)) {
                requestDoc.status = 'pending';
                await requestDoc.save();
            }
        }

        const message = new Message({
            sender: sendId,
            receiver: rId,
            content: content || "",
            media: media || []
        });
        await message.save();
        
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
        const offset = Number(req.query.offset || 0);
        const limit = Number(req.query.limit || 20);
        const safeOffset = Number.isNaN(offset) ? 0 : Math.max(0, offset);
        const safeLimit = Number.isNaN(limit) ? 20 : Math.max(1, Math.min(50, limit));

        const query = {
            $or: [
                { sender: userId, receiver: receiverId },
                { sender: receiverId, receiver: userId }
            ]
        };

        const total = await Message.countDocuments(query);
        const messages = await Message.find({
            ...query
        })
            .sort({ timestamp: -1 })
            .skip(safeOffset)
            .limit(safeLimit);

        const orderedMessages = messages.reverse();
        const hasMore = safeOffset + messages.length < total;
        let requestStatus = null;
        if (mongoose.Types.ObjectId.isValid(userId) && mongoose.Types.ObjectId.isValid(receiverId)) {
            requestStatus = await MessageRequest.findOne({
                $or: [
                    { requester: userId, recipient: receiverId },
                    { requester: receiverId, recipient: userId }
                ]
            }).select('_id requester recipient status');
        }
        res.json({ messages: orderedMessages, hasMore, total, requestStatus });
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

const respondMessageRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { userId, action } = req.body;
        const requestDoc = await MessageRequest.findById(requestId);
        if (!requestDoc) return res.status(404).json({ error: 'Request not found' });
        if (String(requestDoc.recipient) !== String(userId)) {
            return res.status(403).json({ error: 'Only recipient can respond to this request' });
        }
        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }
        requestDoc.status = action === 'accept' ? 'accepted' : 'rejected';
        await requestDoc.save();
        return res.json({ requestStatus: requestDoc });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to update message request' });
    }
};

module.exports = { sendMessage, getMessages, deleteMessage, respondMessageRequest };
