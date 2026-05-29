import { create } from "zustand";
import {
  createInitialSquares,
  COLOR_GROUP_MEMBERS,
} from "../data/boardDefinitions";
import {
  drawChanceCard,
  drawCommunityChestCard,
} from "../data/cardDecks";
import { canBuildOn } from "../lib/building";
import { executeTrade } from "../lib/executeTrade";
import { appendActionLog } from "../lib/events";
import { getSquareAtIndex } from "../lib/gameLogic";
import { createLedgerEntry } from "../lib/ledger";
import { computeMove } from "../lib/movement";
import { calculateRent, isPurchasable } from "../lib/rent";
import type {
  ActionLogEntry,
  AnnouncementVariant,
  BoardSquare,
  CardReveal,
  LedgerEntry,
  PendingAction,
  Player,
  PlayerId,
  TradeOffer,
  TradeState,
} from "../types/game";
import { INITIAL_TRADE_STATE } from "../types/game";

interface GameState {
  players: Player[];
  squares: BoardSquare[];
  currentPlayerIndex: number;
  turnNumber: number;
  lastRoll: number | null;
  lastDie1: number | null;
  lastDie2: number | null;
  pendingAction: PendingAction;
  message: string;
  ledger: LedgerEntry[];
  actionLog: ActionLogEntry[];
  activeAnnouncement: string | null;
  announcementVariant: AnnouncementVariant;
  highlightedSquareId: string | null;
  cardReveal: CardReveal | null;
  trade: TradeState;
  selectedPropertyId: string | null;
  propertyCardFlipped: boolean;
  isRolling: boolean;
  logAction: (text: string) => void;
  showAnnouncement: (text: string, variant?: AnnouncementVariant) => void;
  clearAnnouncement: () => void;
  completeCardReveal: () => void;
  rollDice: () => void;
  finishRoll: () => void;
  buyProperty: () => void;
  declineBuy: () => void;
  buildHouse: (propertyId: string) => void;
  endTurn: () => void;
  setSelectedPropertyId: (id: string | null) => void;
  setPropertyCardFlipped: (flipped: boolean) => void;
  openTrade: () => void;
  updateTradeDraft: (partial: Partial<TradeOffer>) => void;
  sendTradeOffer: () => void;
  acceptTrade: () => void;
  declineTrade: () => void;
  counterTrade: () => void;
  cancelTrade: () => void;
}

const INITIAL_PLAYERS: Player[] = [
  { id: "p1", name: "Player 1", balance: 1500, position: 0, inJail: false },
  { id: "p2", name: "Player 2", balance: 1500, position: 0, inJail: false },
];

const HUGE_RENT_THRESHOLD = 100;

function nextPlayerIndex(current: number): number {
  return (current + 1) % 2;
}

function getOpponentId(players: Player[], currentId: PlayerId): PlayerId {
  return players.find((p) => p.id !== currentId)!.id;
}

function emptyDraft(senderId: PlayerId, receiverId: PlayerId): TradeOffer {
  return {
    senderId,
    receiverId,
    moneyOfferedBySender: 0,
    moneyOfferedByReceiver: 0,
    propertiesOfferedBySender: [],
    propertiesOfferedByReceiver: [],
  };
}

function getGroupIds(square: BoardSquare): string[] {
  if (!square.colorGroup) return [];
  return COLOR_GROUP_MEMBERS[square.colorGroup] ?? [];
}

function appendLedger(
  ledger: LedgerEntry[],
  entry: Omit<LedgerEntry, "id">,
): LedgerEntry[] {
  return [...ledger, createLedgerEntry(entry)];
}

function validateDraft(
  draft: TradeOffer,
  players: Player[],
  squares: BoardSquare[],
): string | null {
  const sender = players.find((p) => p.id === draft.senderId);
  const receiver = players.find((p) => p.id === draft.receiverId);
  if (!sender || !receiver) return "Invalid trade participants.";

  if (draft.moneyOfferedBySender < 0 || draft.moneyOfferedByReceiver < 0) {
    return "Money amounts cannot be negative.";
  }
  if (draft.moneyOfferedBySender > sender.balance) {
    return "You cannot offer more cash than you have.";
  }
  if (draft.moneyOfferedByReceiver > receiver.balance) {
    return "Cannot request more cash than opponent has.";
  }

  for (const id of draft.propertiesOfferedBySender) {
    const sq = squares.find((s) => s.id === id);
    if (!sq || sq.ownerId !== sender.id) {
      return "You can only offer properties you own.";
    }
  }
  for (const id of draft.propertiesOfferedByReceiver) {
    const sq = squares.find((s) => s.id === id);
    if (!sq || sq.ownerId !== receiver.id) {
      return "You can only request properties the opponent owns.";
    }
  }

  const hasAssets =
    draft.moneyOfferedBySender > 0 ||
    draft.moneyOfferedByReceiver > 0 ||
    draft.propertiesOfferedBySender.length > 0 ||
    draft.propertiesOfferedByReceiver.length > 0;

  if (!hasAssets) return "Trade must include at least one asset.";

  return null;
}

function transferMoney(
  players: Player[],
  fromId: PlayerId,
  toId: PlayerId,
  amount: number,
): Player[] {
  const paid = Math.min(amount, players.find((p) => p.id === fromId)!.balance);
  return players.map((p) => {
    if (p.id === fromId) return { ...p, balance: p.balance - paid };
    if (p.id === toId) return { ...p, balance: p.balance + paid };
    return p;
  });
}

export const useGameStore = create<GameState>((set, get) => ({
  players: INITIAL_PLAYERS.map((p) => ({ ...p })),
  squares: createInitialSquares(),
  currentPlayerIndex: 0,
  turnNumber: 1,
  lastRoll: null,
  lastDie1: null,
  lastDie2: null,
  pendingAction: null,
  message: "Roll the dice to begin.",
  ledger: [],
  actionLog: [
    {
      id: "log-0",
      text: "Game started — Player 1's turn",
      timestamp: Date.now(),
    },
  ],
  activeAnnouncement: "PLAYER 1'S TURN",
  announcementVariant: "turn",
  highlightedSquareId: null,
  cardReveal: null,
  trade: { ...INITIAL_TRADE_STATE },
  selectedPropertyId: null,
  propertyCardFlipped: false,
  isRolling: false,

  logAction: (text) => {
    set((s) => ({ actionLog: appendActionLog(s.actionLog, text) }));
  },

  showAnnouncement: (text, variant = "default") => {
    set({
      activeAnnouncement: text,
      announcementVariant: variant,
    });
  },

  clearAnnouncement: () => {
    set({ activeAnnouncement: null, announcementVariant: "default" });
  },

  completeCardReveal: () => {
    const state = get();
    if (!state.cardReveal) return;

    const { body, title } = state.cardReveal;
    set({
      cardReveal: null,
      highlightedSquareId: null,
    });
    get().showAnnouncement(`${title}\n${body}`, "card");
    setTimeout(() => get().endTurn(), 2100);
  },

  setSelectedPropertyId: (id) => {
    set({ selectedPropertyId: id, propertyCardFlipped: false });
  },

  setPropertyCardFlipped: (flipped) => set({ propertyCardFlipped: flipped }),

  endTurn: () => {
    const state = get();
    const nextIndex = nextPlayerIndex(state.currentPlayerIndex);
    const nextPlayer = state.players[nextIndex];

    set({
      currentPlayerIndex: nextIndex,
      turnNumber:
        state.currentPlayerIndex === 1
          ? state.turnNumber + 1
          : state.turnNumber,
      lastRoll: null,
      lastDie1: null,
      lastDie2: null,
      pendingAction: null,
    });

    const turnLabel = `${nextPlayer.name.toUpperCase()}'S TURN`;
    get().logAction(`${nextPlayer.name}'s turn`);
    get().showAnnouncement(turnLabel, "turn");
    set({ message: `${nextPlayer.name}, roll the dice.` });
  },

  rollDice: () => {
    const state = get();
    if (
      state.pendingAction ||
      state.trade.status !== "idle" ||
      state.isRolling ||
      state.cardReveal
    ) {
      return;
    }
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;
    set({
      isRolling: true,
      lastRoll: total,
      lastDie1: die1,
      lastDie2: die2,
    });
  },

  finishRoll: () => {
    const state = get();
    if (!state.isRolling || state.lastRoll === null) return;

    const roll = state.lastRoll;
    const playerIndex = state.currentPlayerIndex;
    const player = state.players[playerIndex];
    const move = computeMove(player.position, roll);

    get().logAction(`${player.name} rolled a ${roll}`);

    let players = state.players.map((p, i) =>
      i === playerIndex
        ? { ...p, position: move.newPosition, balance: p.balance + move.goSalary }
        : p,
    );

    let ledger = state.ledger;
    let message = `${player.name} rolled ${roll}`;

    if (move.passedGo) {
      ledger = appendLedger(ledger, {
        turn: state.turnNumber,
        type: "go",
        toPlayerId: player.id,
        amount: move.goSalary,
        message: `${player.name} passed GO and collected $200`,
      });
      get().logAction(`${player.name} collected $200 for passing GO`);
      get().showAnnouncement("PASSED GO!\n+$200", "go");
      message += `, passed GO (+$200)`;
    }

    const square = getSquareAtIndex(state.squares, move.newPosition);

    if (square?.type === "go-to-jail") {
      players = players.map((p, i) =>
        i === playerIndex ? { ...p, position: 10, inJail: true } : p,
      );
      get().logAction(`${player.name} was sent to Jail`);
      set({
        players,
        ledger,
        isRolling: false,
        message: `${player.name} landed on Go To Jail.`,
        highlightedSquareId: square.id,
      });
      get().showAnnouncement("GO TO JAIL!", "jail");
      get().endTurn();
      set({ highlightedSquareId: null });
      return;
    }

    if (square?.type === "chance" || square?.type === "chest") {
      const card =
        square.type === "chance" ? drawChanceCard() : drawCommunityChestCard();
      const title =
        square.type === "chance" ? "CHANCE" : "COMMUNITY CHEST";

      get().logAction(`${player.name} drew ${title}: ${card.text}`);

      set({
        players,
        ledger: appendLedger(ledger, {
          turn: state.turnNumber,
          type: "card",
          fromPlayerId: player.id,
          amount: 0,
          message: `${player.name}: ${card.text}`,
        }),
        isRolling: false,
        message: `${player.name} landed on ${square.name}.`,
        highlightedSquareId: square.id,
        cardReveal: {
          kind: square.type === "chance" ? "chance" : "chest",
          title,
          body: card.text,
          squareId: square.id,
        },
      });
      return;
    }

    if (square?.type === "tax" && square.taxAmount) {
      const tax = Math.min(square.taxAmount, players[playerIndex].balance);
      players = players.map((p, i) =>
        i === playerIndex ? { ...p, balance: p.balance - tax } : p,
      );
      ledger = appendLedger(ledger, {
        turn: state.turnNumber,
        type: "tax",
        fromPlayerId: player.id,
        amount: tax,
        message: `${player.name} paid $${tax} in taxes`,
      });
      get().logAction(`${player.name} paid $${tax} (${square.name})`);
      set({
        players,
        ledger,
        isRolling: false,
        message: `${message}, paid $${tax} (${square.name}).`,
      });
      get().endTurn();
      return;
    }

    if (
      square &&
      isPurchasable(square) &&
      square.ownerId &&
      square.ownerId !== player.id
    ) {
      const owner = players.find((p) => p.id === square.ownerId)!;
      const rentAmount = calculateRent(
        square,
        state.squares,
        roll,
        getGroupIds(square),
      );
      const rent = Math.min(rentAmount, players[playerIndex].balance);
      players = transferMoney(players, player.id, owner.id, rent);
      ledger = appendLedger(ledger, {
        turn: state.turnNumber,
        type: "rent",
        fromPlayerId: player.id,
        toPlayerId: owner.id,
        amount: rent,
        propertyId: square.id,
        message: `${player.name} paid $${rent} rent on ${square.name}`,
      });
      get().logAction(
        `${player.name} paid $${rent} rent to ${owner.name} (${square.name})`,
      );

      if (rent >= HUGE_RENT_THRESHOLD) {
        get().showAnnouncement(`RENT PAID!\n$${rent}`, "rent");
      }

      set({
        players,
        ledger,
        isRolling: false,
        message: `${message}, paid $${rent} rent to ${owner.name} for ${square.name}.`,
      });
      get().endTurn();
      return;
    }

    if (square && isPurchasable(square) && !square.ownerId) {
      get().logAction(
        `${player.name} landed on ${square.name} ($${square.price})`,
      );
      set({
        players,
        ledger,
        isRolling: false,
        pendingAction: { type: "buy", propertyId: square.id },
        message: `${message}, landed on ${square.name} ($${square.price}). Buy or pass?`,
      });
      return;
    }

    const squareLabel = square?.name ?? `square ${move.newPosition}`;
    get().logAction(`${player.name} landed on ${squareLabel}`);
    set({
      players,
      ledger,
      isRolling: false,
      message: `${message} and landed on ${squareLabel}.`,
    });
    get().endTurn();
  },

  buyProperty: () => {
    const state = get();
    const pending = state.pendingAction;
    if (!pending || pending.type !== "buy") return;

    const square = state.squares.find((s) => s.id === pending.propertyId);
    if (!square || !square.price) return;

    const player = state.players[state.currentPlayerIndex];
    if (player.balance < square.price) {
      set({ message: `${player.name} cannot afford ${square.name}.` });
      get().logAction(`${player.name} cannot afford ${square.name}`);
      get().declineBuy();
      return;
    }

    const players = state.players.map((p, i) =>
      i === state.currentPlayerIndex
        ? { ...p, balance: p.balance - square.price! }
        : p,
    );
    const squares = state.squares.map((s) =>
      s.id === square.id ? { ...s, ownerId: player.id } : s,
    );
    const ledger = appendLedger(state.ledger, {
      turn: state.turnNumber,
      type: "purchase",
      fromPlayerId: player.id,
      amount: square.price,
      propertyId: square.id,
      message: `${player.name} purchased ${square.name}`,
    });

    get().logAction(
      `${player.name} bought ${square.name} for $${square.price}`,
    );
    get().showAnnouncement(`PURCHASED!\n${square.name}`, "default");

    set({
      players,
      squares,
      ledger,
      pendingAction: null,
      message: `${player.name} bought ${square.name} for $${square.price}.`,
    });
    get().endTurn();
  },

  declineBuy: () => {
    const state = get();
    const player = state.players[state.currentPlayerIndex];
    get().logAction(`${player.name} passed on ${state.pendingAction ? "purchase" : "buy"}`);
    set({
      pendingAction: null,
      message: `${player.name} passed on the purchase.`,
    });
    get().endTurn();
  },

  buildHouse: (propertyId: string) => {
    const state = get();
    const player = state.players[state.currentPlayerIndex];
    const square = state.squares.find((s) => s.id === propertyId);
    if (!square || !canBuildOn(square, state.squares, player.id)) return;
    if (!square.houseCost || player.balance < square.houseCost) {
      set({ message: "Cannot build: insufficient funds or invalid build." });
      return;
    }

    const squares = state.squares.map((s) =>
      s.id === propertyId ? { ...s, houses: s.houses + 1 } : s,
    );
    const players = state.players.map((p, i) =>
      i === state.currentPlayerIndex
        ? { ...p, balance: p.balance - square.houseCost! }
        : p,
    );
    const label = square.houses + 1 >= 5 ? "hotel" : "house";

    get().logAction(
      `${player.name} built a ${label} on ${square.name} (-$${square.houseCost})`,
    );

    set({
      squares,
      players,
      ledger: appendLedger(state.ledger, {
        turn: state.turnNumber,
        type: "build",
        fromPlayerId: player.id,
        amount: square.houseCost,
        propertyId: square.id,
        message: `${player.name} built a ${label} on ${square.name}`,
      }),
      message: `${player.name} built a ${label} on ${square.name} (-$${square.houseCost}).`,
    });
  },

  openTrade: () => {
    const state = get();
    if (state.pendingAction || state.trade.status !== "idle") return;

    const current = state.players[state.currentPlayerIndex];
    const opponentId = getOpponentId(state.players, current.id);

    get().logAction(`${current.name} opened trade negotiations`);

    set({
      trade: {
        status: "composing",
        offer: null,
        draft: emptyDraft(current.id, opponentId),
      },
      message: `${current.name} is composing a trade offer.`,
    });
  },

  updateTradeDraft: (partial) => {
    const state = get();
    if (state.trade.status !== "composing" || !state.trade.draft) return;

    set({
      trade: {
        ...state.trade,
        draft: { ...state.trade.draft, ...partial },
      },
    });
  },

  sendTradeOffer: () => {
    const state = get();
    if (state.trade.status !== "composing" || !state.trade.draft) return;

    const error = validateDraft(
      state.trade.draft,
      state.players,
      state.squares,
    );
    if (error) {
      set({ message: error });
      return;
    }

    const offer = { ...state.trade.draft };
    const receiver = state.players.find((p) => p.id === offer.receiverId)!;
    const sender = state.players.find((p) => p.id === offer.senderId)!;

    get().logAction(`${sender.name} sent a trade offer to ${receiver.name}`);

    set({
      trade: { status: "pending", offer, draft: null },
      message: `Trade offer sent. Waiting for ${receiver.name} to respond.`,
    });
  },

  acceptTrade: () => {
    const state = get();
    if (state.trade.status !== "pending" || !state.trade.offer) return;

    const current = state.players[state.currentPlayerIndex];
    if (current.id !== state.trade.offer.receiverId) {
      set({ message: "Only the receiver can accept this trade." });
      return;
    }

    const result = executeTrade(
      state.players,
      state.squares,
      state.trade.offer,
    );

    if (!result.ok) {
      set({ message: result.error });
      return;
    }

    const sender = state.players.find(
      (p) => p.id === state.trade.offer!.senderId,
    )!;

    get().logAction(`Trade accepted: ${sender.name} & ${current.name}`);
    get().showAnnouncement("TRADE COMPLETE!", "default");

    set({
      players: result.players,
      squares: result.squares,
      trade: { ...INITIAL_TRADE_STATE },
      ledger: appendLedger(state.ledger, {
        turn: state.turnNumber,
        type: "trade",
        amount: 0,
        message: `Trade completed: ${sender.name} & ${current.name}`,
      }),
      message: `Trade accepted between ${sender.name} and ${current.name}.`,
    });
  },

  declineTrade: () => {
    const state = get();
    if (state.trade.status !== "pending" || !state.trade.offer) return;

    const current = state.players[state.currentPlayerIndex];
    if (current.id !== state.trade.offer.receiverId) return;

    get().logAction(`${current.name} declined the trade`);

    set({
      trade: { ...INITIAL_TRADE_STATE },
      message: `${current.name} declined the trade offer.`,
    });
  },

  counterTrade: () => {
    const state = get();
    if (state.trade.status !== "pending" || !state.trade.offer) return;

    const current = state.players[state.currentPlayerIndex];
    if (current.id !== state.trade.offer.receiverId) return;

    const prev = state.trade.offer;
    const counterDraft: TradeOffer = {
      senderId: current.id,
      receiverId: prev.senderId,
      moneyOfferedBySender: prev.moneyOfferedByReceiver,
      moneyOfferedByReceiver: prev.moneyOfferedBySender,
      propertiesOfferedBySender: [...prev.propertiesOfferedByReceiver],
      propertiesOfferedByReceiver: [...prev.propertiesOfferedBySender],
    };

    get().logAction(`${current.name} is countering the trade`);

    set({
      trade: {
        status: "composing",
        offer: null,
        draft: counterDraft,
      },
      message: `${current.name} is preparing a counter-offer.`,
    });
  },

  cancelTrade: () => {
    get().logAction("Trade cancelled");
    set({
      trade: { ...INITIAL_TRADE_STATE },
      message: "Trade cancelled.",
    });
  },
}));

export function useCurrentPlayer(): Player {
  return useGameStore((s) => s.players[s.currentPlayerIndex]);
}

export function useOwnedProperties(playerId: PlayerId): BoardSquare[] {
  return useGameStore((s) =>
    s.squares.filter(
      (sq) =>
        sq.ownerId === playerId &&
        (sq.type === "property" ||
          sq.type === "railroad" ||
          sq.type === "utility"),
    ),
  );
}
