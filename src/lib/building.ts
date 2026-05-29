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
  const minHouses = Math.min(...groupSquares.map((s) => s.houses));
  return square.houses <= minHouses;
}

export function getBuildableSquares(
  squares: BoardSquare[],
  playerId: PlayerId,
): BoardSquare[] {
  return squares.filter((sq) => canBuildOn(sq, squares, playerId));
}
