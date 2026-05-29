import { useEffect, useRef } from "react";
import { useGameStore } from "../../store/gameStore";

/**
 * Invisible controller component mounted once in App.
 * Watches the movementQueue and calls stepToken() every STEP_MS milliseconds
 * while there are steps remaining, creating the sequential movement effect.
 *
 * The dice animation plays for DICE_DELAY_MS first, then stepping begins.
 */
const DICE_DELAY_MS = 700;
const STEP_MS = 280;

export function MovementController() {
  const isRolling = useGameStore((s) => s.isRolling);
  const movementQueue = useGameStore((s) => s.movementQueue);
  const stepToken = useGameStore((s) => s.stepToken);

  // Ref to track whether the initial dice delay has elapsed
  const diceDelayDone = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const diceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // When a new roll starts (isRolling becomes true with a queue), begin the delay
    if (!isRolling || movementQueue.length === 0) {
      // Clear everything if movement is done or roll hasn't started
      diceDelayDone.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (diceTimerRef.current) {
        clearTimeout(diceTimerRef.current);
        diceTimerRef.current = null;
      }
      return;
    }

    // Don't restart if already running
    if (diceDelayDone.current) return;

    // Wait for dice animation to finish, then start stepping
    diceTimerRef.current = setTimeout(() => {
      diceDelayDone.current = true;

      intervalRef.current = setInterval(() => {
        const queue = useGameStore.getState().movementQueue;
        const rolling = useGameStore.getState().isRolling;

        if (!rolling || queue.length === 0) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          diceDelayDone.current = false;
          return;
        }

        stepToken();
      }, STEP_MS);
    }, DICE_DELAY_MS);

    return () => {
      if (diceTimerRef.current) clearTimeout(diceTimerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      diceDelayDone.current = false;
    };
  }, [isRolling, stepToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
