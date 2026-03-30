import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type Employee,
  type Entry,
  EntryType,
  type Holiday,
  type Project,
  type backendInterface,
} from "../backend";
import {
  MONTHS_SHORT,
  getISOWeeksInYear,
  getWeeksGroupedByMonth,
} from "../utils/dateUtils";
import EmployeeDetailModal from "./EmployeeDetailModal";
import EntryModal from "./EntryModal";

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  [EntryType.feiertag]: "Feiertag",
  [EntryType.ferien]: "Ferien",
  [EntryType.absenz]: "Absenz",
  [EntryType.projekteinsatz]: "Projekteinsatz",
};

const ENTRY_CHIP: Record<EntryType, string> = {
  [EntryType.feiertag]: "bg-red-100 text-red-700 border-red-200",
  [EntryType.ferien]: "bg-green-100 text-green-700 border-green-200",
  [EntryType.absenz]: "bg-amber-100 text-amber-700 border-amber-200",
  [EntryType.projekteinsatz]: "bg-blue-100 text-blue-700 border-blue-200",
};

const ENTRY_SHORT: Record<EntryType, string> = {
  [EntryType.feiertag]: "FT",
  [EntryType.ferien]: "FE",
  [EntryType.absenz]: "AB",
  [EntryType.projekteinsatz]: "PE",
};

const YEARS = [2024, 2025, 2026];
const DAYS_OPTIONS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

interface Filters {
  employeeId: string;
  projectId: string;
  entryType: string;
  search: string;
}

interface KalenderViewProps {
  employees: Employee[];
  projects: Project[];
  entries: Entry[];
  holidays: Holiday[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  actor: backendInterface;
  onRefresh: () => void;
}

interface MultiSelectState {
  employeeId: bigint;
  weeks: Set<number>;
}

interface MultiWeekForm {
  entryType: EntryType;
  days: number;
  projectId: string;
  notes: string;
}

export default function KalenderView({
  employees,
  projects,
  entries,
  holidays,
  selectedYear,
  onYearChange,
  actor,
  onRefresh,
}: KalenderViewProps) {
  const [filters, setFilters] = useState<Filters>({
    employeeId: "",
    projectId: "",
    entryType: "",
    search: "",
  });
  const [selectedCell, setSelectedCell] = useState<{
    employee: Employee;
    kw: number;
  } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [multiSelect, setMultiSelect] = useState<MultiSelectState | null>(null);
  const [multiWeekDialogOpen, setMultiWeekDialogOpen] = useState(false);
  const [multiWeekForm, setMultiWeekForm] = useState<MultiWeekForm>({
    entryType: EntryType.projekteinsatz,
    days: 1.0,
    projectId: "",
    notes: "",
  });
  const [isSavingMulti, setIsSavingMulti] = useState(false);

  // Drag state stored in ref to avoid re-renders during drag
  const dragState = useRef<{ employeeId: bigint; startKw: number } | null>(
    null,
  );

  const numWeeks = useMemo(
    () => getISOWeeksInYear(selectedYear),
    [selectedYear],
  );
  const allWeeks = useMemo(
    () => Array.from({ length: numWeeks }, (_, i) => i + 1),
    [numWeeks],
  );
  const weekGroups = useMemo(
    () => getWeeksGroupedByMonth(selectedYear),
    [selectedYear],
  );

  // Build lookup map for entries
  const entriesByKey = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of entries) {
      const key = `${entry.employeeId}-${Number(entry.kw)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return map;
  }, [entries]);

  // Build lookup for holidays by kw
  const holidaysByKw = useMemo(() => {
    const map = new Map<number, Holiday[]>();
    for (const h of holidays) {
      const kw = Number(h.kw);
      if (!map.has(kw)) map.set(kw, []);
      map.get(kw)!.push(h);
    }
    return map;
  }, [holidays]);

  const filteredEmployees = useMemo(() => {
    let result = employees.filter((e) => e.isActive);
    if (filters.employeeId) {
      result = result.filter((e) => e.id.toString() === filters.employeeId);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((emp) => {
        if (emp.name.toLowerCase().includes(s)) return true;
        for (let kw = 1; kw <= numWeeks; kw++) {
          const cellEntries = entriesByKey.get(`${emp.id}-${kw}`) ?? [];
          for (const e of cellEntries) {
            if (e.notes.toLowerCase().includes(s)) return true;
            const proj = projects.find((p) => p.id === e.projectId);
            if (proj?.name.toLowerCase().includes(s)) return true;
          }
        }
        return false;
      });
    }
    return result;
  }, [employees, filters, entriesByKey, projects, numWeeks]);

  const getCellEntries = (employeeId: bigint, kw: number): Entry[] => {
    let result = entriesByKey.get(`${employeeId}-${kw}`) ?? [];
    if (filters.entryType) {
      result = result.filter(
        (e) => e.entryType === (filters.entryType as EntryType),
      );
    }
    if (filters.projectId) {
      result = result.filter(
        (e) => e.projectId?.toString() === filters.projectId,
      );
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((e) => {
        if (e.notes.toLowerCase().includes(s)) return true;
        const proj = projects.find((p) => p.id === e.projectId);
        return proj?.name.toLowerCase().includes(s) ?? false;
      });
    }
    return result;
  };

  const resetFilters = () =>
    setFilters({ employeeId: "", projectId: "", entryType: "", search: "" });

  const hasFilters =
    filters.employeeId ||
    filters.projectId ||
    filters.entryType ||
    filters.search;

  const selectedCellEntries = selectedCell
    ? getCellEntries(selectedCell.employee.id, selectedCell.kw)
    : [];

  const activeProjects = projects.filter((p) => p.isActive);

  const clearMultiSelect = () => setMultiSelect(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dragState.current = null;
        setMultiSelect(null);
      }
    };
    const onMouseUp = () => {
      // Global mouseup: end drag without opening dialog (mouse released outside cells)
      dragState.current = null;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const handleCellMouseDown = (
    emp: Employee,
    kw: number,
    e: React.MouseEvent,
  ) => {
    // Only respond to left mouse button
    if (e.button !== 0) return;
    e.preventDefault(); // prevent text selection during drag
    dragState.current = { employeeId: emp.id, startKw: kw };
    setMultiSelect({ employeeId: emp.id, weeks: new Set([kw]) });
  };

  const handleCellMouseEnter = (emp: Employee, kw: number) => {
    const ds = dragState.current;
    if (!ds || ds.employeeId !== emp.id) return;
    const minKw = Math.min(ds.startKw, kw);
    const maxKw = Math.max(ds.startKw, kw);
    const weeks = new Set<number>();
    for (let w = minKw; w <= maxKw; w++) weeks.add(w);
    setMultiSelect({ employeeId: emp.id, weeks });
  };

  const handleCellMouseUp = (emp: Employee, kw: number) => {
    const ds = dragState.current;
    if (!ds) return;
    dragState.current = null;

    setMultiSelect((prev) => {
      if (!prev) return null;
      if (prev.weeks.size <= 1) {
        // Single cell: open entry dialog
        setTimeout(() => {
          setMultiSelect(null);
          setSelectedCell({ employee: emp, kw });
        }, 0);
        return null;
      }
      // Multiple cells: keep selection and open multi-week dialog
      setTimeout(() => openMultiWeekDialog(), 0);
      return prev;
    });
  };

  const multiSelectEmployee = multiSelect
    ? employees.find((e) => e.id === multiSelect.employeeId)
    : null;
  const multiSelectWeeks = multiSelect
    ? Array.from(multiSelect.weeks).sort((a, b) => a - b)
    : [];

  const openMultiWeekDialog = () => {
    setMultiWeekForm({
      entryType: EntryType.projekteinsatz,
      days: 1.0,
      projectId: "",
      notes: "",
    });
    setMultiWeekDialogOpen(true);
  };

  const saveMultiWeekEntries = async () => {
    if (!multiSelect || !multiSelectEmployee) return;
    if (
      multiWeekForm.entryType === EntryType.projekteinsatz &&
      !multiWeekForm.projectId
    ) {
      toast.error("Bitte Projekt auswählen");
      return;
    }
    setIsSavingMulti(true);
    try {
      await Promise.all(
        multiSelectWeeks.map((kw) =>
          actor.upsertEntry(0n, {
            employeeId: multiSelect.employeeId,
            entryType: multiWeekForm.entryType,
            kw: BigInt(kw),
            year: BigInt(selectedYear),
            projectId:
              multiWeekForm.entryType === EntryType.projekteinsatz &&
              multiWeekForm.projectId
                ? BigInt(multiWeekForm.projectId)
                : undefined,
            notes: multiWeekForm.notes,
            days: multiWeekForm.days,
          }),
        ),
      );
      toast.success(
        `${multiSelectWeeks.length} Einträge für ${multiSelectEmployee.name} gespeichert`,
      );
      setMultiWeekDialogOpen(false);
      clearMultiSelect();
      onRefresh();
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSavingMulti(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Filter Bar */}
      <div
        className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center gap-2 no-print"
        data-ocid="kalender.panel"
      >
        {/* Year */}
        <Select
          value={selectedYear.toString()}
          onValueChange={(v) => onYearChange(Number(v))}
        >
          <SelectTrigger
            className="h-8 w-24 text-xs"
            data-ocid="kalender.select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Employee filter */}
        <Select
          value={filters.employeeId || "all"}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, employeeId: v === "all" ? "" : v }))
          }
        >
          <SelectTrigger
            className="h-8 w-40 text-xs"
            data-ocid="kalender.select"
          >
            <SelectValue placeholder="Alle Mitarbeitenden" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Mitarbeitenden</SelectItem>
            {employees
              .filter((e) => e.isActive)
              .map((e) => (
                <SelectItem key={e.id.toString()} value={e.id.toString()}>
                  {e.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {/* Project filter */}
        <Select
          value={filters.projectId || "all"}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, projectId: v === "all" ? "" : v }))
          }
        >
          <SelectTrigger
            className="h-8 w-40 text-xs"
            data-ocid="kalender.select"
          >
            <SelectValue placeholder="Alle Projekte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Projekte</SelectItem>
            {activeProjects.map((p) => (
              <SelectItem key={p.id.toString()} value={p.id.toString()}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Entry type filter */}
        <Select
          value={filters.entryType || "all"}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, entryType: v === "all" ? "" : v }))
          }
        >
          <SelectTrigger
            className="h-8 w-36 text-xs"
            data-ocid="kalender.select"
          >
            <SelectValue placeholder="Alle Typen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {Object.values(EntryType).map((t) => (
              <SelectItem key={t} value={t}>
                {ENTRY_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <Input
          placeholder="Suchen…"
          value={filters.search}
          onChange={(e) =>
            setFilters((f) => ({ ...f, search: e.target.value }))
          }
          className="h-8 w-44 text-xs"
          data-ocid="kalender.search_input"
        />

        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8 text-xs text-slate-500"
            data-ocid="kalender.button"
          >
            Filter zurücksetzen
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
          {[
            EntryType.feiertag,
            EntryType.ferien,
            EntryType.absenz,
            EntryType.projekteinsatz,
          ].map((t) => (
            <span
              key={t}
              className={`px-2 py-0.5 rounded border ${ENTRY_CHIP[t]}`}
            >
              {ENTRY_TYPE_LABELS[t]}
            </span>
          ))}
          <span className="text-slate-300">
            | Klicken und ziehen für Mehrfach-Auswahl
          </span>
        </div>
      </div>

      {/* Grid */}
      <div
        className="flex-1 overflow-auto grid-scroll"
        style={{ maxHeight: "calc(100vh - 138px)", userSelect: "none" }}
      >
        <table
          className="border-separate text-xs"
          style={{ borderSpacing: 0, minWidth: "max-content" }}
        >
          <thead>
            {/* Month header row */}
            <tr>
              <th
                className="bg-slate-800 text-white text-left text-xs font-semibold px-3"
                style={{
                  position: "sticky",
                  top: 0,
                  left: 0,
                  zIndex: 40,
                  minWidth: 160,
                  height: 32,
                  borderRight: "1px solid #334155",
                  borderBottom: "1px solid #334155",
                }}
              >
                Mitarbeitende / KW
              </th>
              {weekGroups.map(({ month, weeks }) => (
                <th
                  key={month}
                  colSpan={weeks.length}
                  className="bg-slate-700 text-slate-100 text-xs font-semibold text-center"
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 30,
                    height: 32,
                    borderRight: "1px solid #475569",
                    borderBottom: "1px solid #475569",
                    padding: "0 4px",
                  }}
                >
                  {MONTHS_SHORT[month]}
                </th>
              ))}
            </tr>

            {/* KW header row */}
            <tr>
              <th
                className="bg-slate-100 text-slate-600 text-left text-xs font-medium px-3"
                style={{
                  position: "sticky",
                  top: 32,
                  left: 0,
                  zIndex: 40,
                  height: 30,
                  borderRight: "1px solid #e2e8f0",
                  borderBottom: "2px solid #cbd5e1",
                  background: "#f1f5f9",
                }}
              >
                {filteredEmployees.length} Mitarbeitende
              </th>
              {allWeeks.map((kw) => {
                const kwHolidays = holidaysByKw.get(kw);
                return (
                  <th
                    key={kw}
                    className="text-slate-500 font-medium text-center"
                    title={kwHolidays?.map((h) => h.name).join(", ")}
                    style={{
                      position: "sticky",
                      top: 32,
                      zIndex: 20,
                      height: 30,
                      minWidth: 58,
                      width: 58,
                      background: kwHolidays ? "#fef2f2" : "#f8fafc",
                      borderRight: "1px solid #e2e8f0",
                      borderBottom: "2px solid #cbd5e1",
                      padding: "0 2px",
                    }}
                  >
                    <span
                      className={kwHolidays ? "text-red-600 font-semibold" : ""}
                    >
                      {kw}
                    </span>
                    {kwHolidays && (
                      <div className="text-[8px] text-red-500 leading-tight truncate px-0.5">
                        {kwHolidays[0].name.slice(0, 6)}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td
                  colSpan={numWeeks + 1}
                  className="text-center text-slate-400 py-12 text-sm"
                  data-ocid="kalender.empty_state"
                >
                  Keine Mitarbeitenden gefunden
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp, empIdx) => (
                <tr
                  key={emp.id.toString()}
                  data-ocid={`kalender.item.${empIdx + 1}`}
                >
                  {/* Sticky employee name */}
                  <td
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 10,
                      background: empIdx % 2 === 0 ? "#ffffff" : "#f8fafc",
                      borderRight: "2px solid #cbd5e1",
                      borderBottom: "1px solid #e2e8f0",
                      padding: "6px 12px",
                      minWidth: 160,
                    }}
                  >
                    <button
                      type="button"
                      className="font-medium text-slate-800 hover:text-blue-700 text-left text-xs whitespace-nowrap transition-colors"
                      onClick={() => setSelectedEmployee(emp)}
                      data-ocid="kalender.link"
                    >
                      <div>{emp.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {Number(emp.pensum)}%
                      </div>
                    </button>
                  </td>

                  {/* KW cells */}
                  {allWeeks.map((kw) => {
                    const cellEntries = getCellEntries(emp.id, kw);
                    const hasEntries = cellEntries.length > 0;
                    const isSelected =
                      multiSelect?.employeeId === emp.id &&
                      multiSelect.weeks.has(kw);
                    const isMultiSelectMode =
                      multiSelect?.employeeId === emp.id;
                    const kwHolidays = holidaysByKw.get(kw);
                    const baseBackground =
                      empIdx % 2 === 0 ? "#ffffff" : "#f8fafc";
                    return (
                      <td
                        key={kw}
                        style={{
                          background: isSelected
                            ? "#dbeafe"
                            : kwHolidays && !hasEntries
                              ? "#fff5f5"
                              : baseBackground,
                          borderRight: "1px solid #e2e8f0",
                          borderBottom: "1px solid #e2e8f0",
                          padding: 0,
                          verticalAlign: "top",
                          minWidth: 58,
                          width: 58,
                          height: 72,
                          outline: isSelected ? "2px solid #3b82f6" : undefined,
                          outlineOffset: isSelected ? "-2px" : undefined,
                        }}
                        data-ocid="kalender.canvas_target"
                      >
                        <button
                          type="button"
                          className={`w-full h-full p-0.5 text-left transition-colors focus:outline-none focus:ring-1 focus:ring-blue-300 ${
                            isSelected
                              ? "bg-blue-100/60"
                              : isMultiSelectMode
                                ? "hover:bg-blue-50/80"
                                : "hover:bg-blue-50/60"
                          }`}
                          style={{ minHeight: 72, display: "block" }}
                          onMouseDown={(e) => handleCellMouseDown(emp, kw, e)}
                          onMouseEnter={() => handleCellMouseEnter(emp, kw)}
                          onMouseUp={() => handleCellMouseUp(emp, kw)}
                        >
                          {kwHolidays && !hasEntries && (
                            <div className="text-[9px] px-1 py-0.5 rounded border truncate font-medium leading-tight bg-red-100 text-red-700 border-red-200 mb-0.5">
                              {kwHolidays[0].name.slice(0, 8)} FT
                            </div>
                          )}
                          {hasEntries && (
                            <div className="space-y-0.5">
                              {cellEntries.slice(0, 3).map((entry) => {
                                const proj = projects.find(
                                  (p) => p.id === entry.projectId,
                                );
                                const label =
                                  entry.entryType === EntryType.projekteinsatz
                                    ? `${proj?.name?.slice(0, 6) ?? "PE"} ${entry.days}T`
                                    : `${ENTRY_SHORT[entry.entryType]} ${entry.days}T`;
                                return (
                                  <div
                                    key={entry.id.toString()}
                                    className={`text-[9px] px-1 py-0.5 rounded border truncate font-medium leading-tight ${
                                      ENTRY_CHIP[entry.entryType]
                                    }`}
                                    title={`${ENTRY_TYPE_LABELS[entry.entryType]}${
                                      proj ? ` – ${proj.name}` : ""
                                    }: ${entry.days}T`}
                                  >
                                    {label}
                                  </div>
                                );
                              })}
                              {cellEntries.length > 3 && (
                                <div className="text-[9px] text-slate-400 px-1">
                                  +{cellEntries.length - 3}
                                </div>
                              )}
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Multi-select floating action bar */}
      {multiSelect && multiSelectWeeks.length >= 1 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-600"
          data-ocid="kalender.panel"
        >
          <span className="text-sm font-medium">
            {multiSelectWeeks.length} KW
            {multiSelectWeeks.length !== 1 ? "s" : ""} ausgewählt
            {multiSelectEmployee ? ` · ${multiSelectEmployee.name}` : ""}
          </span>
          {multiSelectWeeks.length >= 2 && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={openMultiWeekDialog}
              data-ocid="kalender.primary_button"
            >
              Eintrag erstellen
            </Button>
          )}
          <button
            type="button"
            className="ml-1 text-slate-300 hover:text-white"
            onClick={clearMultiSelect}
            data-ocid="kalender.close_button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Multi-week entry dialog */}
      <Dialog
        open={multiWeekDialogOpen}
        onOpenChange={(open) => !open && setMultiWeekDialogOpen(false)}
      >
        <DialogContent className="max-w-md" data-ocid="kalender.dialog">
          <DialogHeader>
            <DialogTitle className="text-base">
              {multiSelectEmployee?.name} — {multiSelectWeeks.length} Wochen (KW{" "}
              {multiSelectWeeks.join(", ")})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Typ</Label>
              <Select
                value={multiWeekForm.entryType}
                onValueChange={(v) =>
                  setMultiWeekForm((f) => ({
                    ...f,
                    entryType: v as EntryType,
                  }))
                }
              >
                <SelectTrigger className="h-9" data-ocid="kalender.select">
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
              <Label className="text-xs font-medium">
                Tage pro Woche (0.5–5.0)
              </Label>
              <Select
                value={multiWeekForm.days.toString()}
                onValueChange={(v) =>
                  setMultiWeekForm((f) => ({ ...f, days: Number(v) }))
                }
              >
                <SelectTrigger className="h-9" data-ocid="kalender.select">
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

            {multiWeekForm.entryType === EntryType.projekteinsatz && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Projekt</Label>
                <Select
                  value={multiWeekForm.projectId}
                  onValueChange={(v) =>
                    setMultiWeekForm((f) => ({ ...f, projectId: v }))
                  }
                >
                  <SelectTrigger className="h-9" data-ocid="kalender.select">
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
                value={multiWeekForm.notes}
                onChange={(e) =>
                  setMultiWeekForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="h-20 text-sm"
                data-ocid="kalender.textarea"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setMultiWeekDialogOpen(false)}
                data-ocid="kalender.cancel_button"
              >
                Abbrechen
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={saveMultiWeekEntries}
                disabled={isSavingMulti}
                data-ocid="kalender.save_button"
              >
                {isSavingMulti ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : null}
                {multiSelectWeeks.length} Einträge speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Entry Modal */}
      {selectedCell && (
        <EntryModal
          isOpen={!!selectedCell}
          onClose={() => setSelectedCell(null)}
          employee={selectedCell.employee}
          kw={selectedCell.kw}
          year={selectedYear}
          cellEntries={selectedCellEntries}
          projects={projects}
          actor={actor}
          onRefresh={onRefresh}
        />
      )}

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <EmployeeDetailModal
          isOpen={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          employee={selectedEmployee}
          entries={entries}
          projects={projects}
          year={selectedYear}
        />
      )}
    </div>
  );
}
