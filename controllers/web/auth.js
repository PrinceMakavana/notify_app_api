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
const path = require('path');
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const config = require("../../config");
const db = firebase_admin.firestore();
const bucket = firebase_admin.storage().bucket();
const admin = require('firebase-admin');

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
    const response = await helpers.getAudioFile(details.audioStorageName)
    // const baseUrl = process.env.API_BASE_URL ? process.env.API_BASE_URL : `http://localhost:3034/`
    const audioURL = `${config.baseURL}web/audio/${details.audioStorageName}`
    if (response) {
        return res.status(200).json(utils.apiResponse(true, '', { audioURL: audioURL }))
    } else {
        return res.status(500).json(utils.apiResponseError(false, 'Something went wrong.'))
    }
}

exports.getAudio = async (req, res) => {
    // const filePath = path.join(__dirname, `../../uploads/audio-files/${req.params.file_name}`);
    const filePath = `${__dirname}/../../uploads/audio-files/${req.params.file_name}`
    // if (fs.existsSync(filePath)) {
    return res.download(filePath)
    // } else {
    // return res.status(200).json(utils.apiResponseMessage(false, 'Audio not available.'))
    // }
}


exports.getAudioTextLink = async (req, res) => {
    const details = req.audioDetails;
    const audioTextURL = `${config.portalBaseURL}shared-audio-text/${req.params.audio_id}`
    if (details.audioText && details.audioText.length) {
        return res.status(200).json(utils.apiResponseData(true, { audioTextURL: audioTextURL }))
    } else {
        const response = await helpers.getAudioFile(details.audioStorageName);
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
                    return res.status(200).json(utils.apiResponseData(true, { audioTextURL: audioTextURL }))
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

exports.getSharedAudioDetails = async (req, res) => {
    if (!req.query.content) {
        return res.status(500).json(utils.apiResponseError(false, 'Something went wrong.'))
    } else {
        const docRef = db.collection('audios').doc(req.params.audio_id);
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            const audioURL = `${config.baseURL}web/audio/${data.audioStorageName}`
            if (req.query.content == 'audio') {
                const isExist = await helpers.fileExist(data.audioStorageName);
                const isExistInFolder = await helpers.getAudioFile(data.audioStorageName);
                if (!isExist || !isExistInFolder) {
                    return res.status(200).json(utils.apiResponseMessage(false, 'Document not available.', 'notFound'))
                }
            }

            const details = {
                audioName: data.audioCustomName,
                language: data.language,
                duration: req.query.content == 'audio' ? data.duration : null,
                audioText: req.query.content == 'fullText' ? data.audioText : null,
                audioURL: req.query.content == 'audio' ? audioURL : null
            }

            return res.status(200).json(utils.apiResponseData(true, details));

        } else {
            return res.status(200).json(utils.apiResponseMessage(false, 'Document not available.', 'notFound'))
        }
    }
}


exports.addAudio = async (req, res) => {



    if (!req.file) {
        return res.status(200).json(utils.apiResponseError(false, 'Recording file is required.'))
    }


    try {
        const { path: filePath, originalname, mimetype } = req.file;

        if (mimetype !== 'audio/wav') {
            return res.status(200).json(utils.apiResponseError(false, 'Invalid file.'))
        }

        let rules = {
            "userId": ["required"],
            "duration": ["required", 'string'],
            "language": ["required", "in:en,cn,zh"]
        }

        let v = new niv.Validator(req.body, rules);
        let validation = await v.check();

        if (!validation) {
            return res.send(utils.apiResponse(false, "", v.errors));
        }

        const fileName = `${req.body.userId}_${Date.now()}.wav`;
        const destination = `audios/${fileName}`;
        const buffer = fs.readFileSync(filePath);
        const fileUpload = bucket.file(destination);
        await fileUpload.save(buffer, {
            metadata: {
                contentType: mimetype,
            },
        });
        await db.collection('audios').add({
            userId: req.body.userId,
            audioStorageName: fileName,
            audioCustomName: `audio - ${Math.floor(Date.now() / 1000)}`,
            duration: Number(req.body.duration),
            language: req.body.language,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        fs.unlinkSync(filePath);
        return res.status(200).json(utils.apiResponseMessage(true, 'Recording added successfully.'))
    } catch (error) {
        return res.status(500).json(utils.apiResponseError(false, 'Something went wrong.'))
    }

}