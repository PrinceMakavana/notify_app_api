const jwt = require("jsonwebtoken");
const niv = require("../../libs/nodeValidation");
const utils = require("../../libs/utils");
const { JWT_TOKEN_EXPIRY } = require("../../config/constants");
const mongoose = require("mongoose");
const Users = mongoose.model("Users");
const _ = require("lodash");
const Big = require('big.js');
const helpers = require("../../libs/helper");



exports.login = async (req, res) => {
    try {
        let rules = {
            "email": ["required", 'email'],
            "password": ["required", 'string', 'minLength:3', 'maxLength:30'],
        }

        let v = new niv.Validator(req.body, rules);
        let validation = await v.check();

        if (!validation) {
            return res.send(utils.apiResponse(false, "", v.errors));
        }

        try {

            let userInfo = await Users.findOne({ email: req.body.email });

            if (!userInfo) {
                // Create User
                userInfo = new Users();
                userInfo.email = req.body.email;
                userInfo.hashed_password = await utils.cryptPassword(req.body.password);
                await userInfo.save();
            } else {
                // Check Password
                if (!await utils.cryptPasswordCheck(req.body.password, userInfo.hashed_password)) {
                    return res.status(200).json(utils.apiResponseMessage(false, "Incorrect password."));
                }
            }

            //Generate Token
            let tokenDetails = {
                user_id: _.get(userInfo, '_id', ""),
                email: userInfo.email
            };

            const token = jwt.sign(tokenDetails,
                process.env.JWT_TOKEN_SECRET, {
                expiresIn: parseInt(JWT_TOKEN_EXPIRY),
            });
            return res.status(200).json(utils.apiResponseData(true, { token }));
        } catch (error) {
            console.log("Error", error);
            return res.status(200).json(utils.apiResponseMessage(false, "Invalid auth token."));

        }
    } catch (error) {
        return res.status(500);
    }
}

exports.profile = async (req, res) => {
    res.send(utils.apiResponseData(true, {
        // first_name: req.user.first_name,
        // last_name: req.user.last_name,
        email: req.user.email,
    }))
}
