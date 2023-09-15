/**
 * Represents the model for teen patti raking to choose winner or to eliminate user
 */
class TeenPattiHandRanking {
  /**
   * @constructor
   * @param {Number} handRank Represents rank of hand e.g., HighCard = 0, Pair = 1
   * @param {Number} unit Represents the unit of card. This is useful when HandRank is Draw
   */
  constructor(handRank, unit) {
    this.handRank = handRank;
    this.unit = unit;
  }

  toJson() {
    return {
      handRank: this.handRank,
      unit: this.unit
    }
  }
}

module.exports = TeenPattiHandRanking;
