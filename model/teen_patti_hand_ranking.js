const Card = require("./card");

/**
 * Represents the model for teen patti raking to choose winner or to eliminate user
 */
class TeenPattiHandRanking {
  /**
   * @constructor
   * @param {Number} handRank Represents rank of hand e.g., HighCard = 0, Pair = 1
   * @param {Number} unit Represents the unit of card. This is useful when HandRank is Draw
   * @param {Model} user Represents who is the owner of the cards
   * @param {Array<Card>} cards Represents the cards as the models data
   */
  constructor(handRank, unit, user, cards) {
    this.handRank = handRank;
    this.unit = unit;
    this.user = user;
    this.cards = cards;
  }

  toJson() {
    return {
      handRank: this.handRank,
      unit: this.unit,
      user: this.user,
      cards: this.cards
    }
  }
}

module.exports = TeenPattiHandRanking;
