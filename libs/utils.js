const _ = require("lodash");
const ObjectID = require("mongodb").ObjectId;
const bcrypt = require("bcrypt");
const fs = require("fs");
const mv = require("mv");
const path = require('path');
const config = require("../config")
const moment = require('moment');

let utils = {};

/**
 * 
 * @param {boolean} status 
 * @param {Object} error 
 * @returns 
 */
utils.apiResponseError = (status, error = {}) => {
    return { 'success': status, 'message': 'Something went wrong.', 'data': {}, 'errors': error };
}

/**
 * 
 * @param {Boolean} status 
 * @param {string} msg 
 * @param {any} data    
 * @param {any} error 
 * @returns 
 */
utils.apiResponse = (status, msg, data = {}, error = {}) => {
    return { 'success': status, 'message': msg, 'data': data, 'errors': error };
}

utils.apiResponseData = (status, data = {}, error = {}) => {
    return { 'success': status, 'message': '', 'data': data, 'errors': error };
}

utils.apiResponseMessage = (status, msg, code = '') => {
    return { 'success': status, 'message': msg, 'data': {}, 'errors': {}, 'code': code };
}


/**
 * 
 * @param {string} url 
 * @param {Object} queryParams 
 * @returns 
 */
utils.addQueryParams = (url, queryParams) => {
    queryParams = _.map(queryParams, (value, key) => {
        return `${key}=${value}`;
    })
    queryParams = Object.values(queryParams).join("&")

    return `${url}?${queryParams}`;
}

/**
 * Function is used to decoded base64 encoded string
 * @param {String} encodedValue 
 * @returns 
 */
utils.decodeBase64 = (encodedValue) => {
    let value;
    try {
        value = atob(encodedValue);
    } catch (error) {
        value = Buffer.from(encodedValue, 'base64').toString();
    }
    return value
}
/**
 * Function is used to encode base64  string
 * @param {String} encodedValue 
 * @returns 
 */
utils.encodeBase64 = (str) => {
    let value;
    try {
        value = btoa(str);
    } catch (error) {
        value = Buffer.from(str).toString('base64');
    }
    return value
}

utils.cryptPassword = (password) => {
    return new Promise((resolve, reject) => {
        bcrypt.genSalt(10, function (err, salt) {
            if (err)
                return reject(err);

            bcrypt.hash(password, salt, function (err, hash) {
                return resolve(hash);
            });
        });
    });
};

utils.cryptPasswordCheck = (passwordEnteredByUser, currentPassword) => {
    return new Promise((resolve, reject)=> {
        bcrypt.compare(passwordEnteredByUser, currentPassword, (err, isMatch) => {
            if (err) {
                return reject(err)
            } else if (isMatch) {
                return resolve(isMatch)
            } else {
                return resolve(false)
            }
        });
    })
    
}

utils.isValidObjectID = (_id) => {
    return ObjectID.isValid(_id);
}

utils.getObjectID = (_id) => {
    return utils.isValidObjectID(_id) ? new ObjectID(_id) : null;
}

utils.matchObjectId = (objectId1, objectId2) => {
    try {
        return utils.isValidObjectID(objectId1) && utils.isValidObjectID(objectId2) && ( objectId1.toString() == objectId2.toString() );
    } catch (error) {
        
    }
    return false;
}

/**
 *  
 * @param {Array} objectIdList 
 * @param {*} objectId 
 */
utils.includesObjectId = (objectIdList, objectId) => {
    if(objectIdList && Array.isArray(objectIdList) && utils.isValidObjectID(objectId)){
        objectIdList = objectIdList.filter(id => utils.isValidObjectID(id)).map(id => id.toString());
        return objectIdList.includes(objectId.toString());
    }
    return false;
}

utils.getErrorMessage = (errors) => {
    return _.get(Object.values(errors), "0.message", "");
}

utils.random = (n = 10) => {
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var chars = '0123456789';
    var token = '';
    for (var i = 0; i < n; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
}
utils.randomNumber = (n = 5) => {
    let limit = 1;
    for (var i = 0; i < n; i++) {
        limit = limit * 10;
    }
    return Math.floor(Math.random() * limit);
}


utils.moveFile = (fromFile, toFile) => {
    return new Promise((resolve, reject) => {
        mv(fromFile, toFile, function (err) {
            if (err) {
                return reject(err)
            }else{
                return resolve(true);
            }
        });
    })
}

utils.getStatus = (statusText) => {
    return statusText == "active" ? true : (statusText == "deactive" ? false : null)
}

utils.mathRound = (number) => {
    return Math.round(number * 100) / 100
}

utils.getFormattedDate = (timestamp) => {
    try {
        let time = moment(timestamp).format('MMM DD, YYYY')
        return time;
    } catch (error) {
        return "-";
    }
}

utils.getFormattedAmount = (amount) => {
    amount = parseFloat(amount).toFixed(3);
    amount = amount === "NaN" ? "0.000" : amount
    amount = amount.split(".");
    amount[0] = parseInt(amount[0]).toLocaleString()
    return amount.join(".");
}

utils.validateAge = (date_of_birth, min_age, max_age, date_format) => {
    date_of_birth = date_format ? moment(date_of_birth, date_format) : moment(date_of_birth);
    return (new Date(date_of_birth).getTime() < new Date(moment().subtract(min_age, 'years').subtract(1, 'day')).getTime()
        &&
        new Date(date_of_birth).getTime() > new Date(moment().subtract(max_age, 'years').subtract(1, 'day')).getTime()) ? true : false;
}

utils.getAge = (dob, dobFormat = null) => {
    if(dobFormat){
        return moment().diff(moment(dob, dobFormat), 'years')
    }else{
        return moment().diff(moment(dob), 'years')
    }
}

utils.matchCaseInsensitive = (value1, value2) => {
    return value1.toLowerCase() == value2.toLowerCase();
}

module.exports = utils;
