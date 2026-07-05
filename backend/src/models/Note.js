const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: "User" },
    title: { type: String, required: true },
    subject: { type: String, default: "" },
    sourcePdfs: { type: [String], default: [] },
    topics: { type: [String], default: [] },
    sections: { type: mongoose.Schema.Types.Mixed, default: [] },
    quickRevision: { type: [String], default: [] },
  },
  { timestamps: true }
);

noteSchema.index({ userId: 1, createdAt: -1 });

const StudyNote = mongoose.model("StudyNote", noteSchema);

module.exports = { StudyNote };