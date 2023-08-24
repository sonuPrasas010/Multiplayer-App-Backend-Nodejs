class Card {
  constructor(rank, suits) {
    this.rank = rank;
    this.suits = suits;
  }
  
  toJson() {
    return {
      rank: this.rank,
      suits: this.suits
    };
  }
}
  
module.exports = Card;
