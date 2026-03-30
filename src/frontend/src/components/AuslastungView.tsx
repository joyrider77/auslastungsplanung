import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Printer } from "lucide-react";
import { useMemo } from "react";
import { type Employee, type Entry, EntryType, type Project } from "../backend";

const YEARS = [2024, 2025, 2026];

interface AuslastungViewProps {
  employees: Employee[];
  projects: Project[];
  entries: Entry[];
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export default function AuslastungView({
  employees,
  entries,
  selectedYear,
  onYearChange,
}: AuslastungViewProps) {
  const rows = useMemo(() => {
    return employees
      .filter((e) => e.isActive)
      .map((emp) => {
        const empEntries = entries.filter(
          (e) =>
            e.employeeId === emp.id &&
            Number(e.year) === selectedYear &&
            e.days > 0,
        );

        const feiertag = empEntries
          .filter((e) => e.entryType === EntryType.feiertag)
          .reduce((s, e) => s + e.days, 0);
        const ferien = empEntries
          .filter((e) => e.entryType === EntryType.ferien)
          .reduce((s, e) => s + e.days, 0);
        const absenz = empEntries
          .filter((e) => e.entryType === EntryType.absenz)
          .reduce((s, e) => s + e.days, 0);
        const projekt = empEntries
          .filter((e) => e.entryType === EntryType.projekteinsatz)
          .reduce((s, e) => s + e.days, 0);

        const anzahl = feiertag + ferien + absenz + projekt;
        const pensum = Number(emp.pensum);
        const maxTage = Math.round((52 * 5 * pensum) / 100);
        const auslastung =
          maxTage > 0 ? Math.round((anzahl / maxTage) * 100) : 0;

        return {
          emp,
          pensum,
          maxTage,
          feiertag,
          ferien,
          absenz,
          projekt,
          anzahl,
          auslastung,
        };
      })
      .sort((a, b) => b.auslastung - a.auslastung);
  }, [employees, entries, selectedYear]);

  const auslastungColor = (pct: number) =>
    pct < 70
      ? "text-slate-400"
      : pct <= 90
        ? "text-green-600"
        : pct <= 100
          ? "text-blue-600"
          : "text-red-600";

  const auslastungBg = (pct: number) =>
    pct < 70
      ? "bg-slate-100 text-slate-500"
      : pct <= 90
        ? "bg-green-100 text-green-700"
        : pct <= 100
          ? "bg-blue-100 text-blue-700"
          : "bg-red-100 text-red-700";

  const totalAnzahl = rows.reduce((s, r) => s + r.anzahl, 0);
  const totalMax = rows.reduce((s, r) => s + r.maxTage, 0);
  const totalAuslastung =
    totalMax > 0 ? Math.round((totalAnzahl / totalMax) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3 no-print"
        data-ocid="auslastung.panel"
      >
        <span className="text-sm font-semibold text-slate-700">
          Auslastung {selectedYear}
        </span>
        <Select
          value={selectedYear.toString()}
          onValueChange={(v) => onYearChange(Number(v))}
        >
          <SelectTrigger
            className="h-8 w-24 text-xs"
            data-ocid="auslastung.select"
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
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs ml-auto"
          onClick={() => window.print()}
          data-ocid="auslastung.button"
        >
          <Printer className="h-3.5 w-3.5 mr-1.5" />
          Drucken
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4" data-ocid="auslastung.table">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold text-slate-700">
                  Mitarbeitende
                </TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">
                  Pensum %
                </TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">
                  Max. Tage
                </TableHead>
                <TableHead className="font-semibold text-red-600 text-right">
                  Feiertag
                </TableHead>
                <TableHead className="font-semibold text-green-600 text-right">
                  Ferien
                </TableHead>
                <TableHead className="font-semibold text-amber-600 text-right">
                  Absenz
                </TableHead>
                <TableHead className="font-semibold text-blue-600 text-right">
                  Projekt
                </TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">
                  Anzahl Tage
                </TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">
                  Auslastung %
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-slate-400 py-10"
                    data-ocid="auslastung.empty_state"
                  >
                    Keine Daten verfügbar
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, idx) => (
                  <TableRow
                    key={row.emp.id.toString()}
                    data-ocid={`auslastung.item.${idx + 1}`}
                  >
                    <TableCell className="font-medium text-slate-800">
                      {row.emp.name}
                    </TableCell>
                    <TableCell className="text-right text-slate-600">
                      {row.pensum}%
                    </TableCell>
                    <TableCell className="text-right text-slate-600">
                      {row.maxTage}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.feiertag > 0 ? (
                        <span className="text-red-600 font-medium">
                          {row.feiertag}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.ferien > 0 ? (
                        <span className="text-green-600 font-medium">
                          {row.ferien}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.absenz > 0 ? (
                        <span className="text-amber-600 font-medium">
                          {row.absenz}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.projekt > 0 ? (
                        <span className="text-blue-600 font-medium">
                          {row.projekt}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-800">
                      {row.anzahl}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${auslastungBg(row.auslastung)}`}
                      >
                        {row.auslastung}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Totals row */}
          {rows.length > 0 && (
            <div className="border-t-2 border-slate-200 bg-slate-50 px-4 py-2 flex items-center gap-6 text-sm">
              <span className="font-semibold text-slate-700">Gesamt</span>
              <span className="text-slate-600">
                Max: <span className="font-medium">{totalMax}</span>
              </span>
              <span className="text-slate-600">
                Anzahl: <span className="font-medium">{totalAnzahl}</span>
              </span>
              <span className="text-slate-600">
                Auslastung:{" "}
                <span
                  className={`font-bold ${auslastungColor(totalAuslastung)}`}
                >
                  {totalAuslastung}%
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500 no-print">
          <span className="font-medium text-slate-600">Auslastung:</span>
          <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
            {"< 70%"} — Unterausgelastet
          </span>
          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
            70–90% — Optimal
          </span>
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
            90–100% — Vollausgelastet
          </span>
          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">
            {">100%"} — Überlastet
          </span>
        </div>
      </div>
    </div>
  );
}
