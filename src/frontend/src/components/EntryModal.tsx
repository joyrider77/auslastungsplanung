import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  type Employee,
  type Entry,
  EntryType,
  type Project,
  type backendInterface,
} from "../backend";

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  [EntryType.feiertag]: "Feiertag",
  [EntryType.ferien]: "Ferien",
  [EntryType.absenz]: "Absenz",
  [EntryType.projekteinsatz]: "Projekteinsatz",
};

const ENTRY_TYPE_BADGE: Record<EntryType, string> = {
  [EntryType.feiertag]: "bg-red-100 text-red-700 border-red-200",
  [EntryType.ferien]: "bg-green-100 text-green-700 border-green-200",
  [EntryType.absenz]: "bg-amber-100 text-amber-700 border-amber-200",
  [EntryType.projekteinsatz]: "bg-blue-100 text-blue-700 border-blue-200",
};

const DAYS_OPTIONS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  kw: number;
  year: number;
  cellEntries: Entry[];
  projects: Project[];
  actor: backendInterface;
  onRefresh: () => void;
}

type FormMode = "list" | "add" | "edit";

interface EntryForm {
  entryType: EntryType;
  days: number;
  projectId: string;
  notes: string;
}

const defaultForm = (): EntryForm => ({
  entryType: EntryType.projekteinsatz,
  days: 1.0,
  projectId: "",
  notes: "",
});

export default function EntryModal({
  isOpen,
  onClose,
  employee,
  kw,
  year,
  cellEntries,
  projects,
  actor,
  onRefresh,
}: EntryModalProps) {
  const [mode, setMode] = useState<FormMode>("list");
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [form, setForm] = useState<EntryForm>(defaultForm());
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<bigint | null>(null);

  const activeProjects = projects.filter((p) => p.isActive);

  const handleClose = () => {
    setMode("list");
    setEditingEntry(null);
    setForm(defaultForm());
    onClose();
  };

  const handleAdd = () => {
    setForm(defaultForm());
    setEditingEntry(null);
    setMode("add");
  };

  const handleEdit = (entry: Entry) => {
    setEditingEntry(entry);
    setForm({
      entryType: entry.entryType,
      days: entry.days,
      projectId: entry.projectId?.toString() ?? "",
      notes: entry.notes,
    });
    setMode("edit");
  };

  const handleDelete = async (entry: Entry) => {
    setIsDeleting(entry.id);
    try {
      await actor.upsertEntry(entry.id, {
        employeeId: entry.employeeId,
        entryType: entry.entryType,
        kw: entry.kw,
        year: entry.year,
        projectId: entry.projectId,
        notes: entry.notes,
        days: 0,
      });
      toast.success("Eintrag gelöscht");
      onRefresh();
    } catch {
      toast.error("Fehler beim Löschen");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSave = async () => {
    if (form.entryType === EntryType.projekteinsatz && !form.projectId) {
      toast.error("Bitte Projekt auswählen");
      return;
    }
    if (form.days < 0.5 || form.days > 5.0) {
      toast.error("Tage müssen zwischen 0.5 und 5.0 liegen");
      return;
    }

    setIsSaving(true);
    try {
      const entryData = {
        employeeId: employee.id,
        entryType: form.entryType,
        kw: BigInt(kw),
        year: BigInt(year),
        projectId:
          form.entryType === EntryType.projekteinsatz && form.projectId
            ? BigInt(form.projectId)
            : undefined,
        notes: form.notes,
        days: form.days,
      };
      await actor.upsertEntry(editingEntry?.id ?? 0n, entryData);
      toast.success(
        mode === "add" ? "Eintrag hinzugefügt" : "Eintrag aktualisiert",
      );
      onRefresh();
      setMode("list");
      setEditingEntry(null);
      setForm(defaultForm());
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setMode("list");
    setEditingEntry(null);
    setForm(defaultForm());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md" data-ocid="entry.dialog">
        <DialogHeader>
          <DialogTitle className="text-base">
            {employee.name} — KW {kw}
          </DialogTitle>
        </DialogHeader>

        {mode === "list" && (
          <div className="space-y-3">
            {cellEntries.length === 0 ? (
              <p
                className="text-sm text-slate-400 text-center py-4"
                data-ocid="entry.empty_state"
              >
                Keine Einträge für diese Woche
              </p>
            ) : (
              <div className="space-y-2" data-ocid="entry.list">
                {cellEntries.map((entry, idx) => {
                  const proj = projects.find((p) => p.id === entry.projectId);
                  return (
                    <div
                      key={entry.id.toString()}
                      className="flex items-center justify-between p-2 rounded border border-slate-100 bg-slate-50"
                      data-ocid={`entry.item.${idx + 1}`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className={`text-xs px-2 py-0.5 rounded border font-medium ${
                            ENTRY_TYPE_BADGE[entry.entryType]
                          }`}
                        >
                          {ENTRY_TYPE_LABELS[entry.entryType]}
                        </span>
                        <span className="text-xs text-slate-600">
                          {entry.days}T
                        </span>
                        {proj && (
                          <span className="text-xs text-slate-500 truncate">
                            {proj.name}
                          </span>
                        )}
                        {entry.notes && (
                          <span className="text-xs text-slate-400 truncate italic">
                            {entry.notes}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => handleEdit(entry)}
                          data-ocid={`entry.edit_button.${idx + 1}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(entry)}
                          disabled={isDeleting === entry.id}
                          data-ocid={`entry.delete_button.${idx + 1}`}
                        >
                          {isDeleting === entry.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Button
              size="sm"
              className="w-full"
              onClick={handleAdd}
              data-ocid="entry.add_button"
            >
              <Plus className="h-4 w-4 mr-1" />
              Neuer Eintrag
            </Button>
          </div>
        )}

        {(mode === "add" || mode === "edit") && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Typ</Label>
              <Select
                value={form.entryType}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, entryType: v as EntryType }))
                }
              >
                <SelectTrigger className="h-9" data-ocid="entry.select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(EntryType).map((t) => (
                    <SelectItem key={t} value={t}>
                      {ENTRY_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tage (0.5–5.0)</Label>
              <Select
                value={form.days.toString()}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, days: Number(v) }))
                }
              >
                <SelectTrigger className="h-9" data-ocid="entry.select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d.toString()}>
                      {d.toFixed(1)} T
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.entryType === EntryType.projekteinsatz && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Projekt</Label>
                <Select
                  value={form.projectId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, projectId: v }))
                  }
                >
                  <SelectTrigger className="h-9" data-ocid="entry.select">
                    <SelectValue placeholder="Projekt auswählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProjects.map((p) => (
                      <SelectItem key={p.id.toString()} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notizen</Label>
              <Textarea
                placeholder="Optionale Notizen…"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="h-20 text-sm"
                data-ocid="entry.textarea"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleCancel}
                data-ocid="entry.cancel_button"
              >
                <X className="h-3 w-3 mr-1" />
                Abbrechen
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleSave}
                disabled={isSaving}
                data-ocid="entry.save_button"
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : null}
                {mode === "add" ? "Hinzufügen" : "Speichern"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
