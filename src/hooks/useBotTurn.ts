import { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore";
import { fetchBotAction, executeBotAction } from "../lib/botClient";

export function useBotTurn() {
  const store = useGameStore();
  const processingRef = useRef(false);

  useEffect(() => {
    // Determine if action is needed from a bot
    let activeBotId: string | null = null;
    let needsAction = false;

    if (store.appScreen !== "PLAYING" || store.gameOver) return;
    if (store.cardReveal) return; // Wait for card to be dismissed (UI blocks state)
    if (store.isMoving || store.isRolling) return; // Wait for animations

    if (store.auction.status === "active") {
      // Auction needs input from current bidder
      const bidderId = store.players[store.auction.currentBidderIndex].id;
      const bidder = store.players.find((p) => p.id === bidderId);
      if (bidder?.isBot && !store.auction.passedPlayerIds.includes(bidderId)) {
        activeBotId = bidderId;
        needsAction = true;
      }
    } else if (store.trade.status === "pending" && store.trade.draft) {
      // Trade needs response from receiver
      const receiver = store.players.find(p => p.id === store.trade.draft!.receiverId);
      if (receiver?.isBot) {
        activeBotId = receiver.id;
        needsAction = true;
      }
    } else {
      // Normal turn requires action from current player
      const currentPlayer = store.players[store.currentPlayerIndex];
      if (currentPlayer?.isBot) {
        activeBotId = currentPlayer.id;
        needsAction = true;
      }
    }

    if (needsAction && !processingRef.current) {
      processingRef.current = true;

      // Wrap in async IIFE
      (async () => {
        // Artificial delay so human players can see what's happening
        await new Promise(resolve => setTimeout(resolve, 800));

        // State might have changed during delay, check again
        const currentStoreState = useGameStore.getState();
        if (currentStoreState.appScreen !== "PLAYING" || currentStoreState.gameOver) {
          processingRef.current = false;
          return;
        }

        try {
          const actionInfo = await fetchBotAction(currentStoreState);
          // Pass the up-to-date state to the action executor so it can call actions
          executeBotAction(actionInfo, useGameStore.getState());
        } catch (e) {
          console.error("Bot action error:", e);
        } finally {
          processingRef.current = false;
        }
      })();
    }
  }, [
    store.appScreen,
    store.gameOver,
    store.cardReveal,
    store.isMoving,
    store.isRolling,
    store.turnPhase,
    store.auction.status,
    store.auction.currentBidderIndex,
    store.trade.status,
    store.currentPlayerIndex,
  ]);
}
