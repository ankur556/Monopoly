import { GO_SALARY } from "../data/boardDefinitions";

export interface MoveResult {
  newPosition: number;
  passedGo: boolean;
  goSalary: number;
}

export function computeMove(
  currentPosition: number,
  roll: number,
): MoveResult {
  const total = currentPosition + roll;
  const passedGo = total >= 40;
  return {
    newPosition: total % 40,
    passedGo,
    goSalary: passedGo ? GO_SALARY : 0,
  };
}
