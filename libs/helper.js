const _ = require("lodash");
const fs = require("fs");
const { firebase_admin } = require("../config/firebase");
const bucket = firebase_admin.storage().bucket();

const CARD_TYPE_BAMBOOS = "bamboos";
const CARD_TYPE_CIRCLES = "circles";
const CARD_TYPE_CHARACTERS = "characters";
const CARD_TYPE_WINDS = "winds";
const CARD_TYPE_DRAGONS = "dragons";
const CARD_TYPE_FLOWERS = "flowers";

const PICK_CARD_FROM_REST = "rest";
const PICK_CARD_FROM_DISCARDED = "discarded";

const card_type_details = {
    // Bamboos Cards
    [CARD_TYPE_BAMBOOS]: {
        type: CARD_TYPE_BAMBOOS,
        is_orderable: true,
        is_identical: true,
    },
    // Characters Cardd
    [CARD_TYPE_CHARACTERS]: {
        type: CARD_TYPE_CHARACTERS,
        is_orderable: true,
        is_identical: true,
    },
    // Circle Cards
    [CARD_TYPE_CIRCLES]: {
        type: CARD_TYPE_CIRCLES,
        is_orderable: true,
        is_identical: true,
    },
    // Wind Cards
    [CARD_TYPE_WINDS]: {
        type: CARD_TYPE_WINDS,
        is_orderable: false,
        is_identical: true,
    },
    [CARD_TYPE_DRAGONS]: {
        type: CARD_TYPE_DRAGONS,
        is_orderable: false,
        is_identical: true,
    },
    [CARD_TYPE_FLOWERS]: {
        type: CARD_TYPE_FLOWERS,
        is_orderable: false,
        is_identical: false,
    },
};

const base_cards = [
    // Bamboos Cards
    ...(_.range(1, 10).map(value => ({
        id: `${CARD_TYPE_BAMBOOS}-${value}`,
        type: CARD_TYPE_BAMBOOS,
        number: value,
        is_orderable: true,
        is_identical: true,
    }))),
    // Characters Cardd
    ...(_.range(1, 10).map(value => ({
        id: `${CARD_TYPE_CHARACTERS}-${value}`,
        type: CARD_TYPE_CHARACTERS,
        number: value,
        is_orderable: true,
        is_identical: true,
    }))),
    // Circle Cards
    ...(_.range(1, 10).map(value => ({
        id: `${CARD_TYPE_CIRCLES}-${value}`,
        type: CARD_TYPE_CIRCLES,
        number: value,
        is_orderable: true,
        is_identical: true,
    }))),
    // Wind Cards
    ...['east', 'south', 'west', 'north'].map(value => ({
        id: `${CARD_TYPE_WINDS}-${value}`,
        type: CARD_TYPE_WINDS,
        number: null,
        is_orderable: false,
        is_identical: true,
    })),
    ...['red', 'green', 'white'].map(value => ({
        id: `${CARD_TYPE_DRAGONS}-${value}`,
        type: CARD_TYPE_DRAGONS,
        number: null,
        is_orderable: false,
        is_identical: true,
    })),
    ...['flower-1', 'flower-2'].map(value => ({
        id: `${CARD_TYPE_FLOWERS}-${value}`,
        type: CARD_TYPE_FLOWERS,
        number: null,
        is_orderable: false,
        is_identical: false,
    })),
];

const cards = _.flatten(base_cards.map(card => _.range(1, 5).map(value => card)))
const card_ids = cards.map(card => (card.id));

let helpers = {
    card_type_details,
    card_types: {
        CARD_TYPE_BAMBOOS,
        CARD_TYPE_CIRCLES,
        CARD_TYPE_CHARACTERS,
        CARD_TYPE_WINDS,
        CARD_TYPE_DRAGONS,
        CARD_TYPE_FLOWERS,
    },
    pick_card: {
        PICK_CARD_FROM_REST,
        PICK_CARD_FROM_DISCARDED
    },
    base_cards,
    cards,
    card_ids,
};

helpers.getCardTypeFromId = (card_id) => {
    return base_cards.find(card => card.id == card_id);
}

helpers.getCard = (card_list, rest_number, random_number) => {
    // Check rest number must be long
    rest_number = rest_number.toString();
    random_number = random_number.toString();
    if (rest_number.length < 2) rest_number = rest_number + random_number;

    // Get first item to check
    let indexToFind = rest_number.slice(0, 2);

    // get exact selected number
    indexToFind = indexToFind % card_list.length;

    // Remove that item from rest number
    rest_number = rest_number.slice(2, -1);

    let selectedCardID = card_list[indexToFind];
    card_list.splice(indexToFind, 1);

    // send back that value (selected card, rest_card_list, rest_number)
    return {
        selectedCardID, rest_number, card_list
    }
}

helpers.getMatchList = (card_list) => {
    const cardTypes = helpers.card_types;
    let detailedCardList = card_list.map(card_id => helpers.base_cards.find(card => card.id == card_id));
    let matched_list = [];
    let identically_matched_list = [];
    let sequentially_matched_list = [];

    for (const cardTypeKey in cardTypes) {
        const detailCardsOfType = detailedCardList.filter(card => card.type == cardTypes[cardTypeKey]);
        const restCardList = detailedCardList.filter(card => card.type != cardTypes[cardTypeKey])

        const matchTypeListResponse = helpers.getMatchListOfType(detailCardsOfType, cardTypes[cardTypeKey]);
        detailedCardList = [...restCardList, ...matchTypeListResponse.card_list];
        matched_list = [...matched_list, ...matchTypeListResponse.matched_list];
        identically_matched_list = [...identically_matched_list, ...matchTypeListResponse.identical_list];
        sequentially_matched_list = [...sequentially_matched_list, ...matchTypeListResponse.sequence_list];
    }

    let win_match = false;
    let win_match_code = null;
    if (detailedCardList.length == 2) {
        const win_match_response = helpers.match2Card(detailedCardList[0], detailedCardList[1]);
        if (win_match_response.status) {
            win_match = true;
            win_match_code = win_match_response.code;
            matched_list.push([...detailedCardList])
            detailedCardList = [];
        }
    }

    return {
        card_list: detailedCardList,
        matched_list,
        identically_matched_list,
        sequentially_matched_list,
        win_match,
        win_match_code
    };
}

helpers.getMatchListOfType = (card_list, card_type) => {
    let _matchList1 = [];
    let _cardList1 = [...card_list];
    let sequenceMatchedList1 = [];
    let identialMatchedList1 = [];
    let _matchList2 = [];
    let _cardList2 = [...card_list];
    let sequenceMatchedList2 = [];
    let identialMatchedList2 = [];

    const cardTypeDetail = helpers.card_type_details[card_type];

    // Start First match
    if (cardTypeDetail.is_identical) {
        let identicalMatchResponse = helpers.findIdenticalFromList(_cardList1, []);
        _cardList1 = identicalMatchResponse.card_list;
        identialMatchedList1 = identicalMatchResponse.matched_list;
    }

    if (cardTypeDetail.is_orderable) {
        let matchResponse = helpers.findSequenceFromList(_cardList1, []);
        _cardList1 = matchResponse.card_list;
        sequenceMatchedList1 = matchResponse.matched_list;
    }
    _matchList1 = [...identialMatchedList1, ...sequenceMatchedList1]

    // Start Second match
    if (cardTypeDetail.is_orderable) {
        let matchResponse2 = helpers.findSequenceFromList(_cardList2, []);
        _cardList2 = matchResponse2.card_list;
        sequenceMatchedList2 = matchResponse2.matched_list;
    }
    if (cardTypeDetail.is_identical) {
        let identicalMatchResponse2 = helpers.findIdenticalFromList(_cardList2, []);
        _cardList2 = identicalMatchResponse2.card_list;
        identialMatchedList2 = identicalMatchResponse2.matched_list;
    }
    _matchList2 = [...identialMatchedList2, ...sequenceMatchedList2]

    return _matchList1.length > _matchList2.length ? {
        matched_list: _matchList1, card_list: _cardList1,
        identical_list: identialMatchedList1, sequence_list: sequenceMatchedList1
    } : {
        matched_list: _matchList2, card_list: _cardList2,
        identical_list: identialMatchedList2, sequence_list: sequenceMatchedList2
    };
}

/**
 * 
 * @param {*} card_list Card list should have cards of same types
 */
helpers.findIdenticalFromList = (card_list, matched_list = []) => {
    const current_matched_list = [];

    // get all unique cards
    const unique_cards = _.uniqBy(card_list, 'id');

    // find match
    for (const unique_card of unique_cards) {
        const unique_card_id = unique_card.id;
        let _new_card_list = [...card_list];
        const matchedItems = [];

        for (const key in _.range(0, 3)) {
            const matchIndex = _new_card_list.findIndex(card => card.id == unique_card_id);
            if (matchIndex == -1) break;
            else {
                matchedItems.push(unique_card);
                _new_card_list.splice(matchIndex, 1);
            };
        }

        if (matchedItems.length == 3) {
            card_list = [..._new_card_list];
            current_matched_list.push(matchedItems);
        }
    }

    matched_list = [...matched_list, ...current_matched_list];
    if (current_matched_list.length == 0 || card_list.length == 0) return { card_list, matched_list };
    else return helpers.findIdenticalFromList(card_list, matched_list)

}
/**
 * 
 * @param {*} card_list Card list should have cards of same types
 */
helpers.findSequenceFromList = (card_list, matched_list = []) => {
    let current_matched_list = [];

    if (card_list.length == 0) return { card_list, matched_list }

    const maxCard = _.maxBy(card_list, 'number');

    for (let index = 1; index <= maxCard.number; index++) {
        const matchedItems = [];
        let _new_card_list = [...card_list];
        for (let _index = 0; _index < 3; _index++) {
            const matchIndex = _new_card_list.findIndex(card => card.number == (index + _index));
            if (matchIndex == -1) break;
            else {
                matchedItems.push(_new_card_list[matchIndex]);
                _new_card_list.splice(matchIndex, 1);
            }
        }

        if (matchedItems.length == 3) {
            card_list = [..._new_card_list];
            current_matched_list.push(matchedItems);
        }
    }

    matched_list = [...matched_list, ...current_matched_list];
    if (current_matched_list.length == 0 || card_list.length == 0) return { card_list, matched_list };
    else return helpers.findSequenceFromList(card_list, matched_list)

}

helpers.match2Card = (card1, card2) => {
    // card1 = helpers.getCardTypeFromId(card1)
    // card2 = helpers.getCardTypeFromId(card2)
    if (card1.type != card2.type) return { status: false };

    if (card_type_details[card1.type].is_identical) {
        if (card1.id == card2.id) return { status: true, code: 'identical' };
    }

    if (card_type_details[card1.type].is_orderable) {
        const maxCard = _.maxBy([card1, card2], 'number');
        const minCard = _.minBy([card1, card2], 'number');
        if ((maxCard.number - minCard.number) == 1) return { status: true, code: 'sequence' };
    }
    return { status: false };
}

helpers.getAudioFile = async (fileName) => {
    const filePath = `${__dirname}/../uploads/audio-files/${fileName}`;
    if (fileName && fileName.length && fs.existsSync(filePath)) {
        return true;
    } else if (fileName) {
        const options = {
            destination: filePath
        }
        try {
            const firebaseDocumentPath = `audios/${fileName}`;
            await bucket.file(firebaseDocumentPath).download(options);
            return true;
        } catch (error) {
            return false;
        }
    } else {
        return false;
    }
}

module.exports = helpers;