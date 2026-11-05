import mongoose, { Schema } from 'mongoose';

const groupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: 300,
    },
  },
  {
    timestamps: true,
  }
);

export const Group = mongoose.model('Group', groupSchema);
