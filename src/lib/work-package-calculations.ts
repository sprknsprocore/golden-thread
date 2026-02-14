import type { Assembly, WorkPackageComponent } from "@/store/use-production-store";

/* ================================================================
   Work Package (Assembly) Backtracking & EAC Projection Engine
   ================================================================ */

/* ---------- Individual Calculation Functions ---------- */

/**
 * Component weight = Component_Budgeted_Hours / Parent_Total_Budgeted_Hours.
 */
export function calcWeight(componentHours: number, totalHours: number): number {
  if (totalHours === 0) return 0;
  return componentHours / totalHours;
}

/**
 * Back-allocated actual hours for a component.
 * Earned Hours = Component_Weight * Parent_Actual_Hours.
 */
export function calcEarnedHours(weight: number, parentActualHours: number): number {
  return weight * parentActualHours;
}

/**
 * Simple progress percentage: qty_installed / plan_qty (0..1).
 */
export function calcProgressPercent(qtyInstalled: number, planQty: number): number {
  if (planQty === 0) return 0;
  return Math.min(qtyInstalled / planQty, 1);
}

/**
 * Earned Value (in hours) = Progress_% * Component_Budgeted_Hours.
 */
export function calcEarnedValue(progressPct: number, componentBudgetedHours: number): number {
  return progressPct * componentBudgetedHours;
}

/**
 * Inferred production rate = Qty_Installed / Back_Calculated_Actual_Hours.
 */
export function calcInferredProductionRate(qtyInstalled: number, earnedHours: number): number {
  if (earnedHours === 0) return 0;
  return qtyInstalled / earnedHours;
}

/**
 * Original bid rate = Plan_Qty / Budgeted_Hours.
 */
export function calcBidRate(planQty: number, budgetedHours: number): number {
  if (budgetedHours === 0) return 0;
  return planQty / budgetedHours;
}

/**
 * Variance flag based on inferred rate vs. bid rate.
 */
export type VarianceFlag = "ahead" | "on_track" | "behind";

export function calcVarianceFlag(inferredRate: number, bidRate: number): VarianceFlag {
  if (bidRate === 0) return "on_track";
  const ratio = inferredRate / bidRate;
  if (ratio >= 1.1) return "ahead";
  if (ratio >= 0.9) return "on_track";
  return "behind";
}

/**
 * Variance percentage: positive = faster, negative = slower.
 */
export function calcVariancePercent(inferredRate: number, bidRate: number): number {
  if (bidRate === 0) return 0;
  return ((inferredRate - bidRate) / bidRate) * 100;
}

/* ---------- Component Analysis ---------- */

export interface ComponentAnalysis {
  id: string;
  name: string;
  uom: string;
  plan_qty: number;
  budgeted_hours: number;
  weight: number;
  weight_pct: number;

  // Progress
  qty_installed: number;
  progress_pct: number;

  // Earned value
  earned_hours: number;
  earned_value: number;

  // Rates
  bid_rate: number;
  inferred_rate: number;

  // Variance
  variance_flag: VarianceFlag;
  variance_pct: number;
}

/**
 * Roll up all per-component metrics.
 * Accepts an Assembly (from the main store) and actual hours from aggregateEvents.
 */
export function calcAllComponents(
  assembly: Assembly,
  actualHoursSpent: number
): ComponentAnalysis[] {
  const components = assembly.components ?? [];
  const totalBudgetedHours = assembly.budgeted_hours;

  return components.map((comp: WorkPackageComponent) => {
    const weight = calcWeight(comp.budgeted_hours, totalBudgetedHours);
    const progressPct = calcProgressPercent(comp.qty_installed, comp.plan_qty);
    const earnedHours = calcEarnedHours(weight, actualHoursSpent);
    const earnedValue = calcEarnedValue(progressPct, comp.budgeted_hours);
    const bidRate = calcBidRate(comp.plan_qty, comp.budgeted_hours);
    const inferredRate = calcInferredProductionRate(comp.qty_installed, earnedHours);
    const varianceFlag = calcVarianceFlag(inferredRate, bidRate);
    const variancePct = calcVariancePercent(inferredRate, bidRate);

    return {
      id: comp.id,
      name: comp.name,
      uom: comp.uom,
      plan_qty: comp.plan_qty,
      budgeted_hours: comp.budgeted_hours,
      weight,
      weight_pct: weight * 100,
      qty_installed: comp.qty_installed,
      progress_pct: progressPct,
      earned_hours: earnedHours,
      earned_value: earnedValue,
      bid_rate: bidRate,
      inferred_rate: inferredRate,
      variance_flag: varianceFlag,
      variance_pct: variancePct,
    };
  });
}

/* ---------- EAC Projection Engine ---------- */

export interface ComponentEAC {
  hours_at_completion: number;
  projected_overrun_hrs: number;
  recovery_rate: number;
  can_recover: boolean;
}

export interface AssemblyEAC {
  total_hours_at_completion: number;
  total_projected_overrun_hrs: number;
  dollar_impact: number;
  weighted_progress: number;
  hourly_rate: number;
  components: (ComponentAnalysis & ComponentEAC)[];
}

/**
 * Per-component EAC projection.
 */
export function calcComponentEAC(analysis: ComponentAnalysis): ComponentEAC {
  const remainingQty = Math.max(0, analysis.plan_qty - analysis.qty_installed);

  // If no progress or no earned hours, project at bid rate
  if (analysis.qty_installed === 0 || analysis.earned_hours === 0) {
    return {
      hours_at_completion: analysis.budgeted_hours,
      projected_overrun_hrs: 0,
      recovery_rate: analysis.bid_rate,
      can_recover: true,
    };
  }

  // Project forward at current inferred rate
  const remainingHours =
    analysis.inferred_rate > 0 ? remainingQty / analysis.inferred_rate : 0;
  const hoursAtCompletion = analysis.earned_hours + remainingHours;
  const projectedOverrun = hoursAtCompletion - analysis.budgeted_hours;

  // Recovery rate: what rate is needed to finish within original budget
  const budgetHoursRemaining = Math.max(0, analysis.budgeted_hours - analysis.earned_hours);
  const recoveryRate = budgetHoursRemaining > 0 ? remainingQty / budgetHoursRemaining : 0;

  // Can recover if recovery rate is less than 2x the bid rate
  const canRecover = analysis.bid_rate > 0 ? recoveryRate < analysis.bid_rate * 2 : true;

  return {
    hours_at_completion: hoursAtCompletion,
    projected_overrun_hrs: projectedOverrun,
    recovery_rate: recoveryRate,
    can_recover: canRecover,
  };
}

/**
 * Assembly-level EAC rollup.
 */
export function calcAssemblyEAC(
  assembly: Assembly,
  actualHoursSpent: number
): AssemblyEAC {
  const analyses = calcAllComponents(assembly, actualHoursSpent);

  const componentsWithEAC = analyses.map((a) => ({
    ...a,
    ...calcComponentEAC(a),
  }));

  const totalHoursAtCompletion = componentsWithEAC.reduce(
    (s, c) => s + c.hours_at_completion,
    0
  );
  const totalProjectedOverrun = totalHoursAtCompletion - assembly.budgeted_hours;

  // Derive hourly rate: blended_unit_cost * budgeted_qty / budgeted_hours
  const hourlyRate =
    assembly.budgeted_hours > 0
      ? (assembly.blended_unit_cost * assembly.budgeted_qty) / assembly.budgeted_hours
      : 0;

  const dollarImpact = totalProjectedOverrun * hourlyRate;

  // Weighted progress: SUM(component_progress * component_weight)
  const weightedProgress = componentsWithEAC.reduce(
    (s, c) => s + c.progress_pct * c.weight,
    0
  );

  return {
    total_hours_at_completion: totalHoursAtCompletion,
    total_projected_overrun_hrs: totalProjectedOverrun,
    dollar_impact: dollarImpact,
    weighted_progress: weightedProgress,
    hourly_rate: hourlyRate,
    components: componentsWithEAC,
  };
}

/* ---------- Narrative Generation ---------- */

/**
 * Human-readable narrative for a component's performance.
 */
export function generateNarrative(
  analysis: ComponentAnalysis,
  parentActualHours: number
): string {
  if (analysis.qty_installed === 0 || parentActualHours === 0) {
    return `${analysis.name}: No progress recorded yet.`;
  }

  const earnedStr = analysis.earned_hours.toFixed(2);
  const progressStr = (analysis.progress_pct * 100).toFixed(0);
  const inferredStr = analysis.inferred_rate.toFixed(2);
  const bidStr = analysis.bid_rate.toFixed(2);
  const absPct = Math.abs(analysis.variance_pct).toFixed(0);

  let comparison: string;
  if (analysis.variance_flag === "ahead") {
    comparison = `${absPct}% faster than bid`;
  } else if (analysis.variance_flag === "behind") {
    comparison = `${absPct}% slower than bid`;
  } else {
    comparison = "on track with bid";
  }

  return (
    `${analysis.name} has earned ${earnedStr} of the ${parentActualHours} parent hours. ` +
    `At ${progressStr}% progress on ${analysis.plan_qty} ${analysis.uom} planned, ` +
    `the inferred rate is ${inferredStr} ${analysis.uom}/hr vs. bid rate of ${bidStr} ${analysis.uom}/hr` +
    ` — ${comparison}.`
  );
}

/**
 * Assembly-level EAC narrative.
 */
export function generateEACNarrative(eac: AssemblyEAC, assembly: Assembly): string {
  if (eac.weighted_progress === 0) {
    return "No component progress recorded yet. EAC projections will appear once field data flows in.";
  }

  const overrun = eac.total_projected_overrun_hrs;
  const hrsStr = Math.abs(overrun).toFixed(1);
  const dollarStr = `$${Math.abs(eac.dollar_impact).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

  if (overrun > 0.5) {
    return (
      `At current pace, this assembly will consume ${eac.total_hours_at_completion.toFixed(1)} hrs ` +
      `instead of the budgeted ${assembly.budgeted_hours} — ` +
      `${hrsStr} hrs over budget (${dollarStr} impact).`
    );
  } else if (overrun < -0.5) {
    return (
      `Tracking ahead of budget. Projected to finish in ${eac.total_hours_at_completion.toFixed(1)} hrs ` +
      `vs. ${assembly.budgeted_hours} budgeted — saving ${hrsStr} hrs (${dollarStr}).`
    );
  }
  return (
    `On track. Projected ${eac.total_hours_at_completion.toFixed(1)} hrs ` +
    `against ${assembly.budgeted_hours} budgeted.`
  );
}
