const admin = require("firebase-admin");
const { serviceAccount } = require("./firebase-config");


admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_BUCKET_URL
});

exports.firebase_admin = admin;