require('dotenv').config();
const http = require('http');
const app = require('./app2');
const connectDB = require('./config/db');

const server = http.createServer(app);
const PORT = process.env.PORT || 8080;
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Message = require('./model/Message');

const io = new Server(server, {
    cors: {
        origin: `${process.env.FrontEnd}`,
        methods: ["GET", "POST"],
    },
});

let onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('registerUser', (userId) => {
        onlineUsers.set(userId, socket.id);
        socket.userId = userId;
        io.emit('onlineUsers', Array.from(onlineUsers.keys()));

        // Notify user about messages delivered to them
        Message.updateMany(
            { receiver: userId, status: { $ne: 'read', $ne: 'delivered' } },
            { $set: { status: 'delivered' } }
        ).then(result => {
            if (result.modifiedCount > 0) {
                socket.broadcast.emit('messageStatusUpdate', {
                    receiver: userId,
                    status: 'delivered'
                });
            }
        }).catch(err => console.error(err));
    });

    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
    });
    socket.on('signal', ({ to, from, data }) => {
        io.to(to).emit('signal', { from, data });
    });
    socket.on('disconnect', () => {
        console.log('User disconnected');
        for (let [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                onlineUsers.delete(userId);
                break;
            }
        }
        io.emit('onlineUsers', Array.from(onlineUsers.keys()));
    });

    socket.on('message', (data) => {
        console.log('Received message:', data);
    });

    socket.on('sendMessage', (data) => {
        const { room, content } = data;
        console.log('sendMessage:', room, content);

        // 1. Forward the message to the receiver in the room
        socket.broadcast.to(room).emit('sendMessage', content);

        // 2. NEW: Tell the room the message was successfully delivered to the server/receiver
        io.to(room).emit('messageStatusUpdate', {
            messageId: content._id,
            sender: content.sender,
            receiver: content.receiver,
            status: 'delivered'
        });
    });

    // 3. NEW: Listen for the frontend telling us the chat was opened/read
    socket.on('markMessageRead', async ({ room, senderId, receiverId }) => {
        console.log(`Marking messages as read in room ${room}`);
        try {
            if (!senderId || !receiverId) return;
            const senderObjId = new mongoose.Types.ObjectId(senderId);
            const receiverObjId = new mongoose.Types.ObjectId(receiverId);

            const result = await Message.updateMany(
                { sender: receiverObjId, receiver: senderObjId, status: { $ne: 'read' } },
                { $set: { status: 'read' } }
            );

            // Note: 'senderId' here is the person reading, 'receiverId' is the original author
            io.to(room).emit('messageStatusUpdate', {
                sender: receiverId, // The original sender of the message
                receiver: senderId, // The person who just read it
                status: 'read'
            });
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    });

    // WebRTC Signaling
    socket.on('callUser', (data) => {
        const targetSocketId = onlineUsers.get(data.userToCall);
        if (targetSocketId) {
            io.to(targetSocketId).emit('callUser', {
                signal: data.signalData,
                from: data.from,
                name: data.name,
                type: data.type
            });
        }
    });

    socket.on('answerCall', (data) => {
        const targetSocketId = onlineUsers.get(data.to);
        if (targetSocketId) {
            io.to(targetSocketId).emit('answerCall', data.signal);
        }
    });

    socket.on('iceCandidate', (data) => {
        const targetSocketId = onlineUsers.get(data.to);
        if (targetSocketId) {
            io.to(targetSocketId).emit('iceCandidate', data.candidate);
        }
    });

    socket.on('endCall', (data) => {
        const targetSocketId = onlineUsers.get(data.to);
        if (targetSocketId) {
            io.to(targetSocketId).emit('callEnded');
        }
    });
    socket.on('sendComment', (data) => {
        const { room, content } = data;
        console.log('sendComment:', room, content, data);
        socket.broadcast.to(room).emit('sendComment', content);
    });

    socket.on('sendNotification', ({ receiver, sender }) => {
        const targetSocketId = onlineUsers.get(receiver);
        if (targetSocketId) {
            io.to(targetSocketId).emit('newNotification', { sender });
        }
    });
});
connectDB()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Failed to start server due to DB connection issue:', error.message);
        process.exit(1);
    });
