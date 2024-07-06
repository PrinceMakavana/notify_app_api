const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const utils = require("../libs/utils");
const Users = mongoose.model("Users");

module.exports = async (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) {
        return res.status(401).send(utils.apiResponseMessage(false, "Unauthorized"));
    }
    try {
        const verified = jwt.verify(token, process.env.JWT_TOKEN_SECRET);
        let user = await Users.findOne({ _id: verified.user_id });
        if (user) {
            req.user = user;
            next();
            return;
        } else {
            return res.status(401).send(utils.apiResponseMessage(false, "Unauthorized"));
        }
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).send(utils.apiResponseMessage(false, "Unauthorized"));
        }else if(error instanceof jwt.JsonWebTokenError){
            return res.status(401).send(utils.apiResponseMessage(false, "Unauthorized"));
        }
        return res.status(500).send({ status: false });
    }
}