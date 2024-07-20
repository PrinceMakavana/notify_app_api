const {firebase_admin} = require("../config/firebase");
const utils = require("../libs/utils");

const db = firebase_admin.firestore();
const bucket = firebase_admin.storage().bucket();

module.exports = async (req,res,next) => {

    const docRef = db.collection('audios').doc(req.params.audio_id);
    const doc = await docRef.get();

    if(doc.exists){
        const data = doc.data();
        if(data.userId !== req.user.uid){
            return res.status(200).json(utils.apiResponseMessage(false, 'Unauthorized', 'unauthorized'))
        }else {
            req.audioDetails = data;
            next();
            return;
        }
    }else {
        return res.status(200).json(utils.apiResponseMessage(false, 'Document not available.', 'notFound'))
    }
}