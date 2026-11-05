import mongoose, { Schema } from 'mongoose';

const conversationSchema = new Schema(
  {
    directKey: { type: String },
    type: {
      type: String,
      enum: ['direct', 'group'],
      default: 'direct',
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      text: { type: String, default: '' },
      sender: { type: Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ directKey: 1 }, { unique: true, sparse: true });

export const Conversation = mongoose.model('Conversation', conversationSchema);
