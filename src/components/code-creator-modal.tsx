"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, X, ChevronRight, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  useProductionStore,
  type CrewTemplateMember,
} from "@/store/use-production-store";

const COMMON_UOMS = ["LF", "SF", "CY", "TON", "EA", "HR", "LS", "GAL", "SY"];
const COMMON_ROLES = [
  "Laborer",
  "Operator",
  "Pipe Layer",
  "Carpenter",
  "Electrician",
  "Ironworker",
  "Mason",
  "Foreman",
];

interface FormState {
  description: string;
  costCode: string;
  costType: string;
  budgetedQty: string;
  uom: string;
  budgetedHours: string;
  crewTemplate: CrewTemplateMember[];
  unitCost: string;
  claimingSchemaId: string;
}

const emptyForm: FormState = {
  description: "",
  costCode: "",
  costType: "",
  budgetedQty: "",
  uom: "",
  budgetedHours: "",
  crewTemplate: [],
  unitCost: "",
  claimingSchemaId: "",
};

interface CodeCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CodeCreatorModal({ open, onOpenChange }: CodeCreatorModalProps) {
  const { addAssembly, addProvisionalCode, claimingSchemas, assemblies } =
    useProductionStore();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newRole, setNewRole] = useState("");
  const [newRoleCount, setNewRoleCount] = useState("1");

  const wbsCode = [form.costCode, form.costType].filter(Boolean).join(".");

  const qty = parseFloat(form.budgetedQty) || 0;
  const hours = parseFloat(form.budgetedHours) || 0;
  const unitCost = parseFloat(form.unitCost) || 0;
  const totalBudget = qty * unitCost;
  const totalCrewSize = form.crewTemplate.reduce((s, m) => s + m.count, 0);

  const isDuplicate = assemblies.some((a) => a.wbs_code === wbsCode);
  const isValid =
    form.description.trim() !== "" &&
    wbsCode !== "" &&
    qty > 0 &&
    form.uom !== "" &&
    hours > 0 &&
    !isDuplicate;

  const update = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addCrewMember = () => {
    const role = newRole.trim();
    const count = parseInt(newRoleCount) || 1;
    if (!role) return;

    setForm((prev) => {
      const existing = prev.crewTemplate.findIndex((m) => m.role === role);
      if (existing >= 0) {
        const updated = [...prev.crewTemplate];
        updated[existing] = {
          ...updated[existing],
          count: updated[existing].count + count,
        };
        return { ...prev, crewTemplate: updated };
      }
      return {
        ...prev,
        crewTemplate: [...prev.crewTemplate, { role, count }],
      };
    });
    setNewRole("");
    setNewRoleCount("1");
  };

  const removeCrewMember = (role: string) => {
    setForm((prev) => ({
      ...prev,
      crewTemplate: prev.crewTemplate.filter((m) => m.role !== role),
    }));
  };

  const handleCreate = () => {
    if (!isValid) return;

    addAssembly({
      wbs_code: wbsCode,
      description: form.description.trim(),
      budgeted_qty: qty,
      uom: form.uom,
      budgeted_hours: hours,
      claiming_schema_id: form.claimingSchemaId || null,
      blended_unit_cost: unitCost,
      crew_template: form.crewTemplate,
      materials: [],
    });

    addProvisionalCode(wbsCode);
    toast.success(`${form.description.trim()} created and added`);
    handleClose();
  };

  const handleClose = () => {
    setForm(emptyForm);
    setNewRole("");
    setNewRoleCount("1");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create WBS Code</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Start with what you&apos;re building, then set targets. Cost is
            derived last.
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Step 1: WHAT */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-mono">
                1
              </Badge>
              <span className="text-sm font-semibold">
                What are you building?
              </span>
            </div>
            <div className="space-y-2 pl-7">
              <div>
                <Label className="text-xs">Description</Label>
                <Input
                  placeholder="e.g., 12-inch RCP Storm Pipe"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  className="mt-1"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cost Code</Label>
                  <Input
                    placeholder="e.g., 02-750"
                    value={form.costCode}
                    onChange={(e) => update("costCode", e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">Cost Type</Label>
                  <Input
                    placeholder="e.g., steel.z-loop"
                    value={form.costType}
                    onChange={(e) => update("costType", e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>
              {wbsCode && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  WBS Code:{" "}
                  <span className="font-mono font-medium">
                    {wbsCode.split(".").map((seg, i, arr) => (
                      <span key={i} className="inline-flex items-center">
                        {seg}
                        {i < arr.length - 1 && (
                          <ChevronRight className="h-3 w-3 mx-0.5 inline" />
                        )}
                      </span>
                    ))}
                  </span>
                  {isDuplicate && (
                    <Badge variant="destructive" className="text-[10px] ml-2">
                      Duplicate
                    </Badge>
                  )}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Step 2: HOW MUCH */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-mono">
                2
              </Badge>
              <span className="text-sm font-semibold">How much?</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pl-7">
              <div>
                <Label className="text-xs">Budgeted Quantity</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.budgetedQty}
                  onChange={(e) => update("budgetedQty", e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Unit of Measure</Label>
                <Select
                  value={form.uom}
                  onValueChange={(v) => update("uom", v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_UOMS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Step 3: HOW LONG */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-mono">
                3
              </Badge>
              <span className="text-sm font-semibold">How long? (Labor)</span>
            </div>
            <div className="space-y-3 pl-7">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Budgeted Hours (total)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.budgetedHours}
                    onChange={(e) => update("budgetedHours", e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">Claiming Schema (optional)</Label>
                  <Select
                    value={form.claimingSchemaId}
                    onValueChange={(v) => update("claimingSchemaId", v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {Object.values(claimingSchemas).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Crew Template */}
              <div>
                <Label className="text-xs">Default Crew Template</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={newRoleCount}
                    onChange={(e) => setNewRoleCount(e.target.value)}
                    className="w-16 font-mono"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addCrewMember}
                    disabled={!newRole.trim()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {form.crewTemplate.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.crewTemplate.map((m) => (
                      <Badge
                        key={m.role}
                        variant="secondary"
                        className="gap-1 text-xs"
                      >
                        {m.count}x {m.role}
                        <button
                          onClick={() => removeCrewMember(m.role)}
                          className="ml-0.5 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-foreground self-center ml-1">
                      {totalCrewSize} workers
                    </span>
                  </div>
                )}
              </div>

              {qty > 0 && hours > 0 && (
                <p className="text-xs text-muted-foreground">
                  Production rate:{" "}
                  <span className="font-mono font-medium">
                    {(hours / qty).toFixed(4)}
                  </span>{" "}
                  MH/{form.uom || "unit"}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Step 4: COST */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-mono">
                4
              </Badge>
              <span className="text-sm font-semibold">
                Unit cost (optional)
              </span>
            </div>
            <div className="pl-7 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Blended Unit Cost</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={form.unitCost}
                      onChange={(e) => update("unitCost", e.target.value)}
                      className="pl-8 font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-end pb-2">
                  {totalBudget > 0 && (
                    <div className="bg-muted/50 rounded-md px-3 py-2 w-full">
                      <p className="text-xs text-muted-foreground">
                        Derived Budget
                      </p>
                      <p className="text-sm font-bold font-mono">
                        $
                        {totalBudget.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!isValid}
            className={isValid ? "bg-figma-orange hover:bg-figma-orange-hover text-white" : ""}
          >
            <Plus className="h-4 w-4 mr-1" />
            Create &amp; Add Code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
