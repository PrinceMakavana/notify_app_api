"use strict"

const mongoose = require("mongoose");

/**
 * Users Schema
 */

const UsersSchema = new mongoose.Schema({
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    email: { type: String, default: null },
    email_verified_at: { type: Date, default: null },
    hashed_password: { type: String, default: null },
},{
    timestamps: true
});
mongoose.model("Users", UsersSchema);