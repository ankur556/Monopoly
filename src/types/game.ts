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

export interface Player {
  id: PlayerId;
  name: string;
  balance: number;
  position: number;
  inJail: boolean;
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
  // The typed effect to execute when the card is dismissed
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
}

export const INITIAL_AUCTION_STATE: AuctionState = {
  status: "idle",
  propertyId: null,
  currentBidderIndex: 0,
  bids: {},
  passedPlayerIds: [],
  winnerId: null,
};

/** @deprecated Use BoardSquare */
export type Property = BoardSquare;
