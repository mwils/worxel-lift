import { Badge } from "@mantine/core";
import { formatMoney } from "../../lib/format";

export interface PaidStateProps {
  total: number;
  paymentStatus?: string | null;
  balanceCents?: number | null;
}

/**
 * Paid / Partial $X due / Unpaid — the settlement state as it reads in a
 * history list. Unlike the board's quieter PaidMark this always answers the
 * question, because on a history row "was it paid?" is the whole point.
 */
export function PaidState({ total, paymentStatus, balanceCents }: PaidStateProps) {
  if (total <= 0 && paymentStatus !== "paid") {
    return (
      <Badge size="sm" variant="light" color="gray">
        —
      </Badge>
    );
  }
  if (paymentStatus === "paid") {
    return (
      <Badge size="sm" variant="light" color="teal">
        Paid
      </Badge>
    );
  }
  if (paymentStatus === "refunded") {
    return (
      <Badge size="sm" variant="light" color="gray">
        Refunded
      </Badge>
    );
  }
  const balance = balanceCents ?? total;
  if (paymentStatus === "partial" && balance > 0) {
    return (
      <Badge size="sm" variant="light" color="orange">
        Partial · {formatMoney(balance)} due
      </Badge>
    );
  }
  return (
    <Badge size="sm" variant="light" color="orange">
      Unpaid
    </Badge>
  );
}
