import { STATUS_LABEL } from "@/lib/docket";
import { CHIP_CLASS } from "@/lib/status-chip";

export function StatusChip({ status }: { status: number }) {
  return (
    <span className={`chip ${CHIP_CLASS[status] ?? "chip-closed"}`}>
      {STATUS_LABEL[status] ?? "Unknown"}
    </span>
  );
}