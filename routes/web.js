var express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const audioMiddleware = require("../middleware/audioAuthMiddleware");
const multer = require('multer');
var router = express.Router();
const path = require('path');

const WebAuthController = require("./../controllers/web/auth");
const WebGameController = require("./../controllers/web/game");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads'); // Set the directory for temporary file storage
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname)); // Set the file name with timestamp
    }
  });

const upload = multer({ storage });

let authRoutes = express.Router();
authRoutes.get("/profile", WebAuthController.profile);
authRoutes.get("/check-audio/:audio_id",audioMiddleware, WebAuthController.checkAudio);
authRoutes.get("/audio-text-link/:audio_id", audioMiddleware, WebAuthController.getAudioTextLink);
authRoutes.post("/add-audio", upload.single('audio'), WebAuthController.addAudio);

router.get("/audio/:file_name", WebAuthController.getAudio);
router.get("/shared-audio/details/:audio_id", WebAuthController.getSharedAudioDetails);


// Find File in local
// Check file exist in local
// Else copy file in local
// Send reponse with file

// authRoutes.get("/card-list", WebGameController.cardList);

// authRoutes.post('/game', WebGameController.store)
// authRoutes.get('/game/:game_id', WebGameController.load, WebGameController.show);
// authRoutes.post('/game/:game_id/drop-card', WebGameController.load, WebGameController.canDoAction, WebGameController.cardDrop);
// authRoutes.post('/game/:game_id/pick-card', WebGameController.load, WebGameController.canDoAction, WebGameController.cardPick);
// authRoutes.post('/game/:game_id/check-win', WebGameController.load, WebGameController.canDoAction, WebGameController.checkWin);

router.use("/", authMiddleware, authRoutes);

module.exports = router;