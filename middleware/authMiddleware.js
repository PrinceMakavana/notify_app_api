const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const utils = require("../libs/utils");
const Users = mongoose.model("Users");
const { firebase_admin } = require("../config/firebase");

module.exports = async (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) {
        return res.status(401).send(utils.apiResponseMessage(false, "Unauthorized"));
    }
    try {
        // Get User Information 
        userInfo = await firebase_admin.auth().verifyIdToken(token);
        req.user = userInfo;
        next();
        return;
    } catch (error) {
        console.log('error', error);
        return res.status(200).json(utils.apiResponseMessage(false, "Invalid auth token."));
    }
}