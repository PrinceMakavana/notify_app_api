// Mongo DB Connection
const mongoose = require('mongoose');
const fs = require('fs');
const config = require('./config/index');
const path = require("path");
const models = path.join(__dirname, 'models');

// Bootstrap models
fs.readdirSync(models)
    .filter(file => ~file.search(/^[^.].*\.js$/))
    .forEach(file => require(path.join(models, file)));


let connect = () => {
    return new Promise((resolve, reject) => {
        mongoose.connection
            .on('error', console.log)
            .on('disconnected', (e) => { console.log("Database Connection Error", e); })
            .once('open', () => { });

        mongoose.connect(config.db, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }).then(e => {
            console.log("Database connected Successfully.");
            resolve(true)
        })
    })
}

module.exports = { connect };