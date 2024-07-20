const jwt = require("jsonwebtoken");
const niv = require("../../libs/nodeValidation");
const utils = require("../../libs/utils");
const { JWT_TOKEN_EXPIRY } = require("../../config/constants");
const mongoose = require("mongoose");
const Users = mongoose.model("Users");
const _ = require("lodash");
const Big = require('big.js');
const helpers = require("../../libs/helper");
const { firebase_admin } = require("../../config/firebase");
const fs = require('fs');
const fsPromise = require('fs/promises');
const path = require('path');
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const config = require("../../config");
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { PassThrough } = require('stream');
const db = firebase_admin.firestore();
const bucket = firebase_admin.storage().bucket();



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

exports.checkAudio = async (req, res) => {
    const details = req.audioDetails;
    const response = helpers.getAudioFile(details.audioStorageName)
    const baseUrl = process.env.API_BASE_URL ? process.env.API_BASE_URL : `http://localhost:3034/`
    const audioURL = `${baseUrl}web/audio/${details.audioStorageName}}`
    if (response) {
        return res.status(200).json(utils.apiResponse(true, '', { audioURL: audioURL }))
    } else {
        return res.status(500).json(utils.apiResponseError(false, 'Something went wrong.'))
    }
    // const docRef = db.collection('audios').doc(req.params.audio_id);
    // const doc = await docRef.get();
    // if (doc.exists) {
    //     const data = doc.data()
    //     if (data.userId !== req.user.uid) {
    //         return res.status(200).json(utils.apiResponseMessage(false, 'Unauthorized', 'unauthorized'))
    //     } else {
    //         const destinationPath = `${__dirname}/../../uploads/audio-files/${data.audioStorageName}`;
    //         const audioURL = `${process.env.API_BASE_URL ? process.env.API_BASE_URL : 'http://localhost:3034/'}web/audio/${path.basename(destinationPath)}`
    //         if (fs.existsSync(destinationPath)) {
    //             return res.status(200).json(utils.apiResponse(true, '', { audioURL: audioURL }))
    //         } else {
    //             const options = {
    //                 destination: destinationPath
    //             }
    //             try {
    //                 const filePath = `audios/${data.audioStorageName}`
    //                 await bucket.file(filePath).download(options);
    //                 return res.status(200).json(utils.apiResponse(true, '', { audioURL: audioURL }))
    //             } catch (error) {
    //                 return res.status(500).json(utils.apiResponseError(false, 'Something went wrong.'))
    //             }
    //         }
    //     }
    // } else {
    //     return res.status(200).json(utils.apiResponseMessage(false, 'Document not available.', 'notFound'))
    // }
}

exports.getAudio = async (req, res) => {
    const filePath = path.join(__dirname, `../../uploads/audio-files/${req.params.file_name}`);
    if (fs.existsSync(filePath)) {
        return res.download(filePath)
    } else {
        return res.status(200).json(utils.apiResponseMessage(false, 'Audio not available.'))
    }
}


exports.getAudioText = async (req, res) => {
    const details = req.audioDetails;
    if (details.audioText && details.audioText.length) {
        return res.status(200).json(utils.apiResponseData(true, { audioText: details.audioText }))
    } else {
        const response = helpers.getAudioFile(details.audioStorageName);
        if (response) {
            const AZURE_SPEECH_API_KEY = process.env.AZURE_SPEECH_API_KEY;
            const AZURE_SPEECH_API_REGION = process.env.AZURE_SPEECH_API_REGION;

            const speechConfig = sdk.SpeechConfig.fromSubscription(AZURE_SPEECH_API_KEY, AZURE_SPEECH_API_REGION);
            speechConfig.speechRecognitionLanguage = config.speechToTextLanguages[details.language];
            speechConfig.alternativeLanguageCodes = config.speechToTextAlternativeLanguages[details.language];
            const filePath = path.join(__dirname, `../../uploads/audio-files/${details.audioStorageName}`);

            const audioConfig = sdk.AudioConfig.fromWavFileInput(fs.readFileSync(filePath));
            const speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

            const storeText = async (text) => {
                const docRef = db.collection('audios').doc(req.params.audio_id);
                try {
                    await docRef.update({
                        audioText: text
                    })
                    return res.status(200).json(utils.apiResponseData(true, { audioText: text }))
                } catch (error) {
                    return res.status(500).json(utils.apiResponseError(false, 'Something went wrong.'))
                }
            }

            speechRecognizer.recognizeOnceAsync(result => {
                switch (result.reason) {
                    case sdk.ResultReason.RecognizedSpeech:
                        storeText(result.text);
                        break;
                    case sdk.ResultReason.NoMatch:
                        return res.status(200).json(utils.apiResponseMessage(false, 'Audio could not be recognized.', 'notRecognized'))
                    case sdk.ResultReason.Canceled:
                        const cancellation = sdk.CancellationDetails.fromResult(result);

                        if (cancellation.reason == sdk.CancellationReason.Error) {
                            return res.status(500).json(utils.apiResponseError(false, 'Something went wrong.'))
                        } else {
                            return res.status(200).json(utils.apiResponseMessage(false, cancellation.reason, 'canceled'))
                        }
                }
                speechRecognizer.close();
            });


        } else {
            return res.status(500).json(utils.apiResponseError(false, 'Something went wrong.'))
        }
    }
}
