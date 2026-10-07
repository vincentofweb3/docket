import { STATUS, STATUS_LABEL } from "@/lib/docket";

const CHIP_CLASS: Record<number, string> = {
  [STATUS.OPEN]: "chip-open",
  [STATUS.CLAIMED]: "chip-claimed",
  [STATUS.SUBMITTED]: "chip-submitted",
  [STATUS.ADJUDICATING]: "chip-adjudicating",
  [STATUS.RESOLVED]: "chip-adjudicating",
  [STATUS.CLOSED]: "chip-closed",
  [STATUS.EXPIRED]: "chip-expired",
  [STATUS.ACCEPTED_FAST_PATH]: "chip-closed",
};

export function StatusChip({ status }: { status: number }) {
  return (
    <span className={`chip ${CHIP_CLASS[status] ?? "chip-closed"}`}>
      {STATUS_LABEL[status] ?? "Unknown"}
    </span>
  );
}