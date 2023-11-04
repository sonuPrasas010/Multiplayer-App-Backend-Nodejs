const MessageType = {
  BotSuccess: "BotSuccess",
  BotInfo: "BotInfo",
  BotDanger: "BotDanger",
  CardShow: "CardShow",
  WinnerAnnouncement: "WinnerAnnouncement",
  UserMessage: "UserMessage",
  /** @type {String} This is used for block games  */
  CancelMatch: "CancelMatch"
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

/**
 * @enum {string}
 */
const MatchEvent = {
  /** @type {string} */
  GameInfo: "gameInfo",
  /** @type {string} */
  RoomMessage: "roomMessage",
  /** @type {string} */
  GameStatus: "gameStatus",
  /** @type {string} */
  AmIActive: "amIActive",
  /** @type {string} */
  Points: "points",
  /** @type {string} */
  StartTime: "startTime",
  /** @type {string} For block games */
  Joined: "joined",
  /** @type {string} For block games */
  Turn: "turn",
  /** @type {string} */
  Cancelled: "cancelled",
  /** @type {string} */
  WinnerAnnouncement: "winnerAnnouncement",
  /** @type {string} Emitted by client */
  ClientMessage: "clientMessage",
  /** @type {string} Emitted by client */
  StartMatch: "startMatch",
  /** @type {string} Emitted by client */
  Show: "show"
  // Add your new events here
};

const ServerEvents = {
  ServerJoined: "serverJoined",
  SwitchTurn: "switchTurn"
}
  
module.exports = { MessageType, GameStatus, Suit, Rank, HandRanking, MatchResult, MatchEvent, SentBy, ServerEvents };
