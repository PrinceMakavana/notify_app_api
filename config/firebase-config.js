
const utils = require("../libs/utils");

exports.serviceAccount = JSON.parse(utils.decodeBase64(process.env.FIREBASE_SECRET_KEY));
  