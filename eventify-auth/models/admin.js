const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  myevents: [
    {
      title: String,
      description: String,
      date: Date,
      form_link: String,
      rules: [String],
      platform: String,
      reg_fee: Number,
      status: { type: String, default: "Publish" }
    }
  ]
});

module.exports = mongoose.model("Admin", adminSchema);