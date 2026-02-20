"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Search, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useProductionStore, type Assembly } from "@/store/use-production-store";
import { CodeCreatorModal } from "@/components/code-creator-modal";
import { cn } from "@/lib/utils";

interface AddCodesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCodesModal({ open, onOpenChange }: AddCodesModalProps) {
  const { assemblies, provisionalCodes, addProvisionalCode } =
    useProductionStore();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreator, setShowCreator] = useState(false);

  // Assemblies not already in the provisional list
  const available = useMemo(
    () => assemblies.filter((a) => !provisionalCodes.includes(a.wbs_code)),
    [assemblies, provisionalCodes]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return available;
    const q = search.toLowerCase();
    return available.filter(
      (a) =>
        a.description.toLowerCase().includes(q) ||
        a.wbs_code.toLowerCase().includes(q)
    );
  }, [available, search]);

  const allSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.wbs_code));
  const someSelected = filtered.some((a) => selected.has(a.wbs_code));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      filtered.forEach((a) => next.delete(a.wbs_code));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((a) => next.add(a.wbs_code));
      setSelected(next);
    }
  };

  const toggleOne = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setSelected(next);
  };

  const handleAdd = () => {
    const count = selected.size;
    selected.forEach((code) => addProvisionalCode(code));
    setSelected(new Set());
    setSearch("");
    onOpenChange(false);
    toast.success(`${count} code${count !== 1 ? "s" : ""} added`);
  };

  const handleClose = () => {
    setSelected(new Set());
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Production Quantity Codes</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search production quantity codes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Select all + list */}
        <div className="border rounded-lg">
          {/* Select all header */}
          <label className="flex items-center gap-3 px-4 py-2.5 border-b cursor-pointer hover:bg-muted/50 transition-colors">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              onChange={toggleAll}
              className="rounded"
            />
            <span className="text-sm font-medium">Select all</span>
          </label>

          {/* Code list */}
          <div className="max-h-64 overflow-y-auto divide-y">
            {filtered.map((assembly) => (
              <label
                key={assembly.wbs_code}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.has(assembly.wbs_code)}
                  onChange={() => toggleOne(assembly.wbs_code)}
                  className="rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{assembly.description}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {assembly.wbs_code}
                    <span className="ml-2 font-sans">
                      {assembly.budgeted_qty.toLocaleString()} {assembly.uom} &middot; {assembly.budgeted_hours} hrs
                    </span>
                  </p>
                </div>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-6 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {available.length === 0
                    ? "All codes are already added."
                    : "No codes match your search."}
                </p>
                {available.length === 0 && (
                  <Button variant="outline" size="sm" onClick={() => setShowCreator(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Create New Code
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => setShowCreator(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create new
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={selected.size === 0}
              className="bg-figma-orange hover:bg-figma-orange-hover text-white"
            >
              Add
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <CodeCreatorModal open={showCreator} onOpenChange={setShowCreator} />
    </Dialog>
  );
}
