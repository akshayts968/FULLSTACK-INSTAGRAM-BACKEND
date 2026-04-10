const User = require('../model/User');
const Notification = require('../model/Notification');
const cloudinary = require('../config/cloudinary')
const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getUserByUsername = async (req, res) => {
    try {
        const queryParam = req.params.username;
        let query = { username: queryParam };
        const mongoose = require('mongoose');
        if (mongoose.Types.ObjectId.isValid(queryParam)) {
            query = { $or: [{ _id: queryParam }, { username: queryParam }] };
        }
        const user = await User.findOne(query);
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



const updatePassUser = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.params.id;

        if (!newPassword) {
            return res.status(400).json({ message: 'New password is required' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await user.setPassword(newPassword);

        await user.save();

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const updateUser = async (req, res) => {
    try {
      const id = req.params.id;
      const { username, name, email, field } = req.body;
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let profileUrl = user.profile;

      if (req.file && req.file.buffer) {
        const streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    { folder: "wanderlust_DEV", resource_type: "auto" },
                    (error, result) => {
                        if (result) resolve(result);
                        else reject(error);
                    }
                );
                stream.end(req.file.buffer); // Clean buffer flush without timeout leaks
            });
        };

        const result = await streamUpload(req);
        profileUrl = result.secure_url;

        if (user.profile && user.profile.includes('wanderlust_DEV')) {
          const urlParts = user.profile.split('/');
          const oldImagePublicId = urlParts[urlParts.length - 1].split('.')[0];
          await cloudinary.uploader.destroy(`wanderlust_DEV/${oldImagePublicId}`);
        }
      }

      const updatedUser = await User.findByIdAndUpdate(id, {
        username,
        name,
        email,
        field,
        profile: profileUrl, 
      }, { new: true });
  
      res.json({user:updatedUser});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  };

const followUser = async (req, res) => {
    try {
        const { id, uId } = req.params;
        const { action } = req.body; // expect 'addFollower', 'removeFollower', 'addFollowing', 'removeFollowing'
        const user = await User.findById(id);
        const targetUser = await User.findById(uId);
        console.log("KOK",targetUser.followings.includes(id));
        
        if (!user || !targetUser) {
            return res.status(404).json({ message: "User not found" });
        }
            if (!targetUser.followings.includes(id)) {
                const Man = await User.findByIdAndUpdate(uId, {
                    $push: { followings: id },
                    $inc: { nFollowing: 1 }
                }, { new: true });
                const coMan = await User.findByIdAndUpdate(id, {
                    $push: { followers: uId },
                    $inc: { nFollowers: 1 }
                }, { new: true });
                
                const notif = new Notification({
                    recipient: id,
                    sender: uId,
                    type: 'follow',
                    content: "started following you",
                    link: `/`
                });
                await notif.save();
                
                res.json({ message: "Follower added successfully",user:Man,coMan });
            }else{
                const Man =  await User.findByIdAndUpdate(uId, {
                    $pull: { followings: id },
                    $inc: { nFollowing: -1 }
                }, { new: true });
                const coMan =  await User.findByIdAndUpdate(id, {
                    $pull: { followers: uId },
                    $inc: { nFollowers: -1 }
                }, { new: true });
                res.json({ message: "Follower removed successfully",user:Man,coMan });
            }
            console.log(user,targetUser);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const fetchAllUsers = async (req, res) => {
    const users = await User.find();
    res.status(200).json(users);
};

const uploadStory = async (req, res) => {
    try {
        const id = req.params.id;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'No file provided' });

        const streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    { folder: "wanderlust_DEV", resource_type: "auto" },
                    (error, result) => {
                        if (result) resolve(result);
                        else reject(error);
                    }
                );
                stream.end(req.file.buffer);
            });
        };

        const result = await streamUpload(req);
        const storyUrl = result.secure_url;

        const updatedUser = await User.findByIdAndUpdate(id, { story: storyUrl }, { new: true });
        res.status(201).json({ user: updatedUser, storyUrl });
    } catch (error) {
        console.error('Story Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload story' });
    }
};

const uploadHighlight = async (req, res) => {
    try {
        const id = req.params.id;
        const { groupName } = req.body;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'No file provided' });

        const streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    { folder: "wanderlust_DEV", resource_type: "auto" },
                    (error, result) => {
                        if (result) resolve(result);
                        else reject(error);
                    }
                );
                stream.end(req.file.buffer);
            });
        };

        const result = await streamUpload(req);
        const highlightUrl = result.secure_url;

        let nameFilter = groupName || "Highlight";
        const groupIndex = user.highlight.findIndex(h => h.name === nameFilter);

        let updatedUser;
        if (groupIndex > -1) {
             // Push to existing group medias array
             user.highlight[groupIndex].medias.push(highlightUrl);
             updatedUser = await user.save();
        } else {
             // Create brand new group bubble map
             const newObj = { name: nameFilter, cover: highlightUrl, medias: [highlightUrl] };
             updatedUser = await User.findByIdAndUpdate(id, { $push: { highlight: newObj } }, { new: true });
        }

        res.status(201).json({ user: updatedUser, highlightUrl });
    } catch (error) {
        console.error('Highlight Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload highlight' });
    }
};

const searchUsers = async (req, res) => {
    const query = req.query.query;
    try {
        const result = await User.find(
            { username: { $regex: query, $options: 'i' } },
            { _id: 1, username: 1, profile: 1, name: 1 }
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { updatePassUser,getUser, getUserByUsername, updateUser, followUser, fetchAllUsers, uploadStory, uploadHighlight, searchUsers };
