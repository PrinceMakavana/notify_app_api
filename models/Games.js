"use strict"

const mongoose = require("mongoose");
const helpers = require("../libs/helper");
const utils = require("../libs/utils");
const _ = require('lodash');

/**
 * Users Schema
 */

const GamesSchema = new mongoose.Schema({
    generated_number: { type: String, default: null },
    used_generated_number: { type: String, default: null },
    rest_card_list: [{ type: String, default: null }],
    discard_card_list: [{ type: String, default: null }],
    is_game_completed: { type: Boolean, default: false },
    player_id_in_sequence: [{ type: mongoose.Schema.ObjectId, default: null }],
    last_term_id: { type: mongoose.Schema.ObjectId, default: null },
    last_term_player_id: { type: mongoose.Schema.ObjectId, default: null },
    winner_player_id: { type: mongoose.Schema.ObjectId, default: null },
    winner_cards_list: [{ type: String, default: null }],
    flower_card_list: [{ type: String, default: null }],
}, {
    timestamps: true
});

GamesSchema.statics = {

    startGame: async function (user_id, random_number) {
        const Games = mongoose.model('Games');
        const GamePlayers = mongoose.model('GamePlayers');

        // Create Game
        const game = new Games();
        game.generated_number = utils.random(304);
        // Generate secret number 
        game.used_generated_number = utils.random(304);
        game.rest_card_list = helpers.card_ids;
        game.discard_card_list = [];
        await game.save();

        // Add main user to Game player
        
        // Generate 3 more users for game
        const currentPlayerNumber = 4;
        // const currentPlayerNumber = _.random(1, 4);
        let players = _.range(1, 5).map(number => number == currentPlayerNumber ? user_id : null);
        
        let playerCards = {};
        let playerUnusedCards = {};
        for (const key in players) {
            const _playerDetail = await game.addPlayer(players[key]);
            if (!_playerDetail.status) return { status: false };
            players[key] = _playerDetail.player_id;
            playerCards[players[key].toString()] = [];
            playerUnusedCards[players[key].toString()] = [];
        }
        game.player_id_in_sequence = players;;
        await game.save();

        // Assign cards to game members
        const cardAssignment = _.range(0, 4);
        let rest_card_list = game.rest_card_list;
        let used_generated_number = game.used_generated_number;
        let generated_number = game.generated_number;
        for (const key in cardAssignment) {
            for (const playerId in playerCards) {
                const cardToAssign = _.range(0, key > 2 ? 1 : 4);
                let pickCardDetail;
                for (const iterator of cardToAssign) {
                    let cardPicked = false;
                    do {
                        pickCardDetail = helpers.getCard(rest_card_list, used_generated_number, generated_number);
                        rest_card_list = pickCardDetail.card_list;
                        used_generated_number = pickCardDetail.rest_number;

                        if (helpers.getCardTypeFromId(pickCardDetail.selectedCardID).type !== helpers.card_types.CARD_TYPE_FLOWERS) {
                            playerCards[playerId].push(pickCardDetail.selectedCardID);
                            cardPicked = true;
                        } else {
                            playerUnusedCards[playerId].push(pickCardDetail.selectedCardID);
                        }

                    } while (!cardPicked);

                }
            }
        }

        // Save assigned card details to game
        game.rest_card_list = rest_card_list;
        game.used_generated_number = used_generated_number;
        game.generated_number = generated_number;
        await game.save();

        for (const player_id in playerCards) {
            let player = await GamePlayers.findById(utils.getObjectID(player_id));
            if (!player) return { status: false };
            player.card_list = playerCards[player_id];
            player.flower_card_list = playerUnusedCards[player_id];;
            await player.save();
        }

        // Pick new card for first member
        const nextPlayerId = await game.getNextTurnPlayer();
        await game.doMemeberTurnPick(nextPlayerId)

        return { status: true, game_id: game._id };
    },

}

GamesSchema.methods.addPlayer = async function (user_id = null) {
    const GamePlayers = mongoose.model('GamePlayers');
    const Users = mongoose.model('Users');

    // Check total players must not be more than 4
    //  - Get count of all the players of the game
    let totalPayers = await GamePlayers.countDocuments({ game_id: this._id });

    if (totalPayers >= 4) { return { status: false }; }

    const _userID = typeof user_id == 'string' ? utils.getObjectID(user_id) : user_id;

    const user = _userID != null ? await Users.findById(_userID) : null;

    // Add Player to Game
    let gamePlayer = new GamePlayers();
    gamePlayer.game_id = this._id;
    gamePlayer.user_id = _userID;
    gamePlayer.player_name = user !== null ? user.email : utils.random(5);
    gamePlayer.player_index = totalPayers + 1;
    gamePlayer.is_main = user !== null ? true : false;
    await gamePlayer.save();

    return { status: true, player_id: gamePlayer._id };
}

GamesSchema.methods.doMemeberTurnPick = async function (player_id, pick_from = helpers.pick_card.PICK_CARD_FROM_REST) {

    
    const GamePlayers = mongoose.model('GamePlayers');
    const GameTurns = mongoose.model('GameTurns');

    // Check Previous Turn is completed

    // Also player should have only 13 cards
    const player = await GamePlayers.findById({ _id: player_id.toString() });
    if (player.card_list.length !== 13) return { status: false, error_code: "player_card_list_should_have_only_13" };

    // Check player turn is right ?
    const nextTurnPlayerId = await this.getNextTurnPlayer();
    if (nextTurnPlayerId !== player_id.toString()) return { status: false, error_code: "this_player_does_not_have_turn" };

    // Check pick card from list has cards
    if (pick_from == helpers.pick_card.PICK_CARD_FROM_REST && this.rest_card_list.length == 0) return { status: false, error_code: "rest_card_list_is_empty" };
    if (pick_from == helpers.pick_card.PICK_CARD_FROM_DISCARDED && this.discard_card_list.length == 0) return { status: false, error_code: "discard_card_list_is_empty" };

    // If pick card from discard it should have atleast one sequence
    if (pick_from == helpers.pick_card.PICK_CARD_FROM_DISCARDED && !player.canPickCardFromDiscardList()) {
        return { status: false, error_code: "player_could_not_pick_from_discard_list" };
    }

    // Pick card
    let cardPicked = false;
    let selectedCard = null;
    if (pick_from == helpers.pick_card.PICK_CARD_FROM_REST) {
        let rest_card_list = this.rest_card_list;
        let used_generated_number = this.used_generated_number;
        let generated_number = this.generated_number;

        let pickCardDetail = helpers.getCard(rest_card_list, used_generated_number, generated_number);
        rest_card_list = pickCardDetail.card_list;
        used_generated_number = pickCardDetail.rest_number;

        selectedCard = pickCardDetail.selectedCardID;

        // selectedCard = "winds-east"
        
        if (helpers.getCardTypeFromId(selectedCard).type !== helpers.card_types.CARD_TYPE_FLOWERS) {
            cardPicked = true;

            // Save cards in Game
            this.rest_card_list = rest_card_list;
            this.used_generated_number = used_generated_number;
            this.generated_number = generated_number;
            await this.save();

            // Save game player details
            player.card_list.push(selectedCard);
            await player.save();

        } else {
            this.rest_card_list = rest_card_list;
            this.used_generated_number = used_generated_number;
            this.generated_number = generated_number;
            this.flower_card_list.push(selectedCard);
            await this.save();

            player.flower_card_list.push(selectedCard);
            await player.save();
        }

    } else {
        let discard_card_list = this.discard_card_list;
        selectedCard = discard_card_list.pop();
        cardPicked = true;

        this.discard_card_list = discard_card_list;
        await this.save();

        // Save game player details
        player.card_list.push(selectedCard);
        await player.save();
    }
    if (cardPicked) {
        // Store to Game Turn Details
        const gameTurn = new GameTurns();
        gameTurn.game_id = this._id;
        gameTurn.player_id = player._id;
        gameTurn.pick_card_from = pick_from;
        gameTurn.picked_card = selectedCard;
        await gameTurn.save();

        this.last_term_id = gameTurn._id;
        this.last_term_player_id = player._id;
        await this.save();

        // Check For Win logic
        const isWin = await gameTurn.isPlayerWin();

    }
    // Send success response
    return { status: true, card: selectedCard }

}

GamesSchema.methods.getNextTurnPlayer = async function () {
    const players_in_sequence = this.player_id_in_sequence.map(player_id => player_id.toString());
    const current_player_id = this.last_term_player_id !== null ? this.last_term_player_id.toString() : null;
    let nextPlayerIndex = 0;

    if (current_player_id !== null) {
        let currentPlayerIndex = players_in_sequence.indexOf(current_player_id);
        nextPlayerIndex = (currentPlayerIndex + 1) % players_in_sequence.length;
    }
    return players_in_sequence[nextPlayerIndex];
}

GamesSchema.methods.isLastTurnCompleted = async function () {
    const GameTurns = mongoose.model('GameTurns');
    const gameTurn = await GameTurns.findById({ _id: this.last_term_id.toString() });
    if(!gameTurn || gameTurn.dropped_card !== null) return true;
    return false;
}

GamesSchema.methods.getTurn = async function () {
    const GameTurns = mongoose.model('GameTurns');
    const gameTurn = await GameTurns.findById({ _id: this.last_term_id.toString() });
    return gameTurn;
}

GamesSchema.methods.getPlayerOfUser = async function (user_id) {
    const GamePlayers = mongoose.model('GamePlayers');
    const gamePlayer = await GamePlayers.findOne({ game_id: this._id, is_main: true, user_id: user_id }).lean();
    return gamePlayer;
}

GamesSchema.methods.getWinnerOfGame = async function () {
    if(this.winner_player_id){
        const GamePlayers = mongoose.model('GamePlayers');
        const gamePlayer = await GamePlayers.findOne({ game_id: this._id, _id: this.winner_player_id }).lean();
        return gamePlayer;
    }else{
        return false;
    }
}

mongoose.model("Games", GamesSchema);