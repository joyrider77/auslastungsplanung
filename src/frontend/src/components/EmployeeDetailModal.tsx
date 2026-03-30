import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Employee, type Entry, EntryType, type Project } from "../backend";

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

interface EmployeeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  entries: Entry[];
  projects: Project[];
  year: number;
}

export default function EmployeeDetailModal({
  isOpen,
  onClose,
  employee,
  entries,
  projects,
  year,
}: EmployeeDetailModalProps) {
  const yearEntries = entries
    .filter(
      (e) =>
        e.employeeId === employee.id && Number(e.year) === year && e.days > 0,
    )
    .sort((a, b) => Number(a.kw) - Number(b.kw));

  const daysByType: Record<EntryType, number> = {
    [EntryType.feiertag]: 0,
    [EntryType.ferien]: 0,
    [EntryType.absenz]: 0,
    [EntryType.projekteinsatz]: 0,
  };
  for (const e of yearEntries) {
    daysByType[e.entryType] += e.days;
  }

  const totalDays = Object.values(daysByType).reduce((a, b) => a + b, 0);
  const maxTage = Math.round((52 * 5 * Number(employee.pensum)) / 100);
  const auslastung = maxTage > 0 ? Math.round((totalDays / maxTage) * 100) : 0;

  const auslastungColor =
    auslastung < 70
      ? "text-slate-400"
      : auslastung <= 90
        ? "text-green-600"
        : auslastung <= 100
          ? "text-blue-600"
          : "text-red-600";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] flex flex-col"
        data-ocid="employee.dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-base">
            {employee.name}
            <span className="ml-2 text-sm text-slate-500 font-normal">
              Pensum: {Number(employee.pensum)}%
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-slate-100">
          {(Object.values(EntryType) as EntryType[]).map((t) => (
            <div key={t} className="text-center">
              <div
                className={`text-xs px-2 py-0.5 rounded border inline-block mb-1 font-medium ${
                  ENTRY_TYPE_BADGE[t]
                }`}
              >
                {ENTRY_TYPE_LABELS[t]}
              </div>
              <div className="text-lg font-semibold text-slate-800">
                {daysByType[t]}T
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-6 py-2 text-sm">
          <span className="text-slate-500">
            Max. Tage:{" "}
            <span className="font-medium text-slate-700">{maxTage}</span>
          </span>
          <span className="text-slate-500">
            Anzahl Tage:{" "}
            <span className="font-medium text-slate-700">{totalDays}</span>
          </span>
          <span className="text-slate-500">
            Auslastung:{" "}
            <span className={`font-bold text-base ${auslastungColor}`}>
              {auslastung}%
            </span>
          </span>
        </div>

        {/* Entry Table */}
        <div className="flex-1 overflow-auto">
          {yearEntries.length === 0 ? (
            <p
              className="text-sm text-slate-400 text-center py-8"
              data-ocid="employee.empty_state"
            >
              Keine Einträge für {year}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">KW</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead className="w-16">Tage</TableHead>
                  <TableHead>Projekt</TableHead>
                  <TableHead>Notizen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearEntries.map((entry, idx) => {
                  const proj = projects.find((p) => p.id === entry.projectId);
                  return (
                    <TableRow
                      key={entry.id.toString()}
                      data-ocid={`employee.item.${idx + 1}`}
                    >
                      <TableCell className="font-medium text-slate-600">
                        KW {Number(entry.kw)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-0.5 rounded border font-medium ${
                            ENTRY_TYPE_BADGE[entry.entryType]
                          }`}
                        >
                          {ENTRY_TYPE_LABELS[entry.entryType]}
                        </span>
                      </TableCell>
                      <TableCell>{entry.days}</TableCell>
                      <TableCell className="text-slate-600">
                        {proj?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {entry.notes || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
