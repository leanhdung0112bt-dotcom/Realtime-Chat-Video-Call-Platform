import mongoose, { Schema } from 'mongoose';

const friendshipSchema = new Schema(
  {
    pairKey: { type: String },
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'blocked'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
friendshipSchema.index({ pairKey: 1 }, { unique: true, sparse: true });

export const Friendship = mongoose.model('Friendship', friendshipSchema);
