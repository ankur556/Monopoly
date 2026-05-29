import { RAILROAD_RENTS } from "../data/boardDefinitions";
import type { BoardSquare, ColorGroup, PlayerId } from "../types/game";

export function isPurchasable(square: BoardSquare): boolean {
  return (
    square.type === "property" ||
    square.type === "railroad" ||
    square.type === "utility"
  );
}

export function ownsColorSet(
  squares: BoardSquare[],
  playerId: PlayerId,
  _colorGroup: ColorGroup,
  groupMemberIds: string[],
): boolean {
  return groupMemberIds.every((id) => {
    const sq = squares.find((s) => s.id === id);
    return sq?.ownerId === playerId;
  });
}

function countOwnedRailroads(squares: BoardSquare[], ownerId: PlayerId): number {
  return squares.filter(
    (s) => s.type === "railroad" && s.ownerId === ownerId,
  ).length;
}

function countOwnedUtilities(squares: BoardSquare[], ownerId: PlayerId): number {
  return squares.filter(
    (s) => s.type === "utility" && s.ownerId === ownerId,
  ).length;
}

export function calculateRent(
  square: BoardSquare,
  squares: BoardSquare[],
  lastDiceRoll: number,
  groupMemberIds: string[],
): number {
  if (!square.ownerId || !square.rent) return 0;

  if (square.type === "railroad") {
    const count = countOwnedRailroads(squares, square.ownerId);
    return RAILROAD_RENTS[Math.min(count, 4) - 1] ?? 25;
  }

  if (square.type === "utility") {
    const count = countOwnedUtilities(squares, square.ownerId);
    const multiplier = count >= 2 ? 10 : 4;
    return multiplier * lastDiceRoll;
  }

  const { rent, houses, colorGroup, ownerId } = square;
  if (!rent || !colorGroup) return 0;

  if (houses >= 5) return rent.hotel;
  if (houses === 4) return rent.fourHouses;
  if (houses === 3) return rent.threeHouses;
  if (houses === 2) return rent.twoHouses;
  if (houses === 1) return rent.oneHouse;

  const hasSet = ownsColorSet(squares, ownerId, colorGroup, groupMemberIds);
  return hasSet ? rent.base * 2 : rent.base;
}
