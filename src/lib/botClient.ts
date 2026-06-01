import type { GameState } from "../store/gameStore";

export async function fetchBotAction(state: GameState) {
  try {
    const payload = {
      players: state.players.map(p => ({
        id: p.id,
        name: p.name,
        balance: p.balance,
        position: p.position,
        inJail: p.inJail,
        jailTurns: p.jailTurns,
        doublesCount: p.doublesCount,
        getOutOfJailFreeCards: p.getOutOfJailFreeCards,
        isBankrupt: p.isBankrupt ?? false,
        isBot: p.isBot ?? false,
      })),
      squares: state.squares.map(sq => ({
        id: sq.id,
        boardIndex: sq.boardIndex,
        name: sq.name,
        type: sq.type,
        ownerId: sq.ownerId,
        houses: sq.houses,
        mortgaged: sq.mortgaged ?? false,
      })),
      currentPlayerIndex: state.currentPlayerIndex,
      turnPhase: state.turnPhase,
      lastDie1: state.lastDie1,
      lastDie2: state.lastDie2,
      pendingAction: state.pendingAction,
      trade: {
        status: state.trade.status,
        draft: state.trade.draft || state.trade.offer || {},
      },
      auction: {
        status: state.auction.status,
        propertyId: state.auction.propertyId,
        bids: state.auction.bids,
        currentBidderIndex: state.auction.currentBidderIndex,
        passedPlayerIds: state.auction.passedPlayerIds,
      }
    };

    const response = await fetch("http://localhost:8765/act_frontend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Bot action fetch failed", await response.text());
      return { actionType: "END_TURN", payload: {} };
    }

    return await response.json();
  } catch (err) {
    console.error("Error communicating with RL bot server", err);
    return { actionType: "END_TURN", payload: {} };
  }
}

export function executeBotAction(actionInfo: { actionType: string, payload?: any }, store: GameState) {
  switch (actionInfo.actionType) {
    case "ROLL":
      store.rollDice();
      break;
    case "END_TURN":
      store.endTurn();
      break;
    case "BUY_PROPERTY":
      store.buyProperty();
      break;
    case "DECLINE_BUY":
      store.declineBuy();
      break;
    case "PAY_JAIL":
      store.payJailFine();
      break;
    case "USE_GOOJF":
      store.useGetOutOfJailCard();
      break;
    case "ROLL_JAIL":
      store.rollForJailBreak();
      break;
    case "AUCTION_PASS":
      store.passAuction();
      break;
    case "AUCTION_BID":
      // Simplified bid logic based on tier
      const maxBid = Object.values(store.auction.bids).length > 0 ? Math.max(...Object.values(store.auction.bids)) : 0;
      const bidderObj = store.players[store.auction.currentBidderIndex];
      const balance = bidderObj ? bidderObj.balance : 0;
      let bidAmt = maxBid + 1;
      if (actionInfo.payload?.tier === "LOW") bidAmt = Math.max(bidAmt, Math.floor(balance * 0.15));
      if (actionInfo.payload?.tier === "MED") bidAmt = Math.max(bidAmt, Math.floor(balance * 0.30));
      if (actionInfo.payload?.tier === "HIGH") bidAmt = Math.max(bidAmt, Math.floor(balance * 0.60));
      if (actionInfo.payload?.tier === "ALL") bidAmt = balance;
      store.placeBid(bidAmt);
      break;
    case "BUILD_HOUSE":
      const sq = store.squares.find(s => s.boardIndex === actionInfo.payload.position);
      if (sq) store.buildHouse(sq.id);
      break;
    case "ACCEPT_TRADE":
      store.acceptTrade();
      break;
    case "REJECT_TRADE":
      store.declineTrade();
      break;
    default:
      console.warn("Unknown bot action:", actionInfo.actionType);
      store.endTurn();
  }
}
