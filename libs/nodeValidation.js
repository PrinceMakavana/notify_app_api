const niv = require("node-input-validator");
const mongoose = require("mongoose");
var validator = require('validator');

niv.extend('ObjectId', async ({ value, args }) => {
    return mongoose.isValidObjectId(value)
});

niv.extend('alphaSpace', async ({ value, args }) => {
    return value.toString().match(/^[A-Za-z ]+$/);
});

module.exports = niv;