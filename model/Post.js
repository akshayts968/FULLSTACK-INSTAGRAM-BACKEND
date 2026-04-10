const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const User = require("./User");
//const Comment=require('./comment.js');
const Post = new Schema({
    videourl: {
        type: String,
        required: true,
    },
    nLikes: {
        type: Number,
        default: 0
    },
    likes: [
        {
            type: String,
        }
    ],
    description:
    {
        type: String,
    },
    nComments: {
        type: Number,
        default: 0
    },
    comments: [{
        type: Schema.Types.ObjectId,
        ref: 'Comment',
    }],
    postOwner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    isReel: {
        type: Boolean,
        default: false,
    },
    taggedUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    thumbnailUrl: { type: String },
    date: {
        type: Date,
        default: Date.now,
    },
});
module.exports = mongoose.model("Post", Post);