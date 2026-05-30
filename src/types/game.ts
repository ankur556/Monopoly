export type PlayerId = string;

export type ColorGroup =
  | "brown"
  | "light-blue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "dark-blue"
  | "railroad"
  | "utility";

export type SquareType =
  | "go"
  | "property"
  | "railroad"
  | "utility"
  | "chance"
  | "chest"
  | "tax"
  | "jail"
  | "free-parking"
  | "go-to-jail";

export type AnnouncementVariant =
  | "turn"
  | "rent"
  | "jail"
  | "card"
  | "go"
  | "default";

/**
 * PRE_ROLL  — waiting for the player to roll (or choose jail options)
 * ROLLING   — token is animating along the board
 * POST_ROLL — player has landed; they must press "End Turn" to continue
 */
export type TurnPhase = "PRE_ROLL" | "ROLLING" | "POST_ROLL";

export interface Player {
  id: PlayerId;
  name: string;
  balance: number;
  position: number;
  inJail: boolean;
  /** How many consecutive failed jail-break rolls (0–3) */
  jailTurns: number;
  /** Consecutive doubles rolled this turn (resets on non-double or new turn) */
  doublesCount: number;
  /** Number of Get Out of Jail Free cards held */
  getOutOfJailFreeCards: number;
  /** Whether the player has been declared bankrupt and is out of the game */
  isBankrupt?: boolean;
}

export interface RentSchedule {
  base: number;
  oneHouse: number;
  twoHouses: number;
  threeHouses: number;
  fourHouses: number;
  hotel: number;
}

export interface BoardSquare {
  id: string;
  boardIndex: number;
  name: string;
  type: SquareType;
  colorGroup?: ColorGroup;
  price?: number;
  rent?: RentSchedule;
  houseCost?: number;
  taxAmount?: number;
  ownerId: PlayerId | null;
  /** Whether the property is currently mortgaged */
  mortgaged?: boolean;
  houses: number;
}

export type PendingAction =
  | { type: "buy"; propertyId: string }
  | null;

export interface ActionLogEntry {
  id: string;
  text: string;
  timestamp: number;
}

export interface CardReveal {
  kind: "chance" | "chest";
  title: string;
  body: string;
  squareId: string;
  /** The typed effect to execute when the card is dismissed */
  effect: import("../data/cardDecks").CardEffect;
}

export interface LedgerEntry {
  id: string;
  turn: number;
  type:
    | "go"
    | "rent"
    | "purchase"
    | "tax"
    | "build"
    | "trade"
    | "bankruptcy"
    | "mortgage"
    | "salary"
    | "card";
  fromPlayerId?: PlayerId;
  toPlayerId?: PlayerId;
  amount: number;
  propertyId?: string;
  message: string;
}

export interface TradeOffer {
  senderId: PlayerId;
  receiverId: PlayerId;
  moneyOfferedBySender: number;
  moneyOfferedByReceiver: number;
  propertiesOfferedBySender: string[];
  propertiesOfferedByReceiver: string[];
  /** Get Out of Jail Free cards offered by the sender */
  jailCardsOfferedBySender: number;
  /** Get Out of Jail Free cards offered by the receiver */
  jailCardsOfferedByReceiver: number;
}

export type TradeStatus = "idle" | "composing" | "pending";

export interface TradeState {
  status: TradeStatus;
  offer: TradeOffer | null;
  draft: TradeOffer | null;
}

export const INITIAL_TRADE_STATE: TradeState = {
  status: "idle",
  offer: null,
  draft: null,
};

/** State for a property auction (triggered when a player declines to buy) */
export interface AuctionState {
  /** "idle" = no auction, "active" = bidding in progress, "concluded" = winner decided */
  status: "idle" | "active" | "concluded";
  propertyId: string | null;
  /** Index of the player whose turn it is to bid (in active phase) */
  currentBidderIndex: number;
  /** Each player's current highest bid, keyed by playerId */
  bids: Record<PlayerId, number>;
  /** Players who have passed / withdrawn from the auction */
  passedPlayerIds: PlayerId[];
  /** PlayerId of the winner (set when concluded), null = no winner (property unsold) */
  winnerId: PlayerId | null;
  /** True when this auction is part of a voluntary bankruptcy property liquidation chain */
  isBankruptcyAuction: boolean;
  /** The bankrupt player whose properties are being auctioned (if isBankruptcyAuction) */
  bankruptPlayerId: PlayerId | null;
}

export const INITIAL_AUCTION_STATE: AuctionState = {
  status: "idle",
  propertyId: null,
  currentBidderIndex: 0,
  bids: {},
  passedPlayerIds: [],
  winnerId: null,
  isBankruptcyAuction: false,
  bankruptPlayerId: null,
};

/** @deprecated Use BoardSquare */
export type Property = BoardSquare;
