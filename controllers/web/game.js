const niv = require("../../libs/nodeValidation");
const utils = require("../../libs/utils");
const mongoose = require("mongoose");
const Users = mongoose.model("Users");
const Games = mongoose.model("Games");
const GamePlayers = mongoose.model("GamePlayers");
const _ = require("lodash");
const helpers = require("../../libs/helper");


exports.store = async (req, res) => {
    try {
        let rules = {
            "random_number": ["required", 'numeric', 'min:10000', 'max:99999'],
        }

        let v = new niv.Validator(req.body, rules);
        let validation = await v.check();

        if (!validation) {
            return res.send(utils.apiResponse(false, "", v.errors));
        }

        try {
            const gameResponse = await Games.startGame(req.user._id);
            if (gameResponse.status) {
                return res.status(200).json(utils.apiResponseData(true, { game_id: gameResponse.game_id }));
            }

            return res.status(200).json(utils.apiResponseMessage(false, "Something went wrong."));
        } catch (error) {
            console.log("Error", error);
            return res.status(200).json(utils.apiResponseMessage(false, "Invalid auth token."));

        }
    } catch (error) {
        return res.status(500);
    }
}


exports.load = async (req, res, next) => {
    // Check is valid id
    if (!utils.isValidObjectID(req.params.game_id)) {
        return res.status(200).send(
            utils.apiResponse(false, "Game not found.", {
                code: "invalid_id",
            })
        );
    }

    const game = await Games.findById({
        _id: req.params.game_id,
    });

    if (!game) {
        return res.status(200).send(
            utils.apiResponse(false, "Game not found.", {
                code: "not_found",
            })
        );
    } else {
        req.game = game;
        next();
        return;
    }
};
exports.canDoAction = async (req, res, next) => {

    // Check is valid id
    if (req.game.is_game_completed) {
        return res.status(200).send(
            utils.apiResponse(false, "Game is completed.",)
        );
    }

    req.currentPlayer = await req.game.getPlayerOfUser(req.user._id);

    next();
};

exports.show = async (req, res) => {
    try {
        try {
            const players = await GamePlayers.find({ _id: { $in: req.game.player_id_in_sequence } });

            const current_player = players.find(player => player.user_id !== null && player.user_id.toString() == req.user._id.toString() && player.is_main)
            const turn = await req.game.getTurn();
            const discardCard = req.game.discard_card_list.length > 0 ? req.game.discard_card_list[req.game.discard_card_list.length - 1] : null;

            const winner =await req.game.getWinnerOfGame();
            const win_details = {
                winner: winner ? {
                    _id: winner._id,
                    card_list: winner.card_list,
                    flower_card_list: winner.flower_card_list
                }: null
            }

            const matched_list = await current_player.getAllMatchCardInIds();
            const data =  {
                is_game_completed: req.game.is_game_completed,
                win_details,
                current_turn_completed: await req.game.isLastTurnCompleted(),
                current_turn_player: req.game.last_term_player_id,
                current_turn_status: await turn.getStatus(),
                next_player: await req.game.getNextTurnPlayer(),
                discardCard,
                player: {
                    _id: current_player._id,
                    card_list: current_player.card_list,
                    flower_card_list: current_player.flower_card_list,
                    player_index: current_player.player_index,
                    matched_list: matched_list.matched_list
                },
                players: players.map(value => ({
                    _id: value._id,
                    player_name: value.player_name,
                    player_index: value.player_index,
                    total_cards: value.card_list,
                    flower_card_list: value.flower_card_list,
                })),
                private_detail : {
                    // matchCard: await current_player.getAllMatchCardInIds(),
                    rest_card_list: req.game.rest_card_list,
                    discard_card_list: req.game.discard_card_list,
                }
            } 

            return res.status(200).json(utils.apiResponseData(true, data));

        } catch (error) {
            console.log("Error", error);
            return res.status(200).json(utils.apiResponseMessage(false, "Invalid auth token."));

        }
    } catch (error) {
        return res.status(500);
    }
}

exports.cardPick = async (req, res) => {
    try {
        try {
            const pickFromIn = [helpers.pick_card.PICK_CARD_FROM_REST];
            let rules = {
                "player_id": ["required", 'ObjectId'],
                "pick_from": ["required"]
            }

            // Get player id of logged in user
            const turn = await req.game.getTurn();
            const turnPlayer = await turn.getPlayer();

            if(await turnPlayer.canPickCardFromDiscardList()){
                pickFromIn.push(helpers.pick_card.PICK_CARD_FROM_DISCARDED);
            }
            rules['pick_from'].push(`in:${pickFromIn.join(',')}`)
            
            let player_id = await req.game.getNextTurnPlayer();
            if (player_id.toString() !== req.currentPlayer._id.toString()) {
                req.body.pick_from = helpers.pick_card.PICK_CARD_FROM_REST;
            }

            let v = new niv.Validator(req.body, rules);
            let validation = await v.check();

            if (!validation) {
                return res.send(utils.apiResponse(false, "", v.errors));
            }

            const turnStatus = await turn.getStatus();

            // Check turn is completed
            if (turnStatus !== 'card_dropped') return res.status(200).json(utils.apiResponseMessage(false, "Not allowed"));

            // verify player id with turn
            if (player_id.toString() !== req.body.player_id) return res.status(200).json(utils.apiResponseMessage(false, "Invalid Player"));

            // Pick Card
            const pickCardResponse = await req.game.doMemeberTurnPick(req.body.player_id, req.body.pick_from);

            if (pickCardResponse.status) {

                const game = await Games.findById({_id: req.params.game_id});
                if(game.is_game_completed){
                    return res.status(200).json(utils.apiResponse(true, 'Game completed, you are the winner.', { player_id: req.body.player_id, pick_card: pickCardResponse.card }));
                }else{
                    return res.status(200).json(utils.apiResponse(true, 'Card picked successfully.', { pick_card: pickCardResponse.card }));
                }

            }

            return res.status(200).json(utils.apiResponse(false, 'Something went wrong.', { detail: pickCardResponse }));

        } catch (error) {
            console.log("Error", error);
            return res.status(200).json(utils.apiResponseMessage(false, "Invalid auth token."));

        }
    } catch (error) {
        return res.status(500);
    }
}

exports.cardDrop = async (req, res) => {
    try {
        try {
            let rules = {
                "player_id": ["required", 'ObjectId'],
                "drop_card": ["required"]
            }

            // Get player id of logged in user
            const turn = await req.game.getTurn();
            const turnPlayer = await turn.getPlayer();
            if (turn.player_id.toString() !== req.currentPlayer._id.toString()) {
                req.body.drop_card = await turnPlayer.getDropCard();
                console.log("req.body.drop_card", req.body.drop_card);
            }


            let v = new niv.Validator(req.body, rules);
            let validation = await v.check();

            if (!validation) {
                return res.send(utils.apiResponse(false, "", v.errors));
            }

            const turnStatus = await turn.getStatus();

            // Check turn is picked
            if (turnStatus !== 'card_picked') return res.status(200).json(utils.apiResponseMessage(false, "Not allowed"));

            // verify player id with turn
            if (turn.player_id.toString() !== req.body.player_id) return res.status(200).json(utils.apiResponseMessage(false, "Invalid Player"));

            // check drop card exist in drop list
            const player = await GamePlayers.findById({ _id: req.body.player_id.toString() });
            if (!player.card_list.includes(req.body.drop_card)) return res.status(200).json(utils.apiResponseMessage(false, "Card does not exist"));

            // drop card & send response
            const indexOfCard = player.card_list.indexOf(req.body.drop_card);
            player.card_list.splice(indexOfCard, 1);
            await player.save();

            turn.dropped_card = req.body.drop_card;
            await turn.save();

            req.game.discard_card_list.push(req.body.drop_card);
            await req.game.save();

            return res.status(200).json(utils.apiResponse(true, 'Card drop successfully.', {drop_card: req.body.drop_card}));

        } catch (error) {
            console.log("Error", error);
            return res.status(200).json(utils.apiResponseMessage(false, "Invalid auth token."));

        }
    } catch (error) {
        return res.status(500);
    }
}

exports.checkWin = async (req, res) => {
    try {
        try {
            let rules = {
                "player_id": ["required", 'ObjectId']
            }

            // Get player id of logged in user
            const turn = await req.game.getTurn();
            const turnPlayer = await turn.getPlayer();

            let v = new niv.Validator(req.body, rules);
            let validation = await v.check();

            if (!validation) {
                return res.send(utils.apiResponse(false, "", v.errors));
            }

            const turnStatus = await turn.getStatus();

            // Check turn is picked
            if (turnStatus !== 'card_picked') return res.status(200).json(utils.apiResponseMessage(false, "Not allowed"));

            // verify player id with turn
            if (turn.player_id.toString() !== req.body.player_id) return res.status(200).json(utils.apiResponseMessage(false, "Invalid Player"));

            // Declare win
            const winResponse = await turn.isPlayerWin();
            
            if(winResponse.status){
                return res.status(200).json(utils.apiResponse(true, 'Game completed, you are the winner.', {player_id: req.body.player_id}));
            }

        } catch (error) {
            console.log("Error", error);
            return res.status(200).json(utils.apiResponseMessage(false, "Invalid auth token."));

        }
    } catch (error) {
        return res.status(500);
    }
}


exports.cardList = async (req, res) => {
    return res.status(200).json(utils.apiResponseData(true, helpers.cards));
}