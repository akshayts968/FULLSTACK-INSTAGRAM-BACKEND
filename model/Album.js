const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const albumItemSchema = new Schema(
  {
    uploader: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mediaUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const albumSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    pendingInvites: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    isPrivate: { type: Boolean, default: true },
    timeCapsuleEnabled: { type: Boolean, default: false },
    revealAt: { type: Date, default: null },
    items: [albumItemSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Album', albumSchema);
