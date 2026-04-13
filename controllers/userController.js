const User = require('../model/User');
const Notification = require('../model/Notification');
const cloudinary = require('../config/cloudinary')
const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        const freshStories = (user.stories || []).filter((story) => {
            const age = Date.now() - new Date(story.createdAt).getTime();
            return age <= 24 * 60 * 60 * 1000;
        });
        if (freshStories.length !== (user.stories || []).length) {
            user.stories = freshStories;
            user.story = freshStories.length ? freshStories[freshStories.length - 1].mediaUrl : "";
            await user.save();
        }
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
      const { username, name, email, field, isPrivate } = req.body;
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
        isPrivate: isPrivate === 'true' || isPrivate === true,
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
        const user = await User.findById(id);
        const targetUser = await User.findById(uId);
        
        if (!user || !targetUser) {
            return res.status(404).json({ message: "User not found" });
        }
        const alreadyFollowing = targetUser.followings.some((fId) => String(fId) === String(id));
        const hasPending = user.pendingFollowRequests.some((rId) => String(rId) === String(uId));

        if (!alreadyFollowing) {
            if (user.isPrivate) {
                if (!hasPending) {
                    await User.findByIdAndUpdate(id, { $push: { pendingFollowRequests: uId } });
                    const notif = new Notification({
                        recipient: id,
                        sender: uId,
                        type: 'follow_request',
                        content: "requested to follow you",
                        link: `/profile/${targetUser.username}`
                    });
                    await notif.save();
                }
                const updatedRequester = await User.findById(uId);
                const updatedPrivateUser = await User.findById(id);
                return res.json({ message: "Follow request sent", isRequested: true, user: updatedRequester, coMan: updatedPrivateUser });
            }

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
                link: `/profile/${targetUser.username}`
            });
            await notif.save();
            
            return res.json({ message: "Follower added successfully", user: Man, coMan });
        }

        const Man =  await User.findByIdAndUpdate(uId, {
            $pull: { followings: id },
            $inc: { nFollowing: -1 }
        }, { new: true });
        const coMan =  await User.findByIdAndUpdate(id, {
            $pull: { followers: uId },
            $inc: { nFollowers: -1 }
        }, { new: true });
        return res.json({ message: "Follower removed successfully", user: Man, coMan });
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
        const files = req.files || (req.file ? [req.file] : []);
        if (!files.length) return res.status(400).json({ error: 'No file provided' });

        const streamUpload = (file) => {
            return new Promise((resolve, reject) => {
                const resType = file.mimetype.startsWith('video/') ? 'video' : 'image';
                let stream = cloudinary.uploader.upload_stream(
                    { folder: "wanderlust_DEV", resource_type: resType },
                    (error, result) => {
                        if (result) resolve(result);
                        else reject(error);
                    }
                );
                stream.end(file.buffer);
            });
        };

        const currentStories = (user.stories || []).filter((story) => {
            const age = Date.now() - new Date(story.createdAt).getTime();
            return age <= 24 * 60 * 60 * 1000;
        });
        const uploadedStories = [];
        for (const file of files) {
            const result = await streamUpload(file);
            uploadedStories.push({
                mediaUrl: result.secure_url,
                mediaType: file.mimetype.startsWith('video/') ? 'video' : 'image',
                createdAt: new Date(),
            });
        }

        const mergedStories = [...currentStories, ...uploadedStories];
        const latestStory = mergedStories.length ? mergedStories[mergedStories.length - 1].mediaUrl : "";
        const updatedUser = await User.findByIdAndUpdate(id, { stories: mergedStories, story: latestStory }, { new: true });
        res.status(201).json({ user: updatedUser, stories: uploadedStories, storyUrl: latestStory });
    } catch (error) {
        console.error('Story Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload story' });
    }
};

const deleteStory = async (req, res) => {
    try {
        const { id, storyId } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const filtered = (user.stories || []).filter((story) => String(story._id) !== String(storyId));
        const latestStory = filtered.length ? filtered[filtered.length - 1].mediaUrl : "";
        user.stories = filtered;
        user.story = latestStory;
        await user.save();
        res.json({ user, message: "Story deleted" });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete story' });
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

const deleteHighlight = async (req, res) => {
    try {
        const { id, groupName } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.highlight = (user.highlight || []).filter((h) => h.name !== groupName);
        await user.save();
        res.json({ user, message: "Highlight removed" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete highlight" });
    }
};

const deleteHighlightMedia = async (req, res) => {
    try {
        const { id, groupName, mediaIndex } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const group = (user.highlight || []).find((h) => h.name === groupName);
        if (!group) return res.status(404).json({ error: 'Highlight group not found' });

        const idx = Number(mediaIndex);
        if (Number.isNaN(idx) || idx < 0 || idx >= group.medias.length) {
            return res.status(400).json({ error: 'Invalid media index' });
        }

        group.medias.splice(idx, 1);
        if (group.medias.length === 0) {
            user.highlight = (user.highlight || []).filter((h) => h.name !== groupName);
        } else if (!group.medias.includes(group.cover)) {
            group.cover = group.medias[0];
        }

        await user.save();
        return res.json({ user, message: 'Highlight media removed' });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to delete highlight media' });
    }
};

const respondFollowRequest = async (req, res) => {
    try {
        const { id, requesterId } = req.params;
        const { action } = req.body; // accept | reject
        const privateUser = await User.findById(id);
        const requester = await User.findById(requesterId);
        if (!privateUser || !requester) return res.status(404).json({ message: "User not found" });

        privateUser.pendingFollowRequests = (privateUser.pendingFollowRequests || []).filter(
            (rId) => String(rId) !== String(requesterId)
        );

        if (action === 'accept') {
            const requesterHas = requester.followings.some((fId) => String(fId) === String(id));
            const ownerHas = privateUser.followers.some((fId) => String(fId) === String(requesterId));
            if (!requesterHas) {
                requester.followings.push(id);
                requester.nFollowing += 1;
            }
            if (!ownerHas) {
                privateUser.followers.push(requesterId);
                privateUser.nFollowers += 1;
            }
            const notif = new Notification({
                recipient: requesterId,
                sender: id,
                type: 'follow',
                content: "accepted your follow request",
                link: `/profile/${privateUser.username}`
            });
            await notif.save();
        }

        await privateUser.save();
        await requester.save();
        return res.json({ message: `Request ${action}ed`, user: requester, coMan: privateUser });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getFollowList = async (req, res) => {
    try {
        const { id } = req.params;
        const { type = 'followers', page = 1, limit = 20, query = '' } = req.query;
        const user = await User.findById(id).populate(type === 'followings' ? 'followings' : 'followers', 'username name profile');
        if (!user) return res.status(404).json({ message: "User not found" });
        const list = type === 'followings' ? user.followings : user.followers;
        const q = String(query).toLowerCase();
        const filtered = list.filter((item) => {
            if (!q) return true;
            return item.username?.toLowerCase().includes(q) || item.name?.toLowerCase().includes(q);
        });
        const p = Number(page);
        const l = Number(limit);
        const start = (p - 1) * l;
        const paginated = filtered.slice(start, start + l);
        res.json({ users: paginated, hasMore: start + l < filtered.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
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

module.exports = { updatePassUser, getUser, getUserByUsername, updateUser, followUser, fetchAllUsers, uploadStory, deleteStory, uploadHighlight, deleteHighlight, deleteHighlightMedia, respondFollowRequest, getFollowList, searchUsers };
