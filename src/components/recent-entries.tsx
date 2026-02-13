"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Pencil, Trash2, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProductionStore, type ProductionEvent } from "@/store/use-production-store";
import { cn } from "@/lib/utils";

interface RecentEntriesProps {
  /** Date to filter entries (YYYY-MM-DD) */
  date: string;
  /** Optional WBS code filter — if set, only show entries for this code */
  wbsCode?: string;
}

export function RecentEntries({ date, wbsCode }: RecentEntriesProps) {
  const { productionEvents, assemblies, updateProductionEvent, deleteProductionEvent } =
    useProductionStore();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    actual_hours: string;
    actual_qty: string;
    equipment_hours: string;
  }>({ actual_hours: "", actual_qty: "", equipment_hours: "" });

  const entries = productionEvents.filter(
    (e) =>
      e.date === date &&
      (!wbsCode || e.wbs_code === wbsCode)
  );

  if (entries.length === 0) return null;

  const startEdit = (event: ProductionEvent) => {
    setEditingId(event.id);
    setEditDraft({
      actual_hours: event.actual_hours.toString(),
      actual_qty: event.actual_qty.toString(),
      equipment_hours: event.equipment_hours.toString(),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    updateProductionEvent(id, {
      actual_hours: parseFloat(editDraft.actual_hours) || 0,
      actual_qty: parseFloat(editDraft.actual_qty) || 0,
      equipment_hours: parseFloat(editDraft.equipment_hours) || 0,
    });
    setEditingId(null);
    toast.success("Entry updated");
  };

  const handleDelete = (id: string) => {
    const confirmed = window.confirm("Delete this production entry? This cannot be undone.");
    if (!confirmed) return;
    deleteProductionEvent(id);
    toast.success("Entry deleted");
  };

  const getDescription = (wbs: string) =>
    assemblies.find((a) => a.wbs_code === wbs)?.description ?? wbs;

  return (
    <div className="border rounded-md bg-muted/5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="font-semibold uppercase tracking-wider">
          Recent Entries
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {entries.length}
        </Badge>
      </button>

      {isOpen && (
        <div className="border-t">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/20">
                {!wbsCode && <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Code</th>}
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Hours</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Equip</th>
                <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">Source</th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Note</th>
                <th className="px-2 py-1.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isEditing = editingId === entry.id;

                return (
                  <tr key={entry.id} className="border-t">
                    {!wbsCode && (
                      <td className="px-2 py-1.5">
                        <span className="font-medium">{getDescription(entry.wbs_code)}</span>
                      </td>
                    )}
                    <td className="px-2 py-1.5 text-right font-mono">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editDraft.actual_hours}
                          onChange={(e) => setEditDraft((d) => ({ ...d, actual_hours: e.target.value }))}
                          className="h-6 w-16 text-right text-xs font-mono"
                        />
                      ) : (
                        entry.actual_hours.toFixed(1)
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editDraft.actual_qty}
                          onChange={(e) => setEditDraft((d) => ({ ...d, actual_qty: e.target.value }))}
                          className="h-6 w-16 text-right text-xs font-mono"
                        />
                      ) : (
                        entry.actual_qty
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editDraft.equipment_hours}
                          onChange={(e) => setEditDraft((d) => ({ ...d, equipment_hours: e.target.value }))}
                          className="h-6 w-16 text-right text-xs font-mono"
                        />
                      ) : (
                        entry.equipment_hours > 0 ? entry.equipment_hours.toFixed(1) : "—"
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <Badge variant="outline" className="text-[9px]">{entry.source}</Badge>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground max-w-[150px] truncate">
                      {entry.description || "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-green-600"
                              onClick={() => saveEdit(entry.id)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={cancelEdit}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => startEdit(entry)}
                              title="Edit entry"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-500 hover:text-red-700"
                              onClick={() => handleDelete(entry.id)}
                              title="Delete entry"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
