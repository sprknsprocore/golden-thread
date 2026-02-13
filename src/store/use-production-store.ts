import { create } from "zustand";
import seedData from "@/data/golden_thread_data.json";

/* ---------- Types ---------- */

export interface ProjectMetadata {
  name: string;
  status: string;
  location: string;
}

export interface ClaimingStep {
  name: string;
  weight: number;
}

export interface ClaimingSchema {
  id: string;
  name: string;
  steps: ClaimingStep[];
}

export interface MaterialRequirement {
  item: string;
  qty_required: number;
  uom: string;
}

export interface CrewTemplateMember {
  role: string;
  count: number;
}

export interface Assembly {
  wbs_code: string;
  description: string;
  budgeted_qty: number;
  uom: string;
  budgeted_hours: number;
  claiming_schema_id: string | null;
  blended_unit_cost: number;
  crew_template: CrewTemplateMember[];
  materials: MaterialRequirement[];
}

export interface InventoryItem {
  item: string;
  on_hand: number;
  uom: string;
}

export interface ClaimingProgress {
  step_name: string;
  percent_complete: number; // 0-100
}

export interface ProductionEvent {
  id: string;
  wbs_code: string;
  date: string;
  actual_hours: number;
  actual_qty: number;
  equipment_hours: number;
  description: string;
  claiming_progress: ClaimingProgress[];
  source: "kiosk" | "manual"; // how hours were captured
}

export const VARIANCE_REASONS = [
  "Weather",
  "RFI",
  "Rock/Unsuitable Soil",
  "Equipment Failure",
  "Rework",
  "Crew Shortage",
  "Material Delay",
  "Other",
] as const;

export type VarianceReason = (typeof VARIANCE_REASONS)[number];

export interface PmOverride {
  wbs_code: string;
  validated_qty: number;
  validated_hours: number;
  variance_reasons: VarianceReason[];
  variance_note: string;
}

export type TrueUpStatus = "pending" | "accepted" | "adjusted" | "flagged";

export interface EstimatingRecord {
  wbs_code: string;
  description: string;
  final_rate: number; // hours per unit
  uom: string;
  pushed_at: string;
}

/* ---------- Kiosk / Crew Types ---------- */

export interface Worker {
  id: string;
  name: string;
  role: string;
  hourly_rate: number;
}

export interface KioskEntry {
  id: string;
  worker_id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  total_hours: number;
}

export interface CrewAssignment {
  id: string;
  wbs_code: string;
  date: string;
  worker_ids: string[];
  auto_hours: number; // sum of individual kiosk hours for assigned workers
  manual_override: number | null; // foreman can override
}

/* ---------- Worker Allocation Types ---------- */

// date -> workerId -> wbsCode -> allocated hours
export type WorkerAllocations = Record<string, Record<string, Record<string, number>>>;

/* ---------- Store Shape ---------- */

interface ProductionStore {
  // Seed data
  projectMetadata: ProjectMetadata;
  assemblies: Assembly[];
  claimingSchemas: Record<string, ClaimingSchema>;
  provisionalCodes: string[];
  mockInventory: InventoryItem[];

  // Workforce data
  workers: Worker[];
  kioskEntries: KioskEntry[];
  crewAssignments: CrewAssignment[];
  workerAllocations: WorkerAllocations;

  // User-created data
  productionEvents: ProductionEvent[];
  pmOverrides: PmOverride[];
  trueUpStatuses: Record<string, TrueUpStatus>;
  estimatingDatabase: EstimatingRecord[];

  // Reconciliation ECAC overrides (persisted)
  ecacOverrides: Record<string, string>;

  // Assembly actions
  addAssembly: (assembly: Assembly) => void;

  // Provisional code actions
  addProvisionalCode: (wbsCode: string) => void;
  removeProvisionalCode: (wbsCode: string) => void;

  // Production event actions
  addProductionEvent: (event: ProductionEvent) => void;
  updateProductionEvent: (id: string, updates: Partial<Omit<ProductionEvent, "id">>) => void;
  deleteProductionEvent: (id: string) => void;

  // Crew assignment actions
  addCrewAssignment: (assignment: CrewAssignment) => void;

  // Worker allocation actions
  setWorkerAllocation: (date: string, workerId: string, wbsCode: string, hours: number) => void;
  clearWorkerAllocations: (date: string, wbsCode: string) => void;

  // Inventory actions
  drawdownInventory: (items: { item: string; qty: number }[]) => void;

  // PM override actions
  setPmOverride: (override: PmOverride) => void;

  // True-Up status actions
  setTrueUpStatus: (wbsCode: string, status: TrueUpStatus) => void;

  // Estimating actions
  pushToEstimatingDb: (records: EstimatingRecord[]) => void;

  // ECAC override actions
  setEcacOverride: (wbsCode: string, value: string) => void;

  // Demo
  seedDemoScenario: () => void;

  // Reset
  resetStore: () => void;
}

/* ---------- Seed Helpers ---------- */

const schemaMap: Record<string, ClaimingSchema> = {};
for (const [, schema] of Object.entries(seedData.claiming_schema_library)) {
  schemaMap[schema.id] = schema as ClaimingSchema;
}

const initialState = {
  projectMetadata: seedData.project_metadata as ProjectMetadata,
  assemblies: seedData.active_assemblies.map((a) => ({
    ...a,
    crew_template: (a as Record<string, unknown>).crew_template as CrewTemplateMember[] ?? [],
    materials: a.materials ?? [],
  })) as Assembly[],
  claimingSchemas: schemaMap,
  provisionalCodes: [...seedData.provisional_wbs_codes],
  mockInventory: seedData.mock_inventory.map((i) => ({ ...i })) as InventoryItem[],
  workers: (seedData.workers ?? []) as Worker[],
  kioskEntries: (seedData.kiosk_entries ?? []) as KioskEntry[],
  crewAssignments: [] as CrewAssignment[],
  workerAllocations: {} as WorkerAllocations,
  productionEvents: [] as ProductionEvent[],
  pmOverrides: [] as PmOverride[],
  trueUpStatuses: {} as Record<string, TrueUpStatus>,
  estimatingDatabase: [] as EstimatingRecord[],
  ecacOverrides: {} as Record<string, string>,
};

/* ---------- Store ---------- */

export const useProductionStore = create<ProductionStore>((set) => ({
  ...initialState,

  // Assembly actions
  addAssembly: (assembly) =>
    set((state) => ({
      assemblies: [...state.assemblies, assembly],
    })),

  // Provisional code actions
  addProvisionalCode: (wbsCode) =>
    set((state) => ({
      provisionalCodes: state.provisionalCodes.includes(wbsCode)
        ? state.provisionalCodes
        : [...state.provisionalCodes, wbsCode],
    })),

  removeProvisionalCode: (wbsCode) =>
    set((state) => ({
      provisionalCodes: state.provisionalCodes.filter((c) => c !== wbsCode),
    })),

  // Production event actions
  addProductionEvent: (event) =>
    set((state) => ({
      productionEvents: [...state.productionEvents, event],
    })),

  updateProductionEvent: (id, updates) =>
    set((state) => ({
      productionEvents: state.productionEvents.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
    })),

  deleteProductionEvent: (id) =>
    set((state) => ({
      productionEvents: state.productionEvents.filter((e) => e.id !== id),
    })),

  // Crew assignment actions
  addCrewAssignment: (assignment) =>
    set((state) => ({
      crewAssignments: [...state.crewAssignments, assignment],
    })),

  // Worker allocation actions
  setWorkerAllocation: (date, workerId, wbsCode, hours) =>
    set((state) => {
      const allocs = { ...state.workerAllocations };
      if (!allocs[date]) allocs[date] = {};
      if (!allocs[date][workerId]) allocs[date][workerId] = {};
      allocs[date][workerId] = { ...allocs[date][workerId], [wbsCode]: hours };
      return { workerAllocations: allocs };
    }),

  clearWorkerAllocations: (date, wbsCode) =>
    set((state) => {
      const allocs = { ...state.workerAllocations };
      if (allocs[date]) {
        for (const workerId of Object.keys(allocs[date])) {
          if (allocs[date][workerId]?.[wbsCode] !== undefined) {
            const workerAlloc = { ...allocs[date][workerId] };
            delete workerAlloc[wbsCode];
            allocs[date] = { ...allocs[date], [workerId]: workerAlloc };
          }
        }
      }
      return { workerAllocations: allocs };
    }),

  // Inventory actions
  drawdownInventory: (items) =>
    set((state) => ({
      mockInventory: state.mockInventory.map((inv) => {
        const match = items.find((i) => i.item === inv.item);
        if (match) {
          return { ...inv, on_hand: Math.max(0, inv.on_hand - match.qty) };
        }
        return inv;
      }),
    })),

  // PM override actions
  setPmOverride: (override) =>
    set((state) => {
      const existing = state.pmOverrides.findIndex(
        (o) => o.wbs_code === override.wbs_code
      );
      const updatedOverrides = existing >= 0
        ? state.pmOverrides.map((o, i) => (i === existing ? override : o))
        : [...state.pmOverrides, override];

      // Auto-set status to "adjusted" if not already flagged
      const currentStatus = state.trueUpStatuses[override.wbs_code];
      const updatedStatuses =
        currentStatus === "flagged"
          ? state.trueUpStatuses
          : { ...state.trueUpStatuses, [override.wbs_code]: "adjusted" as TrueUpStatus };

      return { pmOverrides: updatedOverrides, trueUpStatuses: updatedStatuses };
    }),

  // True-Up status actions
  setTrueUpStatus: (wbsCode, status) =>
    set((state) => ({
      trueUpStatuses: { ...state.trueUpStatuses, [wbsCode]: status },
    })),

  // Estimating actions
  pushToEstimatingDb: (records) =>
    set((state) => ({
      estimatingDatabase: [
        ...state.estimatingDatabase.filter(
          (r) => !records.some((nr) => nr.wbs_code === r.wbs_code)
        ),
        ...records,
      ],
    })),

  // ECAC override actions
  setEcacOverride: (wbsCode, value) =>
    set((state) => ({
      ecacOverrides: { ...state.ecacOverrides, [wbsCode]: value },
    })),

  // Demo scenario — seeds 3 days of realistic production data
  seedDemoScenario: () =>
    set((state) => {
      // Already seeded? Don't double-seed.
      if (state.productionEvents.length > 0) return {};

      // Compute Monday of the current week
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);

      const toKey = (d: Date) => d.toISOString().split("T")[0];
      const mon = toKey(monday);
      const tue = toKey(new Date(monday.getTime() + 86400000));
      const wed = toKey(new Date(monday.getTime() + 86400000 * 2));

      let evtId = 0;
      const id = () => `demo_evt_${++evtId}`;

      // ---- 12-inch RCP (02-750.steel.z-loop) ---- PF ~1.15
      // Budget: 580 LF, 80 hrs, cs_001
      // Claiming progress on latest event → ~42.5% weighted
      const rcp12Progress: ClaimingProgress[] = [
        { step_name: "Clean Rock Base", percent_complete: 100 },
        { step_name: "Lay Pipe", percent_complete: 45 },
        { step_name: "Fittings & Alignment", percent_complete: 15 },
        { step_name: "Backfill & Initial Test", percent_complete: 0 },
      ];

      const rcp12Events: ProductionEvent[] = [
        {
          id: id(), wbs_code: "02-750.steel.z-loop", date: mon,
          actual_hours: 10, actual_qty: 82, equipment_hours: 2,
          description: "Good production day. Crew hit stride after lunch.",
          claiming_progress: [], source: "kiosk",
        },
        {
          id: id(), wbs_code: "02-750.steel.z-loop", date: tue,
          actual_hours: 10, actual_qty: 84, equipment_hours: 2,
          description: "Steady pace. Subgrade was well-prepped.",
          claiming_progress: [], source: "kiosk",
        },
        {
          id: id(), wbs_code: "02-750.steel.z-loop", date: wed,
          actual_hours: 9.5, actual_qty: 80, equipment_hours: 1.5,
          description: "Short day — rain delay after 2pm.",
          claiming_progress: rcp12Progress, source: "kiosk",
        },
      ];

      // ---- 30-inch RCP (02-750.steel.z-loop-30) ---- PF ~0.79 (struggling)
      // Budget: 360 LF, 120 hrs, cs_001
      const rcp30Progress: ClaimingProgress[] = [
        { step_name: "Clean Rock Base", percent_complete: 80 },
        { step_name: "Lay Pipe", percent_complete: 20 },
        { step_name: "Fittings & Alignment", percent_complete: 5 },
        { step_name: "Backfill & Initial Test", percent_complete: 0 },
      ];

      const rcp30Events: ProductionEvent[] = [
        {
          id: id(), wbs_code: "02-750.steel.z-loop-30", date: mon,
          actual_hours: 13, actual_qty: 32, equipment_hours: 4,
          description: "Hit rock shelf at STA 4+50. Slow going.",
          claiming_progress: [], source: "kiosk",
        },
        {
          id: id(), wbs_code: "02-750.steel.z-loop-30", date: tue,
          actual_hours: 13.5, actual_qty: 28, equipment_hours: 5,
          description: "Rock continues. Brought in hydraulic breaker.",
          claiming_progress: [], source: "kiosk",
        },
        {
          id: id(), wbs_code: "02-750.steel.z-loop-30", date: wed,
          actual_hours: 12, actual_qty: 30, equipment_hours: 3.5,
          description: "Through worst of rock. Production improving.",
          claiming_progress: rcp30Progress, source: "kiosk",
        },
      ];

      // ---- Form Walls (03-310.TL) ---- PF ~1.01 (on track)
      // Budget: 6510 SF, 400 hrs, no claiming schema
      const formEvents: ProductionEvent[] = [
        {
          id: id(), wbs_code: "03-310.TL", date: mon,
          actual_hours: 26, actual_qty: 440, equipment_hours: 0,
          description: "Started east wall section.",
          claiming_progress: [], source: "kiosk",
        },
        {
          id: id(), wbs_code: "03-310.TL", date: tue,
          actual_hours: 26.5, actual_qty: 420, equipment_hours: 0,
          description: "Completed east wall. Moving to north.",
          claiming_progress: [], source: "kiosk",
        },
        {
          id: id(), wbs_code: "03-310.TL", date: wed,
          actual_hours: 26, actual_qty: 430, equipment_hours: 0,
          description: "North wall in progress. On schedule.",
          claiming_progress: [], source: "kiosk",
        },
      ];

      const allEvents = [...rcp12Events, ...rcp30Events, ...formEvents];

      // PM Override for 30-inch RCP (field underreported qty)
      const demoOverrides: PmOverride[] = [
        {
          wbs_code: "02-750.steel.z-loop-30",
          validated_qty: 95,
          validated_hours: 38.5,
          variance_reasons: ["Rock/Unsuitable Soil", "Equipment Failure"],
          variance_note:
            "Hit unexpected rock shelf at STA 4+50. Expect slower production through Wednesday. Switching to hydraulic breaker. Field count was 90 LF but site walk confirmed 95 LF in place.",
        },
      ];

      // Inventory drawdown to match installed quantities
      // 12" RCP: 246 LF of pipe, proportional stone
      // 30" RCP: 90 LF of pipe
      const updatedInventory = state.mockInventory.map((inv) => {
        if (inv.item === "RCP Pipe 12\"") {
          return { ...inv, on_hand: Math.max(0, inv.on_hand - 246) };
        }
        if (inv.item === "Clean Stone Base") {
          // 246 LF * (189 TON / 580 LF) = ~80 TON
          return { ...inv, on_hand: Math.max(0, inv.on_hand - 80) };
        }
        if (inv.item === "RCP Pipe 30\"") {
          return { ...inv, on_hand: Math.max(0, inv.on_hand - 90) };
        }
        return inv;
      });

      return {
        productionEvents: allEvents,
        pmOverrides: demoOverrides,
        trueUpStatuses: { "02-750.steel.z-loop-30": "adjusted" as TrueUpStatus },
        mockInventory: updatedInventory,
      };
    }),

  // Reset
  resetStore: () => set(() => ({ ...initialState })),
}));
