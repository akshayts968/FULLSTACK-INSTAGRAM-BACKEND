const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageRequestSchema = new Schema(
  {
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
  },
  { timestamps: true }
);

messageRequestSchema.index({ requester: 1, recipient: 1 }, { unique: true });

module.exports = mongoose.model('MessageRequest', messageRequestSchema);
