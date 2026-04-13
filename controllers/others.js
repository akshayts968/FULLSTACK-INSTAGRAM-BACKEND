const User = require('../model/User');
const Reset = require('../utils/Reset');

const hasMutualFollow = (owner, viewerId) => {
    if (!viewerId || !owner) return false;
    const viewerIdStr = String(viewerId);
    const viewerFollowsOwner = (owner.followers || []).some((id) => String(id) === viewerIdStr);
    const ownerFollowsViewer = (owner.followings || []).some((id) => String(id) === viewerIdStr);
    return viewerFollowsOwner && ownerFollowsViewer;
};

const allUser =  async (req, res) => {
    try {
        const viewerId = req.query.viewerId;
        const result = await User.find({}, '_id username profile name story stories followers followings');
        const filteredUsers = result.map((user) => {
            const userObj = user.toObject();
            const freshStories = (userObj.stories || []).filter((story) => {
                const age = Date.now() - new Date(story.createdAt).getTime();
                return age <= 24 * 60 * 60 * 1000;
            });
            const latestStory = freshStories.length ? freshStories[freshStories.length - 1].mediaUrl : null;
            const canViewStory =
                String(user._id) === String(viewerId || '') ||
                hasMutualFollow(userObj, viewerId);
            return {
                _id: userObj._id,
                username: userObj.username,
                profile: userObj.profile,
                name: userObj.name,
                story: canViewStory ? latestStory : null,
                stories: canViewStory ? freshStories : [],
            };
        });
        res.json(filteredUsers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
const err =  async (req, res) => {
    try {
        res.send("FAILED");
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
const sresult = async (req, res) => {
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
const reset = async (req, res) => {
    try {
        await Reset();
        res.json({ message: 'All user counts reset successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
module.exports = { allUser,sresult,reset,err};
