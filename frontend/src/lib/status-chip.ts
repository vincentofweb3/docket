import { STATUS } from "./docket";

/**
 * Status code to chip class, shared so every status chip in the app renders a docket identically.
 *
 * MyDockets previously hardcoded `status === 0 ? "chip-open" : "chip-claimed"`, which painted
 * adjudicating, resolved, closed and expired dockets as if they were merely claimed. Keeping the
 * map in one module means a new status cannot be rendered inconsistently in two places.
 */
export const CHIP_CLASS: Record<number, string> = {
  [STATUS.OPEN]: "chip-open",
  [STATUS.CLAIMED]: "chip-claimed",
  [STATUS.SUBMITTED]: "chip-submitted",
  [STATUS.ADJUDICATING]: "chip-adjudicating",
  [STATUS.RESOLVED]: "chip-adjudicating",
  [STATUS.CLOSED]: "chip-closed",
  [STATUS.EXPIRED]: "chip-expired",
  [STATUS.ACCEPTED_FAST_PATH]: "chip-closed",
};