"use strict"

const mongoose = require("mongoose");
const helpers = require("../libs/helper");
const _ = require('lodash');

/**
 * Users Schema
 */

const GamePlayersSchema = new mongoose.Schema({
    game_id: { type: mongoose.Schema.ObjectId },
    user_id: { type: mongoose.Schema.ObjectId, default: null },
    player_name: { type: String, default: null },
    player_index: { type: Number },
    is_main: { type: Boolean, default: null },
    card_list: [{ type: String, default: null }],
    flower_card_list: [{ type: String, default: null }],
}, {
    timestamps: true
});

GamePlayersSchema.methods.getAllMatchCardInDetail = async function (){
    return helpers.getMatchList(this.card_list);
}
GamePlayersSchema.methods.getAllMatchCardInIds = async function (){
    const matchCardResponse = helpers.getMatchList(this.card_list);
    const card_list = matchCardResponse.card_list.map(card => card.id);
    const matched_list = matchCardResponse.matched_list.map(cards => cards.map(card => card.id));
    const identically_matched_list = matchCardResponse.identically_matched_list.map(cards => cards.map(card => card.id));
    const sequentially_matched_list = matchCardResponse.sequentially_matched_list.map(cards => cards.map(card => card.id));
    return {
        card_list,
        matched_list,
        identically_matched_list,
        sequentially_matched_list,
        win_match: matchCardResponse.win_match,
        win_match_code: matchCardResponse.win_match_code
    }
}

GamePlayersSchema.methods.canPickCardFromDiscardList = async function () {
    let matchCardResponse = await this.getAllMatchCardInIds();
    return matchCardResponse.matched_list.length > 0 ? true : false;
}

GamePlayersSchema.methods.isWinMatchCards = async function () {
    if(this.card_list.length == 14){
        let matchCardResponse = helpers.getMatchList(this.card_list);
        return matchCardResponse.win_match ? true : false;
    }else{
        return false;
    }
}

GamePlayersSchema.methods.getDropCard = async function () {
    const getMatchCardDetails = await this.getAllMatchCardInIds();
    let drop_card = _.sample(this.card_list);
    if(getMatchCardDetails.card_list.length > 0){
        drop_card = _.sample(getMatchCardDetails.card_list);
    }
    return drop_card;
}

GamePlayersSchema.methods.pickCardFrom = async function () {
    const getMatchCardDetails = await this.getAllMatchCardInIds();
    
    let drop_card = _.sample(this.card_list);
    if(getMatchCardDetails.card_list.length > 0){
        drop_card = _.sample(getMatchCardDetails.card_list);
    }
    return drop_card;
}


mongoose.model("GamePlayers", GamePlayersSchema);