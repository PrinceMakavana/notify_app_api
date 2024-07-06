"use strict"

const mongoose = require("mongoose");

/**
 * Users Schema
 */

const GameTurnsSchema = new mongoose.Schema({
    game_id: { type: mongoose.Schema.ObjectId },
    player_id: { type: mongoose.Schema.ObjectId },
    pick_card_from: { type: String, default: null },
    picked_card: { type: String, default: null },
    dropped_card: { type: String, default: null },
    turn_number: [{ type: String, default: null }],
}, {
    timestamps: true
});


GameTurnsSchema.methods.isPlayerWin = async function () {
    const GameTurns = mongoose.model('GameTurns');
    const Games = mongoose.model('Games');
    const GamePlayers = mongoose.model('GamePlayers');

    // Is last turn of Game
    const lastGameTurn = await GameTurns.findOne({ game_id: this.game_id }).sort({ createdAt: -1 }).exec();
    if (!lastGameTurn || lastGameTurn._id.toString() !== this._id.toString()) return { status: false };

    // Drop card must be null
    if (this.dropped_card !== null) return { status: false };

    // Player Has win cards?
    const player = await GamePlayers.findById({ _id: this.player_id.toString() });
    const isWinCardMatch = await player.isWinMatchCards();
    if (!isWinCardMatch) return { status: false };

    // Complete Game and store
    const game = await Games.findById({ _id: this.game_id.toString() });
    game.is_game_completed = true;
    game.winner_player_id = this.player_id;
    game.winner_cards_list = player.card_list;
    game.save();

    return { status: true };
}

GameTurnsSchema.methods.getPlayer = async function () {
    const GamePlayers = mongoose.model('GamePlayers');
    return await GamePlayers.findById({ _id: this.player_id.toString() });
}

GameTurnsSchema.methods.getStatus = async function () {
    let status = 'card_picked';
    if(this.dropped_card != null) status = 'card_dropped';
    return status;
}


mongoose.model("GameTurns", GameTurnsSchema);