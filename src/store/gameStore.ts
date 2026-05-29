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
import { calculateRent, isPurchasable } from "../lib/rent";
import type {
  ActionLogEntry,
  AnnouncementVariant,
  AuctionState,
  BoardSquare,
  CardReveal,
  LedgerEntry,
  PendingAction,
  Player,
  PlayerId,
  TradeOffer,
  TradeState,
} from "../types/game";
import { INITIAL_AUCTION_STATE, INITIAL_TRADE_STATE } from "../types/game";

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
  auction: AuctionState;
  selectedPropertyId: string | null;
  propertyCardFlipped: boolean;
  isRolling: boolean;
  /** Queue of board positions the moving token will visit one-by-one */
  movementQueue: number[];
  /** True while the token is mid-journey (draining movementQueue) */
  isMoving: boolean;
  logAction: (text: string) => void;
  showAnnouncement: (text: string, variant?: AnnouncementVariant) => void;
  clearAnnouncement: () => void;
  completeCardReveal: () => void;
  rollDice: () => void;
  /** Called by MovementController once per step interval */
  stepToken: () => void;
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
  // Auction actions
  placeBid: (amount: number) => void;
  passAuction: () => void;
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

/** Build the ordered list of positions the token traverses, one step at a time. */
function buildMovementQueue(start: number, roll: number): number[] {
  const steps: number[] = [];
  for (let i = 1; i <= roll; i++) {
    steps.push((start + i) % 40);
  }
  return steps;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InternalStore = GameState & { _resolveLanding: () => void };

export const useGameStore = create<GameState>((set, get) => {
  const store: InternalStore = {
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
    auction: { ...INITIAL_AUCTION_STATE },
    selectedPropertyId: null,
    propertyCardFlipped: false,
    isRolling: false,
    movementQueue: [],
    isMoving: false,

    logAction: (text) => {
      set((s) => ({ actionLog: appendActionLog(s.actionLog, text) }));
    },

    showAnnouncement: (text, variant = "default") => {
      set({ activeAnnouncement: text, announcementVariant: variant });
    },

    clearAnnouncement: () => {
      set({ activeAnnouncement: null, announcementVariant: "default" });
    },

    completeCardReveal: () => {
      const state = get() as InternalStore;
      if (!state.cardReveal) return;
      const { body, title, effect } = state.cardReveal;
      const playerIndex = state.currentPlayerIndex;
      const player = state.players[playerIndex];
      let players = state.players;
      let ledger = state.ledger;

      set({ cardReveal: null, highlightedSquareId: null });
      state.showAnnouncement(`${title}\n${body}`, "card");

      // Execute the card's typed effect
      switch (effect.type) {
        case "collect": {
          players = players.map((p, i) =>
            i === playerIndex ? { ...p, balance: p.balance + effect.amount } : p,
          );
          ledger = appendLedger(ledger, {
            turn: state.turnNumber, type: "card",
            toPlayerId: player.id, amount: effect.amount,
            message: `${player.name} collected $${effect.amount} (card)`,
          });
          state.logAction(`${player.name} collected $${effect.amount} from card`);
          set({ players, ledger });
          break;
        }
        case "pay": {
          const amt = Math.min(effect.amount, player.balance);
          players = players.map((p, i) =>
            i === playerIndex ? { ...p, balance: p.balance - amt } : p,
          );
          ledger = appendLedger(ledger, {
            turn: state.turnNumber, type: "card",
            fromPlayerId: player.id, amount: amt,
            message: `${player.name} paid $${amt} (card)`,
          });
          state.logAction(`${player.name} paid $${amt} from card`);
          set({ players, ledger });
          break;
        }
        case "pay-each-player": {
          const opponents = players.filter((_p, i) => i !== playerIndex);
          const totalPay = Math.min(effect.amount * opponents.length, player.balance);
          players = players.map((p, i) => {
            if (i === playerIndex) return { ...p, balance: p.balance - totalPay };
            return { ...p, balance: p.balance + effect.amount };
          });
          ledger = appendLedger(ledger, {
            turn: state.turnNumber, type: "card",
            fromPlayerId: player.id, amount: totalPay,
            message: `${player.name} paid $${effect.amount} to each player (card)`,
          });
          state.logAction(`${player.name} paid $${effect.amount} to each player (card)`);
          set({ players, ledger });
          break;
        }
        case "collect-from-each-player": {
          const opponents = players.filter((_p, i) => i !== playerIndex);
          const totalCollect = effect.amount * opponents.length;
          players = players.map((p, i) => {
            if (i === playerIndex) return { ...p, balance: p.balance + totalCollect };
            return { ...p, balance: Math.max(0, p.balance - effect.amount) };
          });
          ledger = appendLedger(ledger, {
            turn: state.turnNumber, type: "card",
            toPlayerId: player.id, amount: totalCollect,
            message: `${player.name} collected $${effect.amount} from each player (card)`,
          });
          state.logAction(`${player.name} collected $${totalCollect} total from other players (card)`);
          set({ players, ledger });
          break;
        }
        case "repairs": {
          const ownedProps = state.squares.filter(sq => sq.ownerId === player.id && sq.type === "property");
          const houseCount = ownedProps.reduce((sum, sq) => sum + Math.min(sq.houses, 4), 0);
          const hotelCount = ownedProps.reduce((sum, sq) => sum + (sq.houses >= 5 ? 1 : 0), 0);
          const repairCost = Math.min(
            houseCount * effect.houseCost + hotelCount * effect.hotelCost,
            player.balance,
          );
          players = players.map((p, i) =>
            i === playerIndex ? { ...p, balance: p.balance - repairCost } : p,
          );
          ledger = appendLedger(ledger, {
            turn: state.turnNumber, type: "card",
            fromPlayerId: player.id, amount: repairCost,
            message: `${player.name} paid $${repairCost} for repairs (${houseCount}h + ${hotelCount} hotels)`,
          });
          state.logAction(`${player.name} paid $${repairCost} in repairs (card)`);
          set({ players, ledger });
          break;
        }
        case "move": {
          const dest = effect.destination;
          const passedGo = effect.collectGoIfPassed && dest < player.position;
          const goBonus = passedGo ? 200 : 0;
          players = players.map((p, i) =>
            i === playerIndex ? { ...p, position: dest, balance: p.balance + goBonus } : p,
          );
          if (passedGo) {
            ledger = appendLedger(ledger, {
              turn: state.turnNumber, type: "go",
              toPlayerId: player.id, amount: 200,
              message: `${player.name} passed GO via card (+$200)`,
            });
          }
          ledger = appendLedger(ledger, {
            turn: state.turnNumber, type: "card",
            fromPlayerId: player.id, amount: 0,
            message: `${player.name} moved to square ${dest} (card)`,
          });
          state.logAction(`${player.name} moved to square ${dest} via card`);
          set({ players, ledger });
          break;
        }
        case "move-back": {
          const newPos = ((player.position - effect.spaces) + 40) % 40;
          players = players.map((p, i) =>
            i === playerIndex ? { ...p, position: newPos } : p,
          );
          state.logAction(`${player.name} moved back ${effect.spaces} spaces (card)`);
          set({ players, ledger });
          break;
        }
        case "jail": {
          players = players.map((p, i) =>
            i === playerIndex ? { ...p, position: 10, inJail: true } : p,
          );
          state.logAction(`${player.name} sent to Jail (card)`);
          set({ players, ledger });
          break;
        }
        case "get-out-of-jail":
        case "none":
        default:
          break;
      }

      setTimeout(() => state.endTurn(), 2200);
    },

    setSelectedPropertyId: (id) => {
      set({ selectedPropertyId: id, propertyCardFlipped: false });
    },

    setPropertyCardFlipped: (flipped) => set({ propertyCardFlipped: flipped }),

    endTurn: () => {
      const state = get() as InternalStore;
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
      state.logAction(`${nextPlayer.name}'s turn`);
      state.showAnnouncement(turnLabel, "turn");
      set({ message: `${nextPlayer.name}, roll the dice.` });
    },

    rollDice: () => {
      const state = get() as InternalStore;
      if (
        state.pendingAction ||
        state.trade.status !== "idle" ||
        state.isRolling ||
        state.isMoving ||
        state.cardReveal
      ) {
        return;
      }
      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      const total = die1 + die2;
      const player = state.players[state.currentPlayerIndex];
      const queue = buildMovementQueue(player.position, total);

      state.logAction(`${player.name} rolled a ${total}`);

      set({
        isRolling: true,
        lastRoll: total,
        lastDie1: die1,
        lastDie2: die2,
        movementQueue: queue,
        isMoving: false,
      });
    },

    /**
     * Called by MovementController every 280ms while isRolling && movementQueue.length > 0.
     * Moves the current player one square and checks for GO crossing.
     */
    stepToken: () => {
      const state = get() as InternalStore;
      if (!state.isRolling || state.movementQueue.length === 0) return;

      const [nextPos, ...remaining] = state.movementQueue;
      const playerIndex = state.currentPlayerIndex;
      const player = state.players[playerIndex];
      const isLastStep = remaining.length === 0;

      // Detect passing GO: next position is numerically lower than current (wrapped around)
      const passedGo =
        nextPos < player.position ||
        (player.position === 39 && nextPos === 0);
      const goSalary = passedGo ? 200 : 0;

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? { ...p, position: nextPos, balance: p.balance + goSalary }
          : p,
      );

      let ledger = state.ledger;
      if (passedGo) {
        ledger = appendLedger(ledger, {
          turn: state.turnNumber,
          type: "go",
          toPlayerId: player.id,
          amount: goSalary,
          message: `${player.name} passed GO and collected $200`,
        });
        state.logAction(`${player.name} collected $200 for passing GO`);
        state.showAnnouncement("PASSED GO!\n+$200", "go");
      }

      if (isLastStep) {
        set({
          players: updatedPlayers,
          ledger,
          movementQueue: [],
          isMoving: false,
        });
        // Brief pause so the elastic land animation plays, then resolve
        setTimeout(() => (get() as InternalStore)._resolveLanding(), 150);
      } else {
        set({
          players: updatedPlayers,
          ledger,
          movementQueue: remaining,
          isMoving: true,
        });
      }
    },

    /** Internal: applies landing logic after token arrives at final square */
    _resolveLanding: () => {
      const state = get() as InternalStore;
      const playerIndex = state.currentPlayerIndex;
      const player = state.players[playerIndex];
      const roll = state.lastRoll ?? 0;
      const square = getSquareAtIndex(state.squares, player.position);
      let players = state.players;
      let ledger = state.ledger;
      const message = `${player.name} rolled ${roll}`;

      if (square?.type === "go-to-jail") {
        players = players.map((p, i) =>
          i === playerIndex ? { ...p, position: 10, inJail: true } : p,
        );
        state.logAction(`${player.name} was sent to Jail`);
        set({
          players,
          ledger,
          isRolling: false,
          message: `${player.name} landed on Go To Jail.`,
          highlightedSquareId: square.id,
        });
        state.showAnnouncement("GO TO JAIL!", "jail");
        state.endTurn();
        set({ highlightedSquareId: null });
        return;
      }

      if (square?.type === "chance" || square?.type === "chest") {
        const card =
          square.type === "chance" ? drawChanceCard() : drawCommunityChestCard();
        const title = square.type === "chance" ? "CHANCE" : "COMMUNITY CHEST";

        state.logAction(`${player.name} drew ${title}: ${card.text}`);

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
            effect: card.effect,
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
        state.logAction(`${player.name} paid $${tax} (${square.name})`);
        set({
          players,
          ledger,
          isRolling: false,
          message: `${message}, paid $${tax} (${square.name}).`,
        });
        state.endTurn();
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
        state.logAction(
          `${player.name} paid $${rent} rent to ${owner.name} (${square.name})`,
        );

        if (rent >= HUGE_RENT_THRESHOLD) {
          state.showAnnouncement(`RENT PAID!\n$${rent}`, "rent");
        }

        set({
          players,
          ledger,
          isRolling: false,
          message: `${message}, paid $${rent} rent to ${owner.name} for ${square.name}.`,
        });
        state.endTurn();
        return;
      }

      if (square && isPurchasable(square) && !square.ownerId) {
        state.logAction(
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

      const squareLabel = square?.name ?? `square ${player.position}`;
      state.logAction(`${player.name} landed on ${squareLabel}`);
      set({
        players,
        ledger,
        isRolling: false,
        message: `${message} and landed on ${squareLabel}.`,
      });
      state.endTurn();
    },

    buyProperty: () => {
      const state = get() as InternalStore;
      const pending = state.pendingAction;
      if (!pending || pending.type !== "buy") return;

      const square = state.squares.find((s) => s.id === pending.propertyId);
      if (!square || !square.price) return;

      const player = state.players[state.currentPlayerIndex];
      if (player.balance < square.price) {
        set({ message: `${player.name} cannot afford ${square.name}.` });
        state.logAction(`${player.name} cannot afford ${square.name}`);
        state.declineBuy();
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

      state.logAction(`${player.name} bought ${square.name} for $${square.price}`);
      state.showAnnouncement(`PURCHASED!\n${square.name}`, "default");

      set({
        players,
        squares,
        ledger,
        pendingAction: null,
        message: `${player.name} bought ${square.name} for $${square.price}.`,
      });
      state.endTurn();
    },

    declineBuy: () => {
      const state = get() as InternalStore;
      const pending = state.pendingAction;
      if (!pending || pending.type !== "buy") return;

      const propertyId = pending.propertyId;
      const square = state.squares.find((s) => s.id === propertyId);
      const decliner = state.players[state.currentPlayerIndex];

      state.logAction(`${decliner.name} declined to buy ${square?.name ?? propertyId} — AUCTION STARTS`);
      state.showAnnouncement("AUCTION!\n" + (square?.name ?? ""), "default");

      // Start the auction. The other player bids first (standard Monopoly rule).
      const firstBidderIndex = (state.currentPlayerIndex + 1) % state.players.length;

      set({
        pendingAction: null,
        auction: {
          status: "active",
          propertyId,
          currentBidderIndex: firstBidderIndex,
          bids: Object.fromEntries(state.players.map((p) => [p.id, 0])),
          passedPlayerIds: [],
          winnerId: null,
        },
        message: `Auction for ${square?.name ?? propertyId}! ${state.players[firstBidderIndex].name} bids first.`,
      });
    },

    buildHouse: (propertyId: string) => {
      const state = get() as InternalStore;
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

      state.logAction(
        `${player.name} built a ${label} on ${square.name} (-$${square.houseCost})`,
      );
      state.showAnnouncement(
        `BUILT!\n${label === "hotel" ? "🏨 Hotel" : "🏠 House"} on ${square.name}`,
        "default",
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
      const state = get() as InternalStore;
      if (state.pendingAction || state.trade.status !== "idle") return;

      const current = state.players[state.currentPlayerIndex];
      const opponentId = getOpponentId(state.players, current.id);

      state.logAction(`${current.name} opened trade negotiations`);

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
      const state = get() as InternalStore;
      if (state.trade.status !== "composing" || !state.trade.draft) return;

      set({
        trade: {
          ...state.trade,
          draft: { ...state.trade.draft, ...partial },
        },
      });
    },

    sendTradeOffer: () => {
      const state = get() as InternalStore;
      if (state.trade.status !== "composing" || !state.trade.draft) return;

      const error = validateDraft(state.trade.draft, state.players, state.squares);
      if (error) {
        set({ message: error });
        return;
      }

      const offer = { ...state.trade.draft };
      const receiver = state.players.find((p) => p.id === offer.receiverId)!;
      const sender = state.players.find((p) => p.id === offer.senderId)!;

      state.logAction(`${sender.name} sent a trade offer to ${receiver.name}`);

      set({
        trade: { status: "pending", offer, draft: null },
        message: `Trade offer sent. Waiting for ${receiver.name} to respond.`,
      });
    },

    acceptTrade: () => {
      const state = get() as InternalStore;
      if (state.trade.status !== "pending" || !state.trade.offer) return;

      const current = state.players[state.currentPlayerIndex];
      if (current.id !== state.trade.offer.receiverId) {
        set({ message: "Only the receiver can accept this trade." });
        return;
      }

      const result = executeTrade(state.players, state.squares, state.trade.offer);

      if (!result.ok) {
        set({ message: result.error });
        return;
      }

      const sender = state.players.find(
        (p) => p.id === state.trade.offer!.senderId,
      )!;

      state.logAction(`Trade accepted: ${sender.name} & ${current.name}`);
      state.showAnnouncement("TRADE COMPLETE!", "default");

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
      const state = get() as InternalStore;
      if (state.trade.status !== "pending" || !state.trade.offer) return;

      const current = state.players[state.currentPlayerIndex];
      if (current.id !== state.trade.offer.receiverId) return;

      state.logAction(`${current.name} declined the trade`);

      set({
        trade: { ...INITIAL_TRADE_STATE },
        message: `${current.name} declined the trade offer.`,
      });
    },

    counterTrade: () => {
      const state = get() as InternalStore;
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

      state.logAction(`${current.name} is countering the trade`);

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
      (get() as InternalStore).logAction("Trade cancelled");
      set({
        trade: { ...INITIAL_TRADE_STATE },
        message: "Trade cancelled.",
      });
    },

    placeBid: (amount: number) => {
      const state = get() as InternalStore;
      if (state.auction.status !== "active") return;

      const { auction, players, squares, turnNumber, ledger } = state;
      const bidder = players[auction.currentBidderIndex];
      const square = squares.find((s) => s.id === auction.propertyId);
      if (!square) return;

      // Must exceed current highest bid and not exceed balance
      const currentHighest = Math.max(...Object.values(auction.bids));
      if (amount <= currentHighest) {
        set({ message: `Bid must be more than the current high of $${currentHighest}.` });
        return;
      }
      if (amount > bidder.balance) {
        set({ message: `${bidder.name} can't afford $${amount}.` });
        return;
      }
      if (amount <= 0) {
        set({ message: "Bid must be at least $1." });
        return;
      }

      state.logAction(`${bidder.name} bids $${amount} on ${square.name}`);

      const newBids = { ...auction.bids, [bidder.id]: amount };

      // Advance to next non-passed bidder
      const activePlayers = players.filter(
        (p) => !auction.passedPlayerIds.includes(p.id),
      );

      if (activePlayers.length === 1) {
        // Only one active — this bid wins immediately
        const winner = bidder;
        const winAmount = amount;
        const updatedPlayers = players.map((p) =>
          p.id === winner.id ? { ...p, balance: p.balance - winAmount } : p,
        );
        const updatedSquares = squares.map((s) =>
          s.id === square.id ? { ...s, ownerId: winner.id } : s,
        );
        state.logAction(`${winner.name} wins auction for ${square.name} at $${winAmount}!`);
        state.showAnnouncement(`SOLD!\n${square.name} → ${winner.name} $${winAmount}`, "default");
        set({
          players: updatedPlayers,
          squares: updatedSquares,
          ledger: appendLedger(ledger, {
            turn: turnNumber, type: "purchase",
            fromPlayerId: winner.id, amount: winAmount,
            propertyId: square.id,
            message: `${winner.name} won auction for ${square.name} at $${winAmount}`,
          }),
          auction: { ...INITIAL_AUCTION_STATE },
          message: `${winner.name} won ${square.name} at auction for $${winAmount}!`,
        });
        setTimeout(() => (get() as InternalStore).endTurn(), 1800);
        return;
      }

      // Move to next bidder in rotation (skip passed players)
      let nextIdx = (auction.currentBidderIndex + 1) % players.length;
      while (auction.passedPlayerIds.includes(players[nextIdx].id)) {
        nextIdx = (nextIdx + 1) % players.length;
      }

      set({
        auction: {
          ...auction,
          bids: newBids,
          currentBidderIndex: nextIdx,
        },
        message: `${bidder.name} bids $${amount}. ${players[nextIdx].name}'s turn to bid or pass.`,
      });
    },

    passAuction: () => {
      const state = get() as InternalStore;
      if (state.auction.status !== "active") return;

      const { auction, players, squares, turnNumber, ledger } = state;
      const passer = players[auction.currentBidderIndex];
      const square = squares.find((s) => s.id === auction.propertyId);
      if (!square) return;

      state.logAction(`${passer.name} passes on the auction`);

      const newPassed = [...auction.passedPlayerIds, passer.id];
      const stillActive = players.filter((p) => !newPassed.includes(p.id));

      if (stillActive.length === 0) {
        // Everyone passed — property goes unsold
        state.logAction(`All players passed — ${square.name} goes unsold`);
        state.showAnnouncement("NO SALE!\n" + square.name, "default");
        set({
          auction: { ...INITIAL_AUCTION_STATE },
          message: `All players passed — ${square.name} remains unsold.`,
        });
        setTimeout(() => (get() as InternalStore).endTurn(), 1400);
        return;
      }

      if (stillActive.length === 1) {
        // Last remaining bidder wins at their highest bid
        const winner = stillActive[0];
        const winAmount = auction.bids[winner.id] ?? 0;

        if (winAmount === 0) {
          // Winner never bid — gets it for free (or $1 minimum)
          const finalAmount = 1;
          const updatedPlayers = players.map((p) =>
            p.id === winner.id ? { ...p, balance: p.balance - finalAmount } : p,
          );
          const updatedSquares = squares.map((s) =>
            s.id === square.id ? { ...s, ownerId: winner.id } : s,
          );
          state.logAction(`${winner.name} wins ${square.name} for $${finalAmount} (last bidder)!`);
          state.showAnnouncement(`SOLD!\n${square.name} → ${winner.name} $${finalAmount}`, "default");
          set({
            players: updatedPlayers,
            squares: updatedSquares,
            ledger: appendLedger(ledger, {
              turn: turnNumber, type: "purchase",
              fromPlayerId: winner.id, amount: finalAmount,
              propertyId: square.id,
              message: `${winner.name} won ${square.name} at auction for $${finalAmount}`,
            }),
            auction: { ...INITIAL_AUCTION_STATE },
            message: `${winner.name} wins ${square.name} at auction for $${finalAmount}!`,
          });
        } else {
          const updatedPlayers = players.map((p) =>
            p.id === winner.id ? { ...p, balance: p.balance - winAmount } : p,
          );
          const updatedSquares = squares.map((s) =>
            s.id === square.id ? { ...s, ownerId: winner.id } : s,
          );
          state.logAction(`${winner.name} wins auction for ${square.name} at $${winAmount}!`);
          state.showAnnouncement(`SOLD!\n${square.name} → ${winner.name} $${winAmount}`, "default");
          set({
            players: updatedPlayers,
            squares: updatedSquares,
            ledger: appendLedger(ledger, {
              turn: turnNumber, type: "purchase",
              fromPlayerId: winner.id, amount: winAmount,
              propertyId: square.id,
              message: `${winner.name} won auction for ${square.name} at $${winAmount}`,
            }),
            auction: { ...INITIAL_AUCTION_STATE },
            message: `${winner.name} wins ${square.name} at auction for $${winAmount}!`,
          });
        }
        setTimeout(() => (get() as InternalStore).endTurn(), 1800);
        return;
      }

      // More active bidders remain — next bidder's turn
      let nextIdx = (auction.currentBidderIndex + 1) % players.length;
      while (newPassed.includes(players[nextIdx].id)) {
        nextIdx = (nextIdx + 1) % players.length;
      }

      set({
        auction: {
          ...auction,
          passedPlayerIds: newPassed,
          currentBidderIndex: nextIdx,
        },
        message: `${passer.name} passes. ${players[nextIdx].name}'s turn.`,
      });
    },
  };

  return store;
});

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
