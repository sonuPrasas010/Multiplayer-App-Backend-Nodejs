/**
 * Represents a playing card.
 * @class
 */
class Card {
  /**
   * Creates a new card.
   * @constructor
   * @param {Number} rank - The rank of the card (e.g., 'Ace', '2', 'King').
   * @param {Number} suits - The suits of the card (e.g., Spade: 0, Heart: 1, Diamond: 2, Club: 3).
   */
  constructor(rank, suits) {
    this.rank = rank;
    this.suits = suits;
  }
  
  /**
   * Converts the card to a JSON representation.
   * @returns {Object} A JSON object representing the card.
   */
  toJson() {
    return {
      rank: this.rank,
      suits: this.suits
    };
  }
}

module.exports = Card;
