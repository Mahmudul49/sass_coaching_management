/**
 * Smart fee allocation engine (pure, side-effect free, fully unit-testable).
 *
 * Given a student's ENROLLED months (each with the payable resolved from the fee
 * structure / per-student override) and the POOL of money actually collected
 * (Σ paidAmount across the student's payment records), allocate the pool across
 * the months **chronologically (oldest first)**:
 *
 *   - Overpayment in any month flows forward and prepays later months (ADVANCE).
 *   - Underpayment leaves the earliest months unpaid (ARREAR) until later
 *     payments cover them.
 *   - A month with payable 0 means "Not Enrolled" and is excluded entirely from
 *     payable / due / status (the caller filters those out before enrolling).
 *
 * The raw per-month payment records are NEVER mutated by this — allocation is a
 * read-time computation, so changing a fee or override instantly recalculates.
 */

export type MonthPayable = {
  year: number;
  month: number; // 1-12
  payable: number; // resolved from fee structure (+ override); >0 means enrolled
};

export type AllocationStatus = "paid" | "partial" | "due";

export type AllocatedMonth = {
  year: number;
  month: number;
  payable: number;
  allocated: number; // how much of the pool covered this month
  due: number; // payable - allocated
  status: AllocationStatus;
};

export type Allocation = {
  months: AllocatedMonth[];
  totalPayable: number;
  totalPaid: number; // the pool that was fed in
  totalAllocated: number; // pool actually consumed by payable months
  totalDue: number; // totalPayable - totalAllocated
  advance: number; // leftover pool after every enrolled month is covered
};

/**
 * Allocate `pool` across `monthsIn` oldest-first. Months with payable <= 0
 * ("Not Enrolled") are dropped. Returns per-month allocation plus totals.
 */
export function allocatePayments(monthsIn: MonthPayable[], pool: number): Allocation {
  const months = monthsIn
    .filter((m) => Number(m.payable) > 0) // payable 0 → Not Enrolled → excluded
    .sort((a, b) => a.year - b.year || a.month - b.month);

  const startPool = Math.max(0, Number(pool) || 0);
  let remaining = startPool;
  let totalPayable = 0;
  let totalAllocated = 0;

  const out: AllocatedMonth[] = months.map((m) => {
    const payable = Number(m.payable);
    const allocated = Math.min(remaining, payable);
    remaining -= allocated;
    totalPayable += payable;
    totalAllocated += allocated;
    const due = payable - allocated;
    const status: AllocationStatus = allocated >= payable ? "paid" : allocated > 0 ? "partial" : "due";
    return { year: m.year, month: m.month, payable, allocated, due, status };
  });

  return {
    months: out,
    totalPayable,
    totalPaid: startPool,
    totalAllocated,
    totalDue: totalPayable - totalAllocated,
    advance: remaining, // whatever the pool couldn't spend = prepaid balance
  };
}
