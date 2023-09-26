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
  AceTwoThreeSequence: 4,
  AceQueenKingSequence: 5,
  PureSequence: 6,
  AceTwoThreePureSequence: 7,
  AceQueenKingPureSequence: 8,
  Trail: 9
};

const MatchResult = {
  Draw: "Draw",
  Finished: "Finished",
  NextRound: "NextRound"
}

const SentBy = {
  User: "User",
  Bot: "Bot"
}

const MatchEvent = {
  GameInfo: "gameInfo",
  RoomMessage: "roomMessage",
  GameStatus: "gameStatus",
  AmIActive: "amIActive",
  ClientMessage: "clientMessage",
  Points: "points"
}
  
module.exports = { MessageType, GameStatus, Suit, Rank, HandRanking, MatchResult, MatchEvent, SentBy };
