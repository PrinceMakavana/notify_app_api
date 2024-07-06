var express = require('express');
var router = express.Router();


var webApis = require("./web");

router.use("/web", webApis);
// Public api to get images of all cards by id


module.exports = router;