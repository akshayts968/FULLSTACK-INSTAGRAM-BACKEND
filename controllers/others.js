const User = require('../model/User');
const Reset = require('../utils/Reset');
const allUser =  async (req, res) => {
    try {
        const result = await User.find({}, '_id username profile name story');
        res.json(result);
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
