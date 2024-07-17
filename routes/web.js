var express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
var router = express.Router();

const WebAuthController = require("./../controllers/web/auth");
const WebGameController = require("./../controllers/web/game");


let authRoutes = express.Router();
authRoutes.get("/profile", WebAuthController.profile);

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