import { COLOR_GROUP_MEMBERS } from "../data/boardDefinitions";
import type { BoardSquare, ColorGroup, PlayerId } from "../types/game";
import { ownsColorSet } from "./rent";

const MAX_HOUSES = 5;

export function getGroupMemberIds(colorGroup: ColorGroup): string[] {
  return COLOR_GROUP_MEMBERS[colorGroup] ?? [];
}

export function canBuildOn(
  square: BoardSquare,
  squares: BoardSquare[],
  playerId: PlayerId,
): boolean {
  if (square.type !== "property" || !square.colorGroup) return false;
  if (square.ownerId !== playerId) return false;
  if (!square.houseCost || square.houseCost <= 0) return false;
  if (square.houses >= MAX_HOUSES) return false;

  const groupIds = getGroupMemberIds(square.colorGroup);
  if (!ownsColorSet(squares, playerId, square.colorGroup, groupIds)) {
    return false;
  }

  const groupSquares = squares.filter((s) => groupIds.includes(s.id));
  // Cannot build if any property in the group is mortgaged
  if (groupSquares.some((s) => s.mortgaged)) return false;

  const minHouses = Math.min(...groupSquares.map((s) => s.houses));
  return square.houses <= minHouses;
}

/** Can the player sell a house from this property while following evenness rules? */
export function canSellOn(
  square: BoardSquare,
  squares: BoardSquare[],
  playerId: PlayerId,
): boolean {
  if (square.type !== "property" || !square.colorGroup) return false;
  if (square.ownerId !== playerId) return false;
  if (!square.houseCost || square.houseCost <= 0) return false;
  if (square.houses <= 0) return false;

  const groupIds = getGroupMemberIds(square.colorGroup);
  const groupSquares = squares.filter((s) => groupIds.includes(s.id));
  const maxHouses = Math.max(...groupSquares.map((s) => s.houses));
  // Only allow selling from a property that currently has the maximum houses in the group
  return square.houses === maxHouses;
}

export function getSellableSquares(
  squares: BoardSquare[],
  playerId: PlayerId,
): BoardSquare[] {
  return squares.filter((sq) => canSellOn(sq, squares, playerId));
}

export function getBuildableSquares(
  squares: BoardSquare[],
  playerId: PlayerId,
): BoardSquare[] {
  return squares.filter((sq) => canBuildOn(sq, squares, playerId));
}
