import type { BoardSquare, Player, TradeOffer } from "../types/game";

export type TradeResult =
  | { ok: true; players: Player[]; squares: BoardSquare[] }
  | { ok: false; error: string };

export function executeTrade(
  players: Player[],
  squares: BoardSquare[],
  offer: TradeOffer,
): TradeResult {
  const sender = players.find((p) => p.id === offer.senderId);
  const receiver = players.find((p) => p.id === offer.receiverId);

  if (!sender || !receiver) {
    return { ok: false, error: "Invalid players in trade offer." };
  }

  if (sender.balance < offer.moneyOfferedBySender) {
    return { ok: false, error: `${sender.name} cannot afford the offered cash.` };
  }
  if (receiver.balance < offer.moneyOfferedByReceiver) {
    return { ok: false, error: `${receiver.name} cannot afford the offered cash.` };
  }

  for (const id of offer.propertiesOfferedBySender) {
    const sq = squares.find((s) => s.id === id);
    if (!sq || sq.ownerId !== sender.id) {
      return { ok: false, error: "Sender does not own all offered properties." };
    }
  }

  for (const id of offer.propertiesOfferedByReceiver) {
    const sq = squares.find((s) => s.id === id);
    if (!sq || sq.ownerId !== receiver.id) {
      return { ok: false, error: "Receiver does not own all requested properties." };
    }
  }

  const updatedSquares = squares.map((s) => {
    if (offer.propertiesOfferedBySender.includes(s.id)) {
      return { ...s, ownerId: receiver.id };
    }
    if (offer.propertiesOfferedByReceiver.includes(s.id)) {
      return { ...s, ownerId: sender.id };
    }
    return s;
  });

  const updatedPlayers = players.map((p) => {
    if (p.id === sender.id) {
      return {
        ...p,
        balance:
          p.balance -
          offer.moneyOfferedBySender +
          offer.moneyOfferedByReceiver,
      };
    }
    if (p.id === receiver.id) {
      return {
        ...p,
        balance:
          p.balance -
          offer.moneyOfferedByReceiver +
          offer.moneyOfferedBySender,
      };
    }
    return p;
  });

  return { ok: true, players: updatedPlayers, squares: updatedSquares };
}
