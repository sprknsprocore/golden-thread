import type {
  Assembly,
  ClaimingProgress,
  ClaimingSchema,
  KioskEntry,
  ProductionEvent,
  Worker,
  WorkerAllocations,
} from "@/store/use-production-store";

/**
 * Earned Hours = Budgeted Hours * % Complete (from claiming schema).
 * If no claiming schema, uses actual_qty / budgeted_qty as % complete.
 */
export function calcEarnedHours(
  budgetedHours: number,
  percentComplete: number
): number {
  return budgetedHours * Math.min(percentComplete, 1);
}

/**
 * Performance Factor = Earned Hours / Actual Hours.
 * PF >= 1.0 = winning, PF < 1.0 = losing.
 * Returns Infinity if actual hours is 0 (no work logged).
 */
export function calcPerformanceFactor(
  earnedHours: number,
  actualHours: number
): number {
  if (actualHours === 0) return earnedHours > 0 ? Infinity : 0;
  return earnedHours / actualHours;
}

/**
 * Calculate % complete for an assembly from its claiming progress.
 * Weighted sum of (step_weight * step_%_complete).
 */
export function calcClaimingPercentComplete(
  schema: ClaimingSchema,
  progress: ClaimingProgress[]
): number {
  let total = 0;
  for (const step of schema.steps) {
    const p = progress.find((pr) => pr.step_name === step.name);
    const pct = p ? p.percent_complete / 100 : 0;
    total += step.weight * pct;
  }
  return total;
}

/**
 * Calculate simple % complete (no claiming schema): actual_qty / budgeted_qty.
 */
export function calcSimplePercentComplete(
  actualQty: number,
  budgetedQty: number
): number {
  if (budgetedQty === 0) return 0;
  return Math.min(actualQty / budgetedQty, 1);
}

/**
 * Reverse Calculation: Given an ECAC override, back-calculate the required
 * productivity rate (units per hour) needed to hit that target.
 */
export function calcReverseRate(
  budgetedQty: number,
  actualQty: number,
  budgetedHours: number,
  actualHours: number,
  ecacOverride: number,
  blendedUnitCost: number,
  actualCostToDate: number
): { requiredRate: number; remainingHours: number; remainingQty: number } {
  const remainingQty = Math.max(0, budgetedQty - actualQty);
  const remainingBudget = Math.max(0, ecacOverride - actualCostToDate);
  const remainingUnits =
    blendedUnitCost > 0 ? remainingBudget / blendedUnitCost : 0;
  const hoursPerUnit = budgetedQty > 0 ? budgetedHours / budgetedQty : 0;
  const remainingHours = remainingUnits * hoursPerUnit;
  const requiredRate =
    remainingHours > 0 ? remainingQty / remainingHours : 0;

  return { requiredRate, remainingHours, remainingQty };
}

/**
 * Inline ECAC: Estimate Cost at Completion based on current actual cost
 * and the projected cost of remaining work at the current production rate.
 * If no actual data, returns the original budget.
 *
 * Also computes the required production rate (units/hr) to hit original budget.
 */
export function calcInlineECAC(
  budgetedQty: number,
  actualQty: number,
  budgetedHours: number,
  actualHours: number,
  blendedUnitCost: number
): {
  ecac: number;
  requiredRate: number;
  currentRate: number;
  remainingQty: number;
  remainingHours: number;
} {
  const budgetedCost = budgetedQty * blendedUnitCost;
  const actualCostToDate = actualQty * blendedUnitCost;
  const remainingQty = Math.max(0, budgetedQty - actualQty);

  // If no actual work yet, ECAC = original budget
  if (actualHours === 0 || actualQty === 0) {
    const budgetedRate = budgetedQty > 0 ? budgetedQty / budgetedHours : 0;
    return {
      ecac: budgetedCost,
      requiredRate: budgetedRate,
      currentRate: 0,
      remainingQty,
      remainingHours: budgetedHours,
    };
  }

  // Current rate: units per hour
  const currentRate = actualQty / actualHours;

  // Project remaining hours at current rate
  const remainingHours = currentRate > 0 ? remainingQty / currentRate : 0;

  // ECAC based on cost: actual spent + remaining at current productivity
  const projectedRemainingCost = remainingQty * blendedUnitCost;
  const ecac = actualCostToDate + projectedRemainingCost;

  // Required rate (units/hr) to finish remaining work within original budget hours
  const budgetedHoursRemaining = Math.max(0, budgetedHours - actualHours);
  const requiredRate =
    budgetedHoursRemaining > 0 ? remainingQty / budgetedHoursRemaining : 0;

  return {
    ecac,
    requiredRate,
    currentRate,
    remainingQty,
    remainingHours,
  };
}

/**
 * Calculate material drawdown quantities proportional to units installed.
 */
export function calcMaterialDrawdown(
  assembly: Assembly,
  unitsInstalled: number
): { item: string; qty: number }[] {
  if (!assembly.materials || assembly.materials.length === 0 || assembly.budgeted_qty === 0) {
    return [];
  }
  const ratio = unitsInstalled / assembly.budgeted_qty;
  return assembly.materials.map((m) => ({
    item: m.item,
    qty: Math.round(m.qty_required * ratio * 100) / 100,
  }));
}

/**
 * Final production rate for closeout: total_hours / total_qty (MH per unit).
 */
export function calcFinalProductionRate(
  totalHours: number,
  totalQty: number
): number {
  if (totalQty === 0) return 0;
  return totalHours / totalQty;
}

/**
 * Aggregate production events for a given WBS code.
 */
export function aggregateEvents(
  events: ProductionEvent[],
  wbsCode: string
): { totalHours: number; totalQty: number; totalEquipHours: number } {
  return events
    .filter((e) => e.wbs_code === wbsCode)
    .reduce(
      (acc, e) => ({
        totalHours: acc.totalHours + e.actual_hours,
        totalQty: acc.totalQty + e.actual_qty,
        totalEquipHours: acc.totalEquipHours + e.equipment_hours,
      }),
      { totalHours: 0, totalQty: 0, totalEquipHours: 0 }
    );
}

/* ---------- Kiosk / Crew Calculations ---------- */

/**
 * Get kiosk entries for a specific date.
 */
export function getKioskEntriesForDate(
  entries: KioskEntry[],
  date: string
): KioskEntry[] {
  return entries.filter((e) => e.date === date);
}

/**
 * Get kiosk entry for a specific worker on a specific date.
 */
export function getWorkerKioskEntry(
  entries: KioskEntry[],
  workerId: string,
  date: string
): KioskEntry | undefined {
  return entries.find((e) => e.worker_id === workerId && e.date === date);
}

/**
 * Calculate total crew hours from kiosk entries for a set of worker IDs on a date.
 */
export function calcCrewHoursFromKiosk(
  entries: KioskEntry[],
  workerIds: string[],
  date: string
): number {
  return entries
    .filter((e) => workerIds.includes(e.worker_id) && e.date === date && e.total_hours > 0)
    .reduce((sum, e) => sum + e.total_hours, 0);
}

/**
 * Get workers who are clocked in on a given date.
 */
export function getAvailableWorkers(
  workers: Worker[],
  entries: KioskEntry[],
  date: string
): (Worker & { kiosk_hours: number })[] {
  const dayEntries = getKioskEntriesForDate(entries, date);
  return workers
    .map((w) => {
      const entry = dayEntries.find((e) => e.worker_id === w.id);
      return {
        ...w,
        kiosk_hours: entry?.total_hours ?? 0,
      };
    })
    .filter((w) => w.kiosk_hours > 0);
}

/* ---------- Worker Allocation Helpers ---------- */

/**
 * Get remaining available hours for a worker on a date,
 * excluding hours already allocated to other WBS codes.
 */
export function getRemainingWorkerHours(
  workerAllocations: WorkerAllocations,
  kioskEntries: KioskEntry[],
  workerId: string,
  date: string,
  excludeWbsCode?: string
): number {
  const kioskEntry = kioskEntries.find(
    (e) => e.worker_id === workerId && e.date === date
  );
  const totalKioskHours = kioskEntry?.total_hours ?? 0;

  const dateAllocs = workerAllocations[date]?.[workerId] ?? {};
  let allocatedElsewhere = 0;
  for (const [wbs, hrs] of Object.entries(dateAllocs)) {
    if (wbs !== excludeWbsCode) {
      allocatedElsewhere += hrs;
    }
  }

  return Math.max(0, totalKioskHours - allocatedElsewhere);
}

/**
 * Get hours allocated to a specific worker for a specific WBS code on a date.
 */
export function getWorkerAllocatedHours(
  workerAllocations: WorkerAllocations,
  workerId: string,
  date: string,
  wbsCode: string
): number {
  return workerAllocations[date]?.[workerId]?.[wbsCode] ?? 0;
}

/**
 * Get total allocated hours for a WBS code on a date across all workers.
 */
export function getTotalAllocatedHoursForCode(
  workerAllocations: WorkerAllocations,
  date: string,
  wbsCode: string
): number {
  const dateAllocs = workerAllocations[date];
  if (!dateAllocs) return 0;
  let total = 0;
  for (const workerAllocs of Object.values(dateAllocs)) {
    total += workerAllocs[wbsCode] ?? 0;
  }
  return total;
}

/* ---------- Claiming Staleness ---------- */

/**
 * Check if claiming progress is stale for a WBS code.
 * Returns true when the most recent event has empty claiming progress
 * but an earlier event had non-empty claiming progress.
 */
export function isClaimingStale(
  events: ProductionEvent[],
  wbsCode: string
): boolean {
  const codeEvents = events.filter((e) => e.wbs_code === wbsCode);
  if (codeEvents.length < 2) return false;

  const latestEvent = codeEvents[codeEvents.length - 1];
  const hasLatestProgress =
    latestEvent.claiming_progress && latestEvent.claiming_progress.length > 0;

  if (hasLatestProgress) return false;

  // Check if any earlier event had progress
  for (let i = codeEvents.length - 2; i >= 0; i--) {
    if (
      codeEvents[i].claiming_progress &&
      codeEvents[i].claiming_progress.length > 0
    ) {
      return true;
    }
  }
  return false;
}

/* ---------- Differential / Analysis Calculations ---------- */

/**
 * Full analysis row for a single assembly – computes all budget/hours/productivity metrics.
 */
export interface AssemblyAnalysis {
  wbs_code: string;
  description: string;
  uom: string;
  // Quantity
  budgeted_qty: number;
  actual_qty: number;
  qty_variance: number;
  qty_pct_complete: number;
  // Hours
  budgeted_hours: number;
  earned_hours: number;
  actual_hours: number;
  hour_differential: number;
  // Cost
  budgeted_cost: number;
  actual_cost: number;
  cost_variance: number;
  cost_variance_pct: number;
  // Performance
  performance_factor: number;
  status: "on_track" | "at_risk" | "over";
}

export function calcAssemblyAnalysis(
  assembly: Assembly,
  events: ProductionEvent[],
  pmOverride?: { validated_qty: number; validated_hours: number } | null,
  claimingSchema?: ClaimingSchema | null
): AssemblyAnalysis {
  const agg = aggregateEvents(events, assembly.wbs_code);

  const actualQty = pmOverride?.validated_qty ?? agg.totalQty;
  const actualHours = pmOverride?.validated_hours ?? agg.totalHours;

  // Percent complete
  let pctComplete: number;
  if (claimingSchema) {
    const latestEvent = events
      .filter((e) => e.wbs_code === assembly.wbs_code)
      .at(-1);
    pctComplete = latestEvent
      ? calcClaimingPercentComplete(claimingSchema, latestEvent.claiming_progress)
      : 0;
  } else {
    pctComplete = calcSimplePercentComplete(actualQty, assembly.budgeted_qty);
  }

  const earnedHours = calcEarnedHours(assembly.budgeted_hours, pctComplete);
  const pf = calcPerformanceFactor(earnedHours, actualHours);

  const budgetedCost = assembly.budgeted_qty * assembly.blended_unit_cost;
  const actualCost = actualQty * assembly.blended_unit_cost;
  const costVariance = actualCost - budgetedCost;
  const costVariancePct = budgetedCost !== 0 ? (costVariance / budgetedCost) * 100 : 0;

  // Hour differential: positive means we used more hours than earned (bad)
  const hourDifferential = actualHours - earnedHours;

  // Status based on PF
  let status: AssemblyAnalysis["status"];
  if (actualHours === 0) {
    status = "on_track"; // no data yet
  } else if (pf >= 0.95) {
    status = "on_track";
  } else if (pf >= 0.8) {
    status = "at_risk";
  } else {
    status = "over";
  }

  return {
    wbs_code: assembly.wbs_code,
    description: assembly.description,
    uom: assembly.uom,
    budgeted_qty: assembly.budgeted_qty,
    actual_qty: actualQty,
    qty_variance: actualQty - assembly.budgeted_qty,
    qty_pct_complete: pctComplete * 100,
    budgeted_hours: assembly.budgeted_hours,
    earned_hours: earnedHours,
    actual_hours: actualHours,
    hour_differential: hourDifferential,
    budgeted_cost: budgetedCost,
    actual_cost: actualCost,
    cost_variance: costVariance,
    cost_variance_pct: costVariancePct,
    performance_factor: pf,
    status,
  };
}
