import { create } from "zustand";
import {
  createInitialSquares,
  COLOR_GROUP_MEMBERS,
} from "../data/boardDefinitions";
import {
  drawChanceCard,
  drawCommunityChestCard,
} from "../data/cardDecks";
import { canBuildOn, canSellOn } from "../lib/building";
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
  TurnPhase,
} from "../types/game";
import { INITIAL_AUCTION_STATE, INITIAL_TRADE_STATE } from "../types/game";

/** Which top-level screen the app is on */
export type AppScreen = "MENU" | "PLAYING";

interface GameState {
  appScreen: AppScreen;
  players: Player[];
  squares: BoardSquare[];
  currentPlayerIndex: number;
  turnNumber: number;
  turnPhase: TurnPhase;
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
  /** Whether the game has ended due to a winner */
  gameOver: boolean;
  /** Winner player id when game is concluded */
  winnerId: PlayerId | null;
  /** True when the current roll was doubles — used to gate bonus roll after landing resolution */
  rolledDoubles: boolean;
  /** Properties queued for sequential bankruptcy auctions */
  bankruptcyAuctionQueue: string[];
  /** Order in which players were eliminated (first bankrupt = index 0) */
  eliminationOrder: PlayerId[];
  logAction: (text: string) => void;
  showAnnouncement: (text: string, variant?: AnnouncementVariant) => void;
  clearAnnouncement: () => void;
  completeCardReveal: () => void;
  rollDice: () => void;
  processLanding: (playerId: PlayerId, position: number, rolledDoubles?: boolean) => void;
  /** Called by MovementController once per step interval */
  stepToken: () => void;
  buyProperty: () => void;
  declineBuy: () => void;
  buildHouse: (propertyId: string) => void;
  sellHouse: (propertyId: string) => void;
  mortgageProperty: (propertyId: string) => void;
  unmortgageProperty: (propertyId: string) => void;
  endTurn: () => void;
  setSelectedPropertyId: (id: string | null) => void;
  setPropertyCardFlipped: (flipped: boolean) => void;
  openTrade: () => void;
  updateTradeDraft: (partial: Partial<TradeOffer>) => void;
  sendTradeOffer: () => void;
  acceptTrade: (actorId?: PlayerId) => void;
  declineTrade: (actorId?: PlayerId) => void;
  counterTrade: (actorId?: PlayerId) => void;
  cancelTrade: () => void;
  // Auction actions
  placeBid: (amount: number) => void;
  passAuction: () => void;
  // Jail actions
  payJailFine: () => void;
  useGetOutOfJailCard: () => void;
  rollForJailBreak: () => void;
  // Bankruptcy
  declareBankruptcy: (bankruptPlayerId: PlayerId, creditorId: PlayerId | null) => void;
  voluntaryBankruptcy: () => void;
  // App navigation
  initLocalGame: (playerNames: string[]) => void;
  returnToMenu: () => void;
}

const INITIAL_PLAYERS: Player[] = [
  {
    id: "p1", name: "Player 1", balance: 1500, position: 0,
    inJail: false, jailTurns: 0, doublesCount: 0, getOutOfJailFreeCards: 0,
    isBankrupt: false,
  },
  {
    id: "p2", name: "Player 2", balance: 1500, position: 0,
    inJail: false, jailTurns: 0, doublesCount: 0, getOutOfJailFreeCards: 0,
    isBankrupt: false,
  },
];

const HUGE_RENT_THRESHOLD = 100;

function nextPlayerIndex(current: number, players: Player[]): number {
  const total = players.length;
  if (total === 0) return 0;
  for (let i = 1; i <= total; i++) {
    const idx = (current + i) % total;
    const p = players[idx];
    if (!p.isBankrupt) return idx;
  }
  return current;
}

function getOpponentId(players: Player[], currentId: PlayerId): PlayerId {
  const opp = players.find((p) => p.id !== currentId && !p.isBankrupt);
  if (opp) return opp.id;
  const any = players.find((p) => p.id !== currentId);
  return any ? any.id : currentId;
}

function emptyDraft(senderId: PlayerId, receiverId: PlayerId): TradeOffer {
  return {
    senderId,
    receiverId,
    moneyOfferedBySender: 0,
    moneyOfferedByReceiver: 0,
    propertiesOfferedBySender: [],
    propertiesOfferedByReceiver: [],
    jailCardsOfferedBySender: 0,
    jailCardsOfferedByReceiver: 0,
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
  if ((draft.jailCardsOfferedBySender ?? 0) > sender.getOutOfJailFreeCards) {
    return "You don't have enough GOOJF cards to offer.";
  }
  if ((draft.jailCardsOfferedByReceiver ?? 0) > receiver.getOutOfJailFreeCards) {
    return "Opponent doesn't have that many GOOJF cards.";
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
    draft.propertiesOfferedByReceiver.length > 0 ||
    (draft.jailCardsOfferedBySender ?? 0) > 0 ||
    (draft.jailCardsOfferedByReceiver ?? 0) > 0;

  if (!hasAssets) return "Trade must include at least one asset.";
  return null;
}


function attemptPayment(
  players: Player[],
  squares: BoardSquare[],
  fromId: PlayerId,
  toId: PlayerId | null,
  amount: number,
): { players: Player[]; squares: BoardSquare[]; paid: number; bankrupt: boolean } {
  const payer = players.find((p) => p.id === fromId);
  if (!payer) return { players, squares, paid: 0, bankrupt: false };
  const available = payer.balance;
  if (available >= amount) {
    const updatedPlayers = players.map((p) => {
      if (p.id === fromId) return { ...p, balance: p.balance - amount };
      if (toId && p.id === toId) return { ...p, balance: p.balance + amount };
      return p;
    });
    return { players: updatedPlayers, squares, paid: amount, bankrupt: false };
  }

  // Insufficient funds -> partial pay whatever's available, then declare bankruptcy
  const paid = available;
  const updatedPlayers = players.map((p) => {
    if (p.id === fromId) return { ...p, balance: 0, isBankrupt: true };
    if (toId && p.id === toId) return { ...p, balance: p.balance + paid };
    return p;
  });

  const updatedSquares = squares.map((sq) =>
    sq.ownerId === fromId ? { ...sq, ownerId: toId ?? null, houses: 0 } : sq,
  );

  return { players: updatedPlayers, squares: updatedSquares, paid, bankrupt: true };
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
type InternalStore = GameState & {
  _resolveLanding: (rolledDoubles: boolean) => void;
  _startNextBankruptcyAuction: (bankruptPlayerId: PlayerId) => void;
};

export const useGameStore = create<GameState>((set, get) => {
  const store: InternalStore = {
    appScreen: "MENU",
    players: INITIAL_PLAYERS.map((p) => ({ ...p })),
    squares: createInitialSquares(),
    currentPlayerIndex: 0,
    turnNumber: 1,
    turnPhase: "PRE_ROLL",
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
    gameOver: false,
    winnerId: null,
    rolledDoubles: false,
    bankruptcyAuctionQueue: [],
    eliminationOrder: [],

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
      let squares = state.squares;

      set({ cardReveal: null, highlightedSquareId: null });
      state.showAnnouncement(`${title}\n${body}`, "card");

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
          const collectPhase = state.rolledDoubles ? "PRE_ROLL" : "POST_ROLL";
          if (state.rolledDoubles) state.showAnnouncement("DOUBLES!\nRoll again!", "default");
          set({ players, ledger, turnPhase: collectPhase });
          break;
        }
        case "pay": {
          const payRes = attemptPayment(players, squares, player.id, null, effect.amount);
          players = payRes.players;
          squares = payRes.squares;
          ledger = appendLedger(ledger, {
            turn: state.turnNumber, type: "card",
            fromPlayerId: player.id, amount: payRes.paid,
            message: `${player.name} paid $${payRes.paid} (card)`,
          });
          state.logAction(`${player.name} paid $${payRes.paid} from card`);
          if (payRes.bankrupt) {
            state.logAction(`${player.name} declared bankrupt while resolving a card`);
            state.showAnnouncement(`${player.name} is BANKRUPT!`, "default");
            (get() as InternalStore).declareBankruptcy(player.id, null);
          }
          const payCardPhase = state.rolledDoubles && !payRes.bankrupt ? "PRE_ROLL" : "POST_ROLL";
          if (state.rolledDoubles && !payRes.bankrupt) state.showAnnouncement("DOUBLES!\nRoll again!", "default");
          set({ players, squares, ledger, turnPhase: payCardPhase });
          break;
        }
        case "pay-each-player": {
          const opponents = players.filter((_p, i) => i !== playerIndex && !_p.isBankrupt);
          let payEachBankrupt = false;
          for (const opp of opponents) {
            const res = attemptPayment(players, squares, player.id, opp.id, effect.amount);
            players = res.players;
            squares = res.squares;
            ledger = appendLedger(ledger, {
              turn: state.turnNumber, type: "card",
              fromPlayerId: player.id, toPlayerId: opp.id, amount: res.paid,
              message: `${player.name} paid $${res.paid} to ${opp.name} (card)`,
            });
            state.logAction(`${player.name} paid $${res.paid} to ${opp.name} (card)`);
            if (res.bankrupt) {
              state.logAction(`${player.name} declared bankrupt while paying others (card)`);
              state.showAnnouncement(`${player.name} is BANKRUPT!`, "default");
              (get() as InternalStore).declareBankruptcy(player.id, opp.id);
              payEachBankrupt = true;
              break;
            }
          }
          const payEachPhase = state.rolledDoubles && !payEachBankrupt ? "PRE_ROLL" : "POST_ROLL";
          if (state.rolledDoubles && !payEachBankrupt) state.showAnnouncement("DOUBLES!\nRoll again!", "default");
          set({ players, squares, ledger, turnPhase: payEachPhase });
          break;
        }
        case "collect-from-each-player": {
          const opponents = players.filter((_p, i) => i !== playerIndex && !_p.isBankrupt);
          let totalCollect = 0;
          for (const opp of opponents) {
            const res = attemptPayment(players, squares, opp.id, player.id, effect.amount);
            players = res.players;
            squares = res.squares;
            totalCollect += res.paid;
            ledger = appendLedger(ledger, {
              turn: state.turnNumber, type: "card",
              fromPlayerId: opp.id, toPlayerId: player.id, amount: res.paid,
              message: `${player.name} collected $${res.paid} from ${opp.name} (card)`,
            });
            state.logAction(`${player.name} collected $${res.paid} from ${opp.name} (card)`);
            if (res.bankrupt) {
              state.logAction(`${opp.name} declared bankrupt while paying ${player.name} (card)`);
              (get() as InternalStore).declareBankruptcy(opp.id, player.id);
            }
          }
          ledger = appendLedger(ledger, {
            turn: state.turnNumber, type: "card",
            toPlayerId: player.id, amount: totalCollect,
            message: `${player.name} collected $${totalCollect} total from other players (card)`,
          });
          state.logAction(`${player.name} collected $${totalCollect} total from other players (card)`);
          const collectEachPhase = state.rolledDoubles ? "PRE_ROLL" : "POST_ROLL";
          if (state.rolledDoubles) state.showAnnouncement("DOUBLES!\nRoll again!", "default");
          set({ players, squares, ledger, turnPhase: collectEachPhase });
          break;
        }
        case "repairs": {
          const ownedProps = squares.filter(sq => sq.ownerId === player.id && sq.type === "property");
          const houseCount = ownedProps.reduce((sum, sq) => sum + Math.min(sq.houses, 4), 0);
          const hotelCount = ownedProps.reduce((sum, sq) => sum + (sq.houses >= 5 ? 1 : 0), 0);
          const desiredCost = houseCount * effect.houseCost + hotelCount * effect.hotelCost;
          const res = attemptPayment(players, squares, player.id, null, desiredCost);
          players = res.players;
          squares = res.squares;
          const repairCost = res.paid;
          ledger = appendLedger(ledger, {
            turn: state.turnNumber, type: "card",
            fromPlayerId: player.id, amount: repairCost,
            message: `${player.name} paid $${repairCost} for repairs (${houseCount}h + ${hotelCount} hotels)`,
          });
          state.logAction(`${player.name} paid $${repairCost} in repairs (card)`);
          if (res.bankrupt) {
            state.logAction(`${player.name} declared bankrupt while paying repairs`);
            state.showAnnouncement(`${player.name} is BANKRUPT!`, "default");
            (get() as InternalStore).declareBankruptcy(player.id, null);
          }
          const repairsPhase = state.rolledDoubles && !res.bankrupt ? "PRE_ROLL" : "POST_ROLL";
          if (state.rolledDoubles && !res.bankrupt) state.showAnnouncement("DOUBLES!\nRoll again!", "default");
          set({ players, squares, ledger, turnPhase: repairsPhase });
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
          set({ players, squares, ledger, isRolling: false, rolledDoubles: false });
          setTimeout(() => (get() as InternalStore).processLanding(player.id, dest, false), 20);
          break;
        }
        case "move-back": {
          const newPos = ((player.position - effect.spaces) + 40) % 40;
          players = players.map((p, i) =>
            i === playerIndex ? { ...p, position: newPos } : p,
          );
          state.logAction(`${player.name} moved back ${effect.spaces} spaces (card)`);
          set({ players, squares, ledger, isRolling: false, rolledDoubles: false });
          setTimeout(() => (get() as InternalStore).processLanding(player.id, newPos, false), 20);
          break;
        }
        case "jail": {
          players = players.map((p, i) =>
            i === playerIndex
              ? { ...p, position: 10, inJail: true, jailTurns: 0, doublesCount: 0 }
              : p,
          );
          state.logAction(`${player.name} sent to Jail (card)`);
          set({ players, ledger, rolledDoubles: false });
          state.endTurn();
          break;
        }
        case "get-out-of-jail": {
          players = players.map((p, i) =>
            i === playerIndex
              ? { ...p, getOutOfJailFreeCards: p.getOutOfJailFreeCards + 1 }
              : p,
          );
          state.logAction(`${player.name} received a Get Out of Jail Free card`);
          const goojfPhase = state.rolledDoubles ? "PRE_ROLL" : "POST_ROLL";
          if (state.rolledDoubles) state.showAnnouncement("DOUBLES!\nRoll again!", "default");
          set({ players, ledger, turnPhase: goojfPhase });
          break;
        }
        case "none":
        default: {
          const nonePhase = state.rolledDoubles ? "PRE_ROLL" : "POST_ROLL";
          if (state.rolledDoubles) state.showAnnouncement("DOUBLES!\nRoll again!", "default");
          set({ turnPhase: nonePhase });
          break;
        }
      }
    },

    setSelectedPropertyId: (id) => {
      set({ selectedPropertyId: id, propertyCardFlipped: false });
    },

    setPropertyCardFlipped: (flipped) => set({ propertyCardFlipped: flipped }),

    endTurn: () => {
      const state = get() as InternalStore;
      const nextIndex = nextPlayerIndex(state.currentPlayerIndex, state.players);
      const nextPlayer = state.players[nextIndex];

      set({
        currentPlayerIndex: nextIndex,
        // Increment the round counter when we wrap around the player order
        turnNumber:
          nextIndex <= state.currentPlayerIndex
            ? state.turnNumber + 1
            : state.turnNumber,
        turnPhase: "PRE_ROLL",
        lastRoll: null,
        lastDie1: null,
        lastDie2: null,
        pendingAction: null,
        isRolling: false,
        rolledDoubles: false,
      });

      const jailMsg = nextPlayer.inJail
        ? ` (In Jail — Turn ${nextPlayer.jailTurns + 1}/3)`
        : "";
      const turnLabel = `${nextPlayer.name.toUpperCase()}'S TURN${jailMsg}`;
      state.logAction(`${nextPlayer.name}'s turn`);
      state.showAnnouncement(turnLabel, "turn");
      set({
        message: nextPlayer.inJail
          ? `${nextPlayer.name}, you're in Jail. Pay $50, use a card, or roll for doubles.`
          : `${nextPlayer.name}, roll the dice.`,
      });
    },

    rollDice: () => {
      const state = get() as InternalStore;
      if (
        state.turnPhase !== "PRE_ROLL" ||
        state.pendingAction ||
        state.trade.status !== "idle" ||
        state.auction.status !== "idle" ||
        state.isRolling ||
        state.isMoving ||
        state.cardReveal ||
        state.players[state.currentPlayerIndex].inJail
      ) {
        return;
      }

      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      const total = die1 + die2;
      const isDoubles = die1 === die2;
      const player = state.players[state.currentPlayerIndex];
      const newDoublesCount = isDoubles ? player.doublesCount + 1 : 0;

      state.logAction(`${player.name} rolled ${die1}+${die2}=${total}${isDoubles ? " (doubles!)" : ""}`);

      // Three doubles in a row → instant jail
      if (isDoubles && newDoublesCount >= 3) {
        const players = state.players.map((p, i) =>
          i === state.currentPlayerIndex
            ? { ...p, position: 10, inJail: true, jailTurns: 0, doublesCount: 0 }
            : p,
        );
        state.logAction(`${player.name} rolled 3 doubles — sent to Jail!`);
        state.showAnnouncement("3 DOUBLES!\nGO TO JAIL!", "jail");
        set({
          players,
          isRolling: false,
          lastRoll: total,
          lastDie1: die1,
          lastDie2: die2,
          message: `${player.name} rolled 3 doubles in a row — Go to Jail!`,
        });
        setTimeout(() => (get() as InternalStore).endTurn(), 1500);
        return;
      }

      const queue = buildMovementQueue(player.position, total);
      set({
        isRolling: true,
        turnPhase: "ROLLING",
        lastRoll: total,
        lastDie1: die1,
        lastDie2: die2,
        movementQueue: queue,
        isMoving: false,
        rolledDoubles: isDoubles,
        players: state.players.map((p, i) =>
          i === state.currentPlayerIndex
            ? { ...p, doublesCount: newDoublesCount }
            : p,
        ),
      });
    },

    /**
     * Called by MovementController every 280ms while isRolling && movementQueue.length > 0.
     */
    stepToken: () => {
      const state = get() as InternalStore;
      if (!state.isRolling || state.movementQueue.length === 0) return;

      const [nextPos, ...remaining] = state.movementQueue;
      const playerIndex = state.currentPlayerIndex;
      const player = state.players[playerIndex];
      const isLastStep = remaining.length === 0;

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
        const currentPlayer = updatedPlayers[playerIndex];
        const rolledDoubles = currentPlayer.doublesCount > 0 &&
          state.lastDie1 !== null && state.lastDie1 === state.lastDie2;

        set({
          players: updatedPlayers,
          ledger,
          movementQueue: [],
          isMoving: false,
        });
        setTimeout(() => (get() as InternalStore)._resolveLanding(rolledDoubles), 150);
      } else {
        set({
          players: updatedPlayers,
          ledger,
          movementQueue: remaining,
          isMoving: true,
        });
      }
    },

    processLanding: (playerId: PlayerId, position: number, rolledDoubles = false) => {
      const state = get() as InternalStore;
      const playerIndex = state.players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) return;
      const player = state.players[playerIndex];
      const roll = state.lastRoll ?? 0;
      const square = getSquareAtIndex(state.squares, position);
      let players = state.players;
      let ledger = state.ledger;
      let squares = state.squares;
      const message = `${player.name} rolled ${roll}`;

      // Go To Jail
      if (square?.type === "go-to-jail") {
        players = players.map((p, i) =>
          i === playerIndex
            ? { ...p, position: 10, inJail: true, jailTurns: 0, doublesCount: 0 }
            : p,
        );
        state.logAction(`${player.name} was sent to Jail`);
        set({
          players,
          ledger,
          isRolling: false,
          message: `${player.name} landed on Go To Jail.`,
          highlightedSquareId: square!.id,
        });
        state.showAnnouncement("GO TO JAIL!", "jail");
        setTimeout(() => {
          set({ highlightedSquareId: null });
          (get() as InternalStore).endTurn();
        }, 1200);
        return;
      }

      // Chance / Community Chest
      if (square?.type === "chance" || square?.type === "chest") {
        const card = square.type === "chance" ? drawChanceCard() : drawCommunityChestCard();
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

      // Tax
      if (square?.type === "tax" && square.taxAmount) {
        const taxRes = attemptPayment(players, squares, player.id, null, square.taxAmount);
        players = taxRes.players;
        squares = taxRes.squares;
        ledger = appendLedger(ledger, {
          turn: state.turnNumber,
          type: "tax",
          fromPlayerId: player.id,
          amount: taxRes.paid,
          message: `${player.name} paid $${taxRes.paid} in taxes`,
        });
        state.logAction(`${player.name} paid $${taxRes.paid} (${square.name})`);
        if (taxRes.bankrupt) {
          state.logAction(`${player.name} declared bankrupt while paying taxes`);
          state.showAnnouncement(`${player.name} is BANKRUPT!`, "default");
          (get() as InternalStore).declareBankruptcy(player.id, null);
        }
        const afterTaxPhase = rolledDoubles ? "PRE_ROLL" : "POST_ROLL";
        if (rolledDoubles && !taxRes.bankrupt) state.showAnnouncement("DOUBLES!\nRoll again!", "default");
        set({
          players,
          squares,
          ledger,
          isRolling: false,
          message: `${message}, paid $${taxRes.paid} (${square.name}).`,
          turnPhase: afterTaxPhase,
        });
        return;
      }

      // Land on opponent's property — pay rent
      if (
        square &&
        isPurchasable(square) &&
        square.ownerId &&
        square.ownerId !== player.id
      ) {
        const owner = players.find((p) => p.id === square.ownerId)!;
        const rentAmount = calculateRent(
          square,
          squares,
          roll,
          getGroupIds(square),
        );
        const payRes = attemptPayment(players, squares, player.id, owner.id, rentAmount);
        players = payRes.players;
        squares = payRes.squares;
        ledger = appendLedger(ledger, {
          turn: state.turnNumber,
          type: "rent",
          fromPlayerId: player.id,
          toPlayerId: owner.id,
          amount: payRes.paid,
          propertyId: square.id,
          message: `${player.name} paid $${payRes.paid} rent on ${square.name}`,
        });
        state.logAction(
          `${player.name} paid $${payRes.paid} rent to ${owner.name} (${square.name})`,
        );
        if (payRes.paid >= HUGE_RENT_THRESHOLD) {
          state.showAnnouncement(`RENT PAID!\n$${payRes.paid}`, "rent");
        }
        if (payRes.bankrupt) {
          state.logAction(`${player.name} declared bankrupt while paying rent`);
          state.showAnnouncement(`${player.name} is BANKRUPT!`, "default");
          (get() as InternalStore).declareBankruptcy(player.id, owner.id);
        }
        const afterRentPhase = rolledDoubles ? "PRE_ROLL" : "POST_ROLL";
        if (rolledDoubles && !payRes.bankrupt) state.showAnnouncement("DOUBLES!\nRoll again!", "default");
        set({
          players,
          squares,
          ledger,
          isRolling: false,
          message: `${message}, paid $${payRes.paid} rent to ${owner.name} for ${square.name}.`,
          turnPhase: afterRentPhase,
        });
        return;
      }

      // Unowned purchasable property
      if (square && isPurchasable(square) && !square.ownerId) {
        state.logAction(`${player.name} landed on ${square.name} ($${square.price})`);
        set({
          players,
          ledger,
          isRolling: false,
          pendingAction: { type: "buy", propertyId: square.id },
          message: `${message}, landed on ${square.name} ($${square.price}). Buy or pass?`,
        });
        return;
      }

      // Default — non-event square
      const squareLabel = square?.name ?? `square ${position}`;
      state.logAction(`${player.name} landed on ${squareLabel}`);
      set({
        players,
        ledger,
        isRolling: false,
        message: `${message} and landed on ${squareLabel}.`,
      });

      // On doubles: allow another roll (PRE_ROLL), else POST_ROLL
      if (rolledDoubles) {
        set({ turnPhase: "PRE_ROLL" });
        state.showAnnouncement("DOUBLES!\nRoll again!", "default");
      } else {
        set({ turnPhase: "POST_ROLL" });
      }
    },

    _resolveLanding: (rolledDoubles: boolean) => {
      const state = get() as InternalStore;
      const playerIndex = state.currentPlayerIndex;
      const player = state.players[playerIndex];
      (get() as InternalStore).processLanding(player.id, player.position, rolledDoubles);
    },

    declareBankruptcy: (bankruptPlayerId: PlayerId, creditorId: PlayerId | null) => {
      const state = get() as InternalStore;
      let players = state.players.slice();
      let squares = state.squares.slice();

      const bpIndex = players.findIndex((p) => p.id === bankruptPlayerId);
      if (bpIndex === -1) return;
      const bankruptPlayer = players[bpIndex];

      // Transfer remaining cash to creditor (if any)
      if (creditorId) {
        players = players.map((p) => {
          if (p.id === creditorId) return { ...p, balance: p.balance + bankruptPlayer.balance };
          if (p.id === bankruptPlayerId) return { ...p, balance: 0, isBankrupt: true };
          return p;
        });
      } else {
        players = players.map((p) => (p.id === bankruptPlayerId ? { ...p, balance: 0, isBankrupt: true } : p));
      }

      // Transfer properties to creditor or bank, and clear houses + mortgage
      squares = squares.map((sq) =>
        sq.ownerId === bankruptPlayerId
          ? { ...sq, ownerId: creditorId ?? null, houses: 0, mortgaged: false }
          : sq,
      );

      // Append ledger entry for bankruptcy
      const ledger = appendLedger(state.ledger, {
        turn: state.turnNumber,
        type: "bankruptcy",
        fromPlayerId: bankruptPlayerId,
        toPlayerId: creditorId ?? undefined,
        amount: bankruptPlayer.balance,
        message: `${bankruptPlayer.name} declared bankruptcy${
          creditorId ? ` to ${players.find((p) => p.id === creditorId)!.name}` : " to the Bank"
        }`,
      });

      state.logAction(`${bankruptPlayer.name} declared bankruptcy`);

      // Track elimination order and check for win condition
      const newEliminationOrder = [...state.eliminationOrder, bankruptPlayer.id];
      const activePlayers = players.filter((p) => !p.isBankrupt);
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        state.logAction(`${winner.name} has won the game!`);
        state.showAnnouncement(`${winner.name} WINS!`, "turn");
        set({ players, squares, ledger, gameOver: true, winnerId: winner.id, eliminationOrder: newEliminationOrder });
        return;
      }

      set({ players, squares, ledger, eliminationOrder: newEliminationOrder });
    },

    voluntaryBankruptcy: () => {
      const state = get() as InternalStore;
      const playerIndex = state.currentPlayerIndex;
      const player = state.players[playerIndex];

      // Collect all properties owned by this player
      const ownedPropertyIds = state.squares
        .filter((sq) => sq.ownerId === player.id)
        .map((sq) => sq.id);

      // Mark player bankrupt and strip all properties
      const players = state.players.map((p, i) =>
        i === playerIndex ? { ...p, isBankrupt: true, balance: 0 } : p,
      );
      const squares = state.squares.map((sq) =>
        sq.ownerId === player.id
          ? { ...sq, ownerId: null, houses: 0, mortgaged: false }
          : sq,
      );
      const ledger = appendLedger(state.ledger, {
        turn: state.turnNumber,
        type: "bankruptcy",
        fromPlayerId: player.id,
        toPlayerId: undefined,
        amount: player.balance,
        message: `${player.name} declared voluntary bankruptcy`,
      });

      state.logAction(`${player.name} declared voluntary bankruptcy`);
      state.showAnnouncement(`${player.name}\nDECLARED BANKRUPTCY`, "default");

      // Track elimination order
      const newEliminationOrder = [...state.eliminationOrder, player.id];

      // Check win condition
      const activePlayers = players.filter((p) => !p.isBankrupt);
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        state.logAction(`${winner.name} has won the game!`);
        state.showAnnouncement(`${winner.name} WINS!`, "turn");
        set({ players, squares, ledger, gameOver: true, winnerId: winner.id, bankruptcyAuctionQueue: [], eliminationOrder: newEliminationOrder });
        return;
      }

      if (ownedPropertyIds.length === 0) {
        // Nothing to auction — just end their turn
        set({ players, squares, ledger, bankruptcyAuctionQueue: [], eliminationOrder: newEliminationOrder });
        state.endTurn();
        return;
      }

      // Queue all properties for sequential auctions
      const [first, ...rest] = ownedPropertyIds;
      // Skip bankrupt players in bidder order
      const activePlayers2 = players.filter((p) => !p.isBankrupt);
      const firstBidderIndex = players.findIndex((p) => p.id === activePlayers2[0]?.id);
      set({
        players,
        squares,
        ledger,
        bankruptcyAuctionQueue: rest,
        eliminationOrder: newEliminationOrder,
        pendingAction: null,
        auction: {
          status: "active",
          propertyId: first,
          currentBidderIndex: firstBidderIndex >= 0 ? firstBidderIndex : 0,
          bids: Object.fromEntries(players.map((p) => [p.id, 0])),
          passedPlayerIds: [player.id], // bankrupt player can't bid
          winnerId: null,
          isBankruptcyAuction: true,
          bankruptPlayerId: player.id,
        },
        message: `Auctioning ${player.name}'s properties. ${players[firstBidderIndex >= 0 ? firstBidderIndex : 0].name} bids first on ${state.squares.find((s) => s.id === first)?.name ?? first}.`,
      });
    },

    /** Internal: advance to the next property in the bankruptcy auction queue */
    _startNextBankruptcyAuction: (bankruptPlayerId: PlayerId) => {
      const state = get() as InternalStore;
      const queue = state.bankruptcyAuctionQueue;

      if (queue.length === 0) {
        // All done — end the bankrupt player's turn
        set({ bankruptcyAuctionQueue: [], auction: { ...INITIAL_AUCTION_STATE } });
        state.endTurn();
        return;
      }

      const [next, ...remaining] = queue;
      const activePlayers = state.players.filter((p) => !p.isBankrupt);
      const firstBidderIndex = state.players.findIndex((p) => p.id === activePlayers[0]?.id);
      set({
        bankruptcyAuctionQueue: remaining,
        auction: {
          status: "active",
          propertyId: next,
          currentBidderIndex: firstBidderIndex >= 0 ? firstBidderIndex : 0,
          bids: Object.fromEntries(state.players.map((p) => [p.id, 0])),
          passedPlayerIds: [bankruptPlayerId],
          winnerId: null,
          isBankruptcyAuction: true,
          bankruptPlayerId,
        },
        message: `Next auction: ${state.squares.find((s) => s.id === next)?.name ?? next}`,
      });
    },

    // ─── Jail Actions ────────────────────────────────────────────────────────

    payJailFine: () => {
      const state = get() as InternalStore;
      const player = state.players[state.currentPlayerIndex];
      if (!player.inJail || state.turnPhase !== "PRE_ROLL") return;
      if (player.balance < 50) {
        set({ message: "You can't afford the $50 fine!" });
        return;
      }
      const players = state.players.map((p, i) =>
        i === state.currentPlayerIndex
          ? { ...p, balance: p.balance - 50, inJail: false, jailTurns: 0, doublesCount: 0 }
          : p,
      );
      const ledger = appendLedger(state.ledger, {
        turn: state.turnNumber, type: "tax",
        fromPlayerId: player.id, amount: 50,
        message: `${player.name} paid $50 jail fine`,
      });
      state.logAction(`${player.name} paid $50 to leave jail`);
      set({ players, ledger, message: `${player.name} paid the $50 fine. Roll the dice!` });
    },

    useGetOutOfJailCard: () => {
      const state = get() as InternalStore;
      const player = state.players[state.currentPlayerIndex];
      if (!player.inJail || state.turnPhase !== "PRE_ROLL") return;
      if (player.getOutOfJailFreeCards <= 0) {
        set({ message: "You have no Get Out of Jail Free cards!" });
        return;
      }
      const players = state.players.map((p, i) =>
        i === state.currentPlayerIndex
          ? {
              ...p,
              getOutOfJailFreeCards: p.getOutOfJailFreeCards - 1,
              inJail: false,
              jailTurns: 0,
              doublesCount: 0,
            }
          : p,
      );
      state.logAction(`${player.name} used a Get Out of Jail Free card`);
      state.showAnnouncement("GET OUT OF JAIL FREE!", "jail");
      set({ players, message: `${player.name} used their Get Out of Jail Free card. Roll the dice!` });
    },

    rollForJailBreak: () => {
      const state = get() as InternalStore;
      const player = state.players[state.currentPlayerIndex];
      if (!player.inJail || state.turnPhase !== "PRE_ROLL") return;
      if (state.isRolling || state.isMoving) return;

      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      const total = die1 + die2;
      const isDoubles = die1 === die2;

      state.logAction(
        `${player.name} rolled ${die1}+${die2}=${total} in jail${isDoubles ? " — DOUBLES! Free!" : " — no doubles"}`,
      );

      set({ lastRoll: total, lastDie1: die1, lastDie2: die2 });

      if (isDoubles) {
        // Rolled doubles → free, move but no bonus roll
        const players = state.players.map((p, i) =>
          i === state.currentPlayerIndex
            ? { ...p, inJail: false, jailTurns: 0, doublesCount: 0 }
            : p,
        );
        state.showAnnouncement("DOUBLES!\nOut of Jail!", "jail");
        set({ players, isRolling: true, turnPhase: "ROLLING" });
        const queue = buildMovementQueue(player.position, total);
        set({ movementQueue: queue, isMoving: false });
        // After movement, doublesCount stays 0 so no bonus roll
      } else {
        const newJailTurns = player.jailTurns + 1;

        if (newJailTurns >= 3) {
          // Third failed roll — forced pay $50, then move
          const payRes = attemptPayment(state.players, state.squares, player.id, null, 50);
          let players = payRes.players;
          let squares = payRes.squares;
          let ledger = appendLedger(state.ledger, {
            turn: state.turnNumber, type: "tax",
            fromPlayerId: player.id, amount: payRes.paid,
            message: `${player.name} forced to pay $50 jail fine after 3rd failed roll`,
          });
          state.logAction(`${player.name} paid forced $${payRes.paid} fine and moves ${total}`);
          if (payRes.bankrupt) {
            state.logAction(`${player.name} declared bankrupt while paying jail fine`);
            state.showAnnouncement(`${player.name} is BANKRUPT!`, "default");
            (get() as InternalStore).declareBankruptcy(player.id, null);
          } else {
            state.showAnnouncement("3RD ROLL FAILED!\nForced $50 Fine", "jail");
          }
          set({ players, squares, ledger, isRolling: true, turnPhase: "ROLLING" });
          const queue = buildMovementQueue(
            players[state.currentPlayerIndex].position,
            total,
          );
          set({ movementQueue: queue, isMoving: false });
        } else {
          // Failed — increment jail turns, turn ends (no movement)
          const players = state.players.map((p, i) =>
            i === state.currentPlayerIndex
              ? { ...p, jailTurns: newJailTurns }
              : p,
          );
          state.logAction(`${player.name} failed jail roll (turn ${newJailTurns}/3)`);
          set({
            players,
            isRolling: false,
            turnPhase: "POST_ROLL",
            message: `${player.name} failed to roll doubles (attempt ${newJailTurns}/3). Turn over.`,
          });
        }
      }
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

      const afterBuyPhase = state.rolledDoubles ? "PRE_ROLL" : "POST_ROLL";
      if (state.rolledDoubles) setTimeout(() => state.showAnnouncement("DOUBLES!\nRoll again!", "default"), 1200);

      set({
        players,
        squares,
        ledger,
        pendingAction: null,
        turnPhase: afterBuyPhase,
        message: `${player.name} bought ${square.name} for $${square.price}.`,
      });
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
          isBankruptcyAuction: false,
          bankruptPlayerId: null,
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

    sellHouse: (propertyId: string) => {
      const state = get() as InternalStore;
      const player = state.players[state.currentPlayerIndex];
      const square = state.squares.find((s) => s.id === propertyId);
      if (!square || square.ownerId !== player.id) return;
      if (!canSellOn(square, state.squares, player.id)) {
        set({ message: "Cannot sell house: must follow evenness rules." });
        return;
      }
      if (!square.houseCost) return;

      const sellPrice = Math.floor(square.houseCost / 2);
      const squares = state.squares.map((s) =>
        s.id === propertyId ? { ...s, houses: Math.max(0, s.houses - 1) } : s,
      );
      const players = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, balance: p.balance + sellPrice } : p,
      );

      state.logAction(`${player.name} sold a house on ${square.name} (+$${sellPrice})`);
      set({
        players,
        squares,
        ledger: appendLedger(state.ledger, {
          turn: state.turnNumber,
          type: "build",
          fromPlayerId: player.id,
          amount: -sellPrice,
          propertyId: square.id,
          message: `${player.name} sold a house on ${square.name}`,
        }),
        message: `${player.name} sold a house on ${square.name} (+$${sellPrice}).`,
      });
    },

    mortgageProperty: (propertyId: string) => {
      const state = get() as InternalStore;
      const player = state.players[state.currentPlayerIndex];
      const square = state.squares.find((s) => s.id === propertyId);
      if (!square || square.ownerId !== player.id) return;
      if (square.mortgaged) return;
      if (!square.price) return;

      // If any houses exist on the color set, block mortgaging
      if (square.colorGroup) {
        const groupIds = COLOR_GROUP_MEMBERS[square.colorGroup];
        const groupSquares = state.squares.filter((s) => groupIds.includes(s.id));
        if (groupSquares.some((s) => s.houses > 0)) {
          set({ message: "Sell all houses in the set before mortgaging." });
          return;
        }
      }

      const mortgageValue = Math.floor(square.price / 2);
      const squares = state.squares.map((s) => (s.id === propertyId ? { ...s, mortgaged: true } : s));
      const players = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, balance: p.balance + mortgageValue } : p,
      );

      state.logAction(`${player.name} mortgaged ${square.name} (+$${mortgageValue})`);
      set({
        players,
        squares,
        ledger: appendLedger(state.ledger, {
          turn: state.turnNumber,
          type: "mortgage",
          fromPlayerId: player.id,
          amount: mortgageValue,
          propertyId: square.id,
          message: `${player.name} mortgaged ${square.name}`,
        }),
        message: `${player.name} mortgaged ${square.name} (+$${mortgageValue}).`,
      });
    },

    unmortgageProperty: (propertyId: string) => {
      const state = get() as InternalStore;
      const player = state.players[state.currentPlayerIndex];
      const square = state.squares.find((s) => s.id === propertyId);
      if (!square || square.ownerId !== player.id) return;
      if (!square.mortgaged) return;
      if (!square.price) return;

      const mortgageValue = Math.floor(square.price / 2);
      const cost = Math.ceil(mortgageValue * 1.1);
      if (player.balance < cost) {
        set({ message: "Cannot unmortgage: insufficient funds." });
        return;
      }

      const squares = state.squares.map((s) => (s.id === propertyId ? { ...s, mortgaged: false } : s));
      const players = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, balance: p.balance - cost } : p,
      );

      state.logAction(`${player.name} unmortgaged ${square.name} (-$${cost})`);
      set({
        players,
        squares,
        ledger: appendLedger(state.ledger, {
          turn: state.turnNumber,
          type: "mortgage",
          fromPlayerId: player.id,
          amount: -cost,
          propertyId: square.id,
          message: `${player.name} unmortgaged ${square.name}`,
        }),
        message: `${player.name} unmortgaged ${square.name} (-$${cost}).`,
      });
    },

    openTrade: () => {
      const state = get() as InternalStore;
      // Trade can be opened in PRE_ROLL or POST_ROLL (never during movement or card reveal)
      if (
        state.pendingAction ||
        state.trade.status !== "idle" ||
        state.isMoving ||
        state.isRolling ||
        state.cardReveal ||
        state.auction.status !== "idle"
      ) return;

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

    acceptTrade: (actorId?: PlayerId) => {
      const state = get() as InternalStore;
      if (state.trade.status !== "pending" || !state.trade.offer) return;

      const actor = actorId ? state.players.find((p) => p.id === actorId) : state.players[state.currentPlayerIndex];
      if (!actor) return;

      if (actor.id !== state.trade.offer.receiverId) {
        set({ message: "Only the receiver can accept this trade." });
        return;
      }

      const result = executeTrade(state.players, state.squares, state.trade.offer);

      if (!result.ok) {
        set({ message: result.error });
        return;
      }

      const sender = state.players.find((p) => p.id === state.trade.offer!.senderId)!;

      state.logAction(`Trade accepted: ${sender.name} & ${actor.name}`);
      state.showAnnouncement("TRADE COMPLETE!", "default");

      set({
        players: result.players,
        squares: result.squares,
        trade: { ...INITIAL_TRADE_STATE },
        ledger: appendLedger(state.ledger, {
          turn: state.turnNumber,
          type: "trade",
          amount: 0,
          message: `Trade completed: ${sender.name} & ${actor.name}`,
        }),
        message: `Trade accepted between ${sender.name} and ${actor.name}.`,
      });
    },

    declineTrade: (actorId?: PlayerId) => {
      const state = get() as InternalStore;
      if (state.trade.status !== "pending" || !state.trade.offer) return;

      const actor = actorId ? state.players.find((p) => p.id === actorId) : state.players[state.currentPlayerIndex];
      if (!actor) return;
      if (actor.id !== state.trade.offer.receiverId) return;

      state.logAction(`${actor.name} declined the trade`);

      set({
        trade: { ...INITIAL_TRADE_STATE },
        message: `${actor.name} declined the trade offer.`,
      });
    },

    counterTrade: (actorId?: PlayerId) => {
      const state = get() as InternalStore;
      if (state.trade.status !== "pending" || !state.trade.offer) return;

      const actor = actorId ? state.players.find((p) => p.id === actorId) : state.players[state.currentPlayerIndex];
      if (!actor) return;
      if (actor.id !== state.trade.offer.receiverId) return;

      const prev = state.trade.offer;
      const counterDraft: TradeOffer = {
        senderId: actor.id,
        receiverId: prev.senderId,
        moneyOfferedBySender: prev.moneyOfferedByReceiver,
        moneyOfferedByReceiver: prev.moneyOfferedBySender,
        propertiesOfferedBySender: [...prev.propertiesOfferedByReceiver],
        propertiesOfferedByReceiver: [...prev.propertiesOfferedBySender],
        jailCardsOfferedBySender: prev.jailCardsOfferedByReceiver ?? 0,
        jailCardsOfferedByReceiver: prev.jailCardsOfferedBySender ?? 0,
      };

      state.logAction(`${actor.name} is countering the trade`);

      set({
        trade: {
          status: "composing",
          offer: null,
          draft: counterDraft,
        },
        message: `${actor.name} is preparing a counter-offer.`,
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

      const activePlayers = players.filter(
        (p) => !auction.passedPlayerIds.includes(p.id) && !p.isBankrupt,
      );

      if (activePlayers.length === 1) {
        const winner = bidder;
        const winAmount = amount;
        const updatedPlayers = players.map((p) =>
          p.id === winner.id ? { ...p, balance: Math.max(0, p.balance - winAmount) } : p,
        );
        const updatedSquares = squares.map((s) =>
          s.id === square.id ? { ...s, ownerId: winner.id } : s,
        );
        state.logAction(`${winner.name} wins auction for ${square.name} at $${winAmount}!`);
        state.showAnnouncement(`SOLD!\n${square.name} → ${winner.name} $${winAmount}`, "default");
        const newLedger = appendLedger(ledger, {
          turn: turnNumber, type: "purchase",
          fromPlayerId: winner.id, amount: winAmount,
          propertyId: square.id,
          message: `${winner.name} won auction for ${square.name} at $${winAmount}`,
        });
        set({
          players: updatedPlayers,
          squares: updatedSquares,
          ledger: newLedger,
          message: `${winner.name} won ${square.name} at auction for $${winAmount}!`,
        });
        if (auction.isBankruptcyAuction && auction.bankruptPlayerId) {
          setTimeout(() => (get() as InternalStore)._startNextBankruptcyAuction(auction.bankruptPlayerId!), 800);
        } else {
          set({ auction: { ...INITIAL_AUCTION_STATE }, turnPhase: "POST_ROLL" });
        }
        return;
      }

      let nextIdx = (auction.currentBidderIndex + 1) % players.length;
      while (
        auction.passedPlayerIds.includes(players[nextIdx].id) ||
        players[nextIdx].isBankrupt
      ) {
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
      const stillActive = players.filter((p) => !newPassed.includes(p.id) && !p.isBankrupt);

      if (stillActive.length === 0) {
        state.logAction(`All players passed — ${square.name} goes unsold`);
        state.showAnnouncement("NO SALE!\n" + square.name, "default");
        if (auction.isBankruptcyAuction && auction.bankruptPlayerId) {
          set({ auction: { ...INITIAL_AUCTION_STATE }, message: `${square.name} went unsold.` });
          setTimeout(() => (get() as InternalStore)._startNextBankruptcyAuction(auction.bankruptPlayerId!), 600);
        } else {
          set({
            auction: { ...INITIAL_AUCTION_STATE },
            message: `All players passed — ${square.name} remains unsold.`,
            turnPhase: "POST_ROLL",
          });
        }
        return;
      }

      if (stillActive.length === 1) {
        const winner = stillActive[0];
        const rawBid = auction.bids[winner.id] ?? 0;
        const winAmount = Math.min(Math.max(rawBid, 0), winner.balance);
        const updatedPlayers = players.map((p) =>
          p.id === winner.id ? { ...p, balance: Math.max(0, p.balance - winAmount) } : p,
        );
        const updatedSquares = squares.map((s) =>
          s.id === square.id ? { ...s, ownerId: winner.id } : s,
        );
        state.logAction(`${winner.name} wins auction for ${square.name} at $${winAmount}!`);
        state.showAnnouncement(`SOLD!\n${square.name} → ${winner.name} $${winAmount}`, "default");
        const newLedger2 = appendLedger(ledger, {
          turn: turnNumber, type: "purchase",
          fromPlayerId: winner.id, amount: winAmount,
          propertyId: square.id,
          message: `${winner.name} won auction for ${square.name} at $${winAmount}`,
        });
        set({
          players: updatedPlayers,
          squares: updatedSquares,
          ledger: newLedger2,
          message: `${winner.name} wins ${square.name} at auction for $${winAmount}!`,
        });
        if (auction.isBankruptcyAuction && auction.bankruptPlayerId) {
          setTimeout(() => (get() as InternalStore)._startNextBankruptcyAuction(auction.bankruptPlayerId!), 800);
        } else {
          set({ auction: { ...INITIAL_AUCTION_STATE }, turnPhase: "POST_ROLL" });
        }
        return;
      }

      let nextIdx = (auction.currentBidderIndex + 1) % players.length;
      while (newPassed.includes(players[nextIdx].id) || players[nextIdx].isBankrupt) {
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

    // ─── App Navigation ──────────────────────────────────────────────────────

    initLocalGame: (playerNames: string[]) => {
      const clamped = playerNames.slice(0, 6);
      const newPlayers: Player[] = clamped.map((name, i) => ({
        id: `p${i + 1}`,
        name: name.trim() || `Player ${i + 1}`,
        balance: 1500,
        position: 0,
        inJail: false,
        jailTurns: 0,
        doublesCount: 0,
        getOutOfJailFreeCards: 0,
      }));

      const firstPlayer = newPlayers[0];
      set({
        appScreen: "PLAYING",
        players: newPlayers,
        squares: createInitialSquares(),
        currentPlayerIndex: 0,
        turnNumber: 1,
        turnPhase: "PRE_ROLL",
        lastRoll: null,
        lastDie1: null,
        lastDie2: null,
        pendingAction: null,
        message: `${firstPlayer.name}, roll the dice.`,
        ledger: [],
        actionLog: [
          {
            id: "log-0",
            text: `Game started with ${newPlayers.length} players`,
            timestamp: Date.now(),
          },
        ],
        activeAnnouncement: `${firstPlayer.name.toUpperCase()}'S TURN`,
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
        gameOver: false,
        winnerId: null,
        rolledDoubles: false,
        bankruptcyAuctionQueue: [],
        eliminationOrder: [],
      });
    },

    returnToMenu: () => {
      set({
        appScreen: "MENU",
        players: INITIAL_PLAYERS.map((p) => ({ ...p })),
        squares: createInitialSquares(),
        currentPlayerIndex: 0,
        turnNumber: 1,
        turnPhase: "PRE_ROLL",
        lastRoll: null,
        lastDie1: null,
        lastDie2: null,
        pendingAction: null,
        message: "Roll the dice to begin.",
        ledger: [],
        actionLog: [],
        activeAnnouncement: null,
        announcementVariant: "default",
        highlightedSquareId: null,
        cardReveal: null,
        trade: { ...INITIAL_TRADE_STATE },
        auction: { ...INITIAL_AUCTION_STATE },
        selectedPropertyId: null,
        propertyCardFlipped: false,
        isRolling: false,
        movementQueue: [],
        isMoving: false,
        gameOver: false,
        winnerId: null,
        rolledDoubles: false,
        bankruptcyAuctionQueue: [],
        eliminationOrder: [],
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
