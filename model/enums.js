const MessageType = {
  BotSuccess: "BotSuccess",
  BotInfo: "BotInfo",
  BotDanger: "BotDanger",
  CardShow: "CardShow",
  WinnerAnnouncement: "WinnerAnnouncement",
  UserMessage: "UserMessage"
};

const GameStatus = {
  Ideal: "Ideal",
  Starting: "Starting",
  Joining: "Joining",
  Playing: "Playing",
  Waiting: "Waiting",
  Checking: "Checking",
  YourTurn: "YourTurn",
  Draw: "Draw"
};

const Suit = {
  Spade: 0,
  Heart: 1,
  Diamond: 2,
  Club: 3
};

const Rank = {
  Ace: 0,
  Two: 1,
  Three: 2,
  Four: 3,
  Five: 4,
  Six: 5,
  Seven: 6,
  Eight: 7,
  Nine: 8,
  Ten: 9,
  Jack: 10,
  Queen: 11,
  King: 12
};

const HandRanking = {
  HighCard: 0,
  Pair: 1,
  Color: 2,
  Sequence: 3,
  PureSequence: 4,
  Trail: 5
};

const MatchResult = {
  Draw: "Draw",
  Finished: "Finished",
  NextRound: "NextRound"
}

const MatchEvent = {
  GameInfo: "gameInfo",
  RoomMessage: "roomMessage"
}
  
module.exports = { MessageType, GameStatus, Suit, Rank, HandRanking, MatchResult, MatchEvent };
