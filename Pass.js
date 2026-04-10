const User = require('./model/User');
const updatePassUser = async (req, res) => {
    try {
        // Get user ID from URL parameter and new password from the request body
        const newPassword  = '1234';
        const userId = '66970ad6d9a73b991038c76a';

        // Ensure the new password is provided
        if (!newPassword) {
            return res.status(400).json({ message: 'New password is required' });
        }

        // Find the user by ID
        const user = await User.findById(userId);

        // If user not found, return 404
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Use passport-local-mongoose to set and hash the new password
        await user.setPassword(newPassword);

        // Save the updated user document
        await user.save();

        // Send response with success message
        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        // Handle errors and send the appropriate response
        res.status(500).json({ message: error.message });
    }
};
updatePassUser();