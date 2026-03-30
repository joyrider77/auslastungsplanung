import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Principal } from "@icp-sdk/core/principal";
import {
  CalendarCheck,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Employee, Holiday, Project, backendInterface } from "../backend";
import { getISOWeekMonday, getISOWeekOfDate } from "../utils/dateUtils";

const YEARS = [2024, 2025, 2026, 2027];

interface AdminViewProps {
  employees: Employee[];
  projects: Project[];
  selectedYear: number;
  actor: backendInterface;
  onRefresh: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Parse "TT.MM.JJJJ" to a Date object, or null on failure. */
function parseDateDE(s: string): Date | null {
  const parts = s.trim().split(".");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy || yyyy < 1900 || yyyy > 2100) return null;
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getMonth() !== mm - 1) return null;
  return d;
}

/** Format a Date to "TT.MM.JJJJ". */
function formatDateDE(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Get a representative date string for a stored kw/year holiday. */
function holidayDisplayDate(kw: bigint, year: bigint): string {
  try {
    const monday = getISOWeekMonday(Number(year), Number(kw));
    return formatDateDE(monday);
  } catch {
    return `KW ${Number(kw)}`;
  }
}

// ── Holiday section ──────────────────────────────────────────────
interface HolidayDialogState {
  open: boolean;
  editing: Holiday | null;
  name: string;
  date: string;
}

// ── Employee section ─────────────────────────────────────────────
interface EmployeeDialogState {
  open: boolean;
  editing: Employee | null;
  name: string;
  pensum: string;
  isActive: boolean;
}

// ── Project section ──────────────────────────────────────────────
interface ProjectDialogState {
  open: boolean;
  editing: Project | null;
  name: string;
  color: string;
  isActive: boolean;
}

export default function AdminView({
  employees,
  projects,
  selectedYear,
  actor,
  onRefresh,
}: AdminViewProps) {
  const [adminYear, setAdminYear] = useState(selectedYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [applyingHolidays, setApplyingHolidays] = useState(false);

  // Admin users state
  const [isAdmin, setIsAdmin] = useState(false);
  const [trustedPrincipals, setTrustedPrincipals] = useState<Principal[]>([]);
  const [loadingTrusted, setLoadingTrusted] = useState(false);
  const [addPrincipalOpen, setAddPrincipalOpen] = useState(false);
  const [principalInput, setPrincipalInput] = useState("");
  const [savingPrincipal, setSavingPrincipal] = useState(false);
  const [removingPrincipal, setRemovingPrincipal] = useState<string | null>(
    null,
  );

  // Holiday dialog
  const [hDlg, setHDlg] = useState<HolidayDialogState>({
    open: false,
    editing: null,
    name: "",
    date: "",
  });
  const [hSaving, setHSaving] = useState(false);

  // Employee dialog
  const [eDlg, setEDlg] = useState<EmployeeDialogState>({
    open: false,
    editing: null,
    name: "",
    pensum: "100",
    isActive: true,
  });
  const [eSaving, setESaving] = useState(false);

  // Project dialog
  const [pDlg, setPDlg] = useState<ProjectDialogState>({
    open: false,
    editing: null,
    name: "",
    color: "#3b82f6",
    isActive: true,
  });
  const [pSaving, setPSaving] = useState(false);

  const loadHolidays = useCallback(
    async (year: number) => {
      setLoadingHolidays(true);
      try {
        const h = await actor.getHolidaysForYear(BigInt(year));
        setHolidays(h);
      } finally {
        setLoadingHolidays(false);
      }
    },
    [actor],
  );

  const loadTrustedPrincipals = useCallback(async () => {
    setLoadingTrusted(true);
    try {
      const principals = await actor.getTrustedAdminPrincipals();
      setTrustedPrincipals(principals);
    } catch {
      // ignore
    } finally {
      setLoadingTrusted(false);
    }
  }, [actor]);

  useEffect(() => {
    loadHolidays(adminYear);
  }, [adminYear, loadHolidays]);

  useEffect(() => {
    actor
      .isCallerAdmin()
      .then((a) => {
        setIsAdmin(a);
        if (a) loadTrustedPrincipals();
      })
      .catch(() => {});
  }, [actor, loadTrustedPrincipals]);

  // ── Holiday CRUD ────────────────────────────────────────────────
  const openHolidayAdd = () =>
    setHDlg({
      open: true,
      editing: null,
      name: "",
      date: `01.01.${adminYear}`,
    });

  const openHolidayEdit = (h: Holiday) =>
    setHDlg({
      open: true,
      editing: h,
      name: h.name,
      date: holidayDisplayDate(h.kw, h.year),
    });

  const saveHoliday = async () => {
    if (!hDlg.name.trim()) {
      toast.error("Name erforderlich");
      return;
    }
    const parsed = parseDateDE(hDlg.date);
    if (!parsed) {
      toast.error("Datum muss im Format TT.MM.JJJJ sein (z.B. 01.01.2026)");
      return;
    }
    const kw = getISOWeekOfDate(parsed);
    const year = parsed.getFullYear();
    setHSaving(true);
    try {
      await actor.createOrUpdateHoliday(
        hDlg.editing?.id ?? 0n,
        hDlg.name.trim(),
        BigInt(kw),
        BigInt(year),
      );
      try {
        await actor.applyHolidaysToAllEmployees(BigInt(year));
      } catch {
        // ignore if not admin
      }
      toast.success(
        "Feiertag gespeichert und auf alle Mitarbeitenden angewendet",
      );
      setHDlg((d) => ({ ...d, open: false }));
      loadHolidays(adminYear);
      onRefresh();
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setHSaving(false);
    }
  };

  const deleteHoliday = (h: Holiday) => {
    setHolidays((prev) => prev.filter((x) => x.id !== h.id));
    toast.success("Feiertag entfernt");
  };

  const applyHolidays = async () => {
    setApplyingHolidays(true);
    try {
      await actor.applyHolidaysToAllEmployees(BigInt(adminYear));
      toast.success(
        `Feiertage ${adminYear} auf alle Mitarbeitenden angewendet`,
      );
      onRefresh();
    } catch {
      toast.error("Fehler beim Anwenden der Feiertage");
    } finally {
      setApplyingHolidays(false);
    }
  };

  // ── Employee CRUD ───────────────────────────────────────────────
  const openEmployeeAdd = () =>
    setEDlg({
      open: true,
      editing: null,
      name: "",
      pensum: "100",
      isActive: true,
    });

  const openEmployeeEdit = (e: Employee) =>
    setEDlg({
      open: true,
      editing: e,
      name: e.name,
      pensum: Number(e.pensum).toString(),
      isActive: e.isActive,
    });

  const saveEmployee = async () => {
    if (!eDlg.name.trim()) {
      toast.error("Name erforderlich");
      return;
    }
    const pensum = Number(eDlg.pensum);
    if (!pensum || pensum < 10 || pensum > 100) {
      toast.error("Pensum muss zwischen 10 und 100 liegen");
      return;
    }
    setESaving(true);
    try {
      await actor.createOrUpdateEmployee(
        eDlg.editing?.id ?? 0n,
        eDlg.name.trim(),
        BigInt(pensum),
        eDlg.isActive,
      );
      toast.success(
        eDlg.editing
          ? "Mitarbeitende/r aktualisiert"
          : "Mitarbeitende/r hinzugefügt",
      );
      setEDlg((d) => ({ ...d, open: false }));
      onRefresh();
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setESaving(false);
    }
  };

  const deactivateEmployee = async (emp: Employee) => {
    try {
      await actor.createOrUpdateEmployee(emp.id, emp.name, emp.pensum, false);
      toast.success(`${emp.name} deaktiviert`);
      onRefresh();
    } catch {
      toast.error("Fehler");
    }
  };

  // ── Project CRUD ────────────────────────────────────────────────
  const openProjectAdd = () =>
    setPDlg({
      open: true,
      editing: null,
      name: "",
      color: "#3b82f6",
      isActive: true,
    });

  const openProjectEdit = (p: Project) =>
    setPDlg({
      open: true,
      editing: p,
      name: p.name,
      color: p.color,
      isActive: p.isActive,
    });

  const saveProject = async () => {
    if (!pDlg.name.trim()) {
      toast.error("Name erforderlich");
      return;
    }
    setPSaving(true);
    try {
      await actor.upsertProject(pDlg.editing?.id ?? 0n, {
        name: pDlg.name.trim(),
        color: pDlg.color,
        isActive: pDlg.isActive,
      });
      toast.success(
        pDlg.editing ? "Projekt aktualisiert" : "Projekt hinzugefügt",
      );
      setPDlg((d) => ({ ...d, open: false }));
      onRefresh();
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setPSaving(false);
    }
  };

  const deactivateProject = async (p: Project) => {
    try {
      await actor.upsertProject(p.id, {
        name: p.name,
        color: p.color,
        isActive: false,
      });
      toast.success(`${p.name} deaktiviert`);
      onRefresh();
    } catch {
      toast.error("Fehler");
    }
  };

  // ── Trusted Admin CRUD ──────────────────────────────────────────
  const addTrustedPrincipal = async () => {
    if (!principalInput.trim()) {
      toast.error("Principal ID erforderlich");
      return;
    }
    let principal: Principal;
    try {
      principal = Principal.fromText(principalInput.trim());
    } catch {
      toast.error("Ungültige Principal ID");
      return;
    }
    setSavingPrincipal(true);
    try {
      await actor.addTrustedAdminPrincipal(principal);
      toast.success("Admin-Benutzer hinzugefügt");
      setPrincipalInput("");
      setAddPrincipalOpen(false);
      loadTrustedPrincipals();
    } catch {
      toast.error("Fehler beim Hinzufügen");
    } finally {
      setSavingPrincipal(false);
    }
  };

  const removeTrustedPrincipal = async (principal: Principal) => {
    const text = principal.toText();
    setRemovingPrincipal(text);
    try {
      await actor.removeTrustedAdminPrincipal(principal);
      toast.success("Admin-Benutzer entfernt");
      loadTrustedPrincipals();
    } catch {
      toast.error("Fehler beim Entfernen");
    } finally {
      setRemovingPrincipal(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 space-y-6" data-ocid="admin.panel">
      {/* ── Feiertage ── */}
      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-slate-800 text-sm">
              Feiertage verwalten
            </h2>
            <Select
              value={adminYear.toString()}
              onValueChange={(v) => setAdminYear(Number(v))}
            >
              <SelectTrigger
                className="h-7 w-20 text-xs"
                data-ocid="admin.select"
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
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={applyHolidays}
              disabled={applyingHolidays}
              data-ocid="admin.button"
            >
              {applyingHolidays ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <CalendarCheck className="h-3 w-3 mr-1" />
              )}
              Auf alle anwenden
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={openHolidayAdd}
              data-ocid="admin.open_modal_button"
            >
              <Plus className="h-3 w-3 mr-1" />
              Hinzufügen
            </Button>
          </div>
        </div>

        {loadingHolidays ? (
          <div className="py-8 text-center" data-ocid="admin.loading_state">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs w-32">
                  Datum (Montag KW)
                </TableHead>
                <TableHead className="text-xs w-16">KW</TableHead>
                <TableHead className="text-xs w-24">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-slate-400 py-6 text-xs"
                    data-ocid="admin.empty_state"
                  >
                    Keine Feiertage für {adminYear}
                  </TableCell>
                </TableRow>
              ) : (
                holidays.map((h, idx) => (
                  <TableRow
                    key={h.id.toString()}
                    data-ocid={`admin.item.${idx + 1}`}
                  >
                    <TableCell className="text-sm">{h.name}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {holidayDisplayDate(h.kw, h.year)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      KW {Number(h.kw)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => openHolidayEdit(h)}
                          data-ocid={`admin.edit_button.${idx + 1}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteHoliday(h)}
                          data-ocid={`admin.delete_button.${idx + 1}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </section>

      {/* ── Mitarbeitende ── */}
      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 text-sm">
            Mitarbeitende verwalten
          </h2>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={openEmployeeAdd}
            data-ocid="admin.open_modal_button"
          >
            <Plus className="h-3 w-3 mr-1" />
            Hinzufügen
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs w-24">Pensum %</TableHead>
              <TableHead className="text-xs w-20">Aktiv</TableHead>
              <TableHead className="text-xs w-28">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-slate-400 py-6 text-xs"
                  data-ocid="admin.empty_state"
                >
                  Keine Mitarbeitenden
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp, idx) => (
                <TableRow
                  key={emp.id.toString()}
                  data-ocid={`admin.item.${idx + 1}`}
                >
                  <TableCell className="text-sm font-medium">
                    {emp.name}
                  </TableCell>
                  <TableCell className="text-sm">
                    {Number(emp.pensum)}%
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        emp.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {emp.isActive ? "Aktiv" : "Inaktiv"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => openEmployeeEdit(emp)}
                        data-ocid={`admin.edit_button.${idx + 1}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {emp.isActive && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deactivateEmployee(emp)}
                          data-ocid={`admin.delete_button.${idx + 1}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {/* ── Projekte ── */}
      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 text-sm">
            Projekte verwalten
          </h2>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={openProjectAdd}
            data-ocid="admin.open_modal_button"
          >
            <Plus className="h-3 w-3 mr-1" />
            Hinzufügen
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs w-20">Farbe</TableHead>
              <TableHead className="text-xs w-20">Aktiv</TableHead>
              <TableHead className="text-xs w-28">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-slate-400 py-6 text-xs"
                  data-ocid="admin.empty_state"
                >
                  Keine Projekte
                </TableCell>
              </TableRow>
            ) : (
              projects.map((p, idx) => (
                <TableRow
                  key={p.id.toString()}
                  data-ocid={`admin.item.${idx + 1}`}
                >
                  <TableCell className="text-sm font-medium">
                    {p.name}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-4 h-4 rounded border border-slate-200"
                        style={{ background: p.color }}
                      />
                      <span className="text-xs text-slate-500">{p.color}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        p.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {p.isActive ? "Aktiv" : "Inaktiv"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => openProjectEdit(p)}
                        data-ocid={`admin.edit_button.${idx + 1}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {p.isActive && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deactivateProject(p)}
                          data-ocid={`admin.delete_button.${idx + 1}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {/* ── Admin-Benutzer ── */}
      {isAdmin && (
        <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" />
              <h2 className="font-semibold text-slate-800 text-sm">
                Admin-Benutzer verwalten
              </h2>
            </div>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setPrincipalInput("");
                setAddPrincipalOpen(true);
              }}
              data-ocid="admin.open_modal_button"
            >
              <Plus className="h-3 w-3 mr-1" />
              Hinzufügen
            </Button>
          </div>
          <p className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">
            Eingetragene Principal IDs erhalten beim Anmelden direkt
            Admin-Zugang.
          </p>
          {loadingTrusted ? (
            <div className="py-6 text-center" data-ocid="admin.loading_state">
              <Loader2 className="h-4 w-4 animate-spin mx-auto text-slate-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs">Principal ID</TableHead>
                  <TableHead className="text-xs w-24">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trustedPrincipals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-center text-slate-400 py-6 text-xs"
                      data-ocid="admin.empty_state"
                    >
                      Keine Admin-Benutzer eingetragen
                    </TableCell>
                  </TableRow>
                ) : (
                  trustedPrincipals.map((principal, idx) => {
                    const text = principal.toText();
                    return (
                      <TableRow key={text} data-ocid={`admin.item.${idx + 1}`}>
                        <TableCell>
                          <code className="text-xs font-mono text-slate-700 break-all">
                            {text}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeTrustedPrincipal(principal)}
                            disabled={removingPrincipal === text}
                            data-ocid={`admin.delete_button.${idx + 1}`}
                          >
                            {removingPrincipal === text ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </section>
      )}

      {/* ── Holiday Dialog ── */}
      <Dialog
        open={hDlg.open}
        onOpenChange={(open) => setHDlg((d) => ({ ...d, open }))}
      >
        <DialogContent className="max-w-sm" data-ocid="admin.dialog">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {hDlg.editing ? "Feiertag bearbeiten" : "Feiertag hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={hDlg.name}
                onChange={(e) =>
                  setHDlg((d) => ({ ...d, name: e.target.value }))
                }
                className="h-9 text-sm"
                placeholder="z.B. Neujahr"
                data-ocid="admin.input"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Datum (TT.MM.JJJJ)</Label>
              <Input
                value={hDlg.date}
                onChange={(e) =>
                  setHDlg((d) => ({ ...d, date: e.target.value }))
                }
                className="h-9 text-sm"
                placeholder="z.B. 01.01.2026"
                data-ocid="admin.input"
              />
              <p className="text-xs text-slate-400">
                Die Kalenderwoche wird automatisch berechnet.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHDlg((d) => ({ ...d, open: false }))}
              data-ocid="admin.cancel_button"
            >
              Abbrechen
            </Button>
            <Button
              size="sm"
              onClick={saveHoliday}
              disabled={hSaving}
              data-ocid="admin.save_button"
            >
              {hSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Employee Dialog ── */}
      <Dialog
        open={eDlg.open}
        onOpenChange={(open) => setEDlg((d) => ({ ...d, open }))}
      >
        <DialogContent className="max-w-sm" data-ocid="admin.dialog">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {eDlg.editing
                ? "Mitarbeitende/r bearbeiten"
                : "Mitarbeitende/r hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={eDlg.name}
                onChange={(e) =>
                  setEDlg((d) => ({ ...d, name: e.target.value }))
                }
                className="h-9 text-sm"
                placeholder="Vollständiger Name"
                data-ocid="admin.input"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pensum %</Label>
              <Input
                type="number"
                min={10}
                max={100}
                step={10}
                value={eDlg.pensum}
                onChange={(e) =>
                  setEDlg((d) => ({ ...d, pensum: e.target.value }))
                }
                className="h-9 text-sm"
                data-ocid="admin.input"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs">Aktiv</Label>
              <Switch
                checked={eDlg.isActive}
                onCheckedChange={(v) => setEDlg((d) => ({ ...d, isActive: v }))}
                data-ocid="admin.switch"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEDlg((d) => ({ ...d, open: false }))}
              data-ocid="admin.cancel_button"
            >
              Abbrechen
            </Button>
            <Button
              size="sm"
              onClick={saveEmployee}
              disabled={eSaving}
              data-ocid="admin.save_button"
            >
              {eSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Project Dialog ── */}
      <Dialog
        open={pDlg.open}
        onOpenChange={(open) => setPDlg((d) => ({ ...d, open }))}
      >
        <DialogContent className="max-w-sm" data-ocid="admin.dialog">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {pDlg.editing ? "Projekt bearbeiten" : "Projekt hinzufügen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Projektname</Label>
              <Input
                value={pDlg.name}
                onChange={(e) =>
                  setPDlg((d) => ({ ...d, name: e.target.value }))
                }
                className="h-9 text-sm"
                placeholder="z.B. Kundenprojekt Alpha"
                data-ocid="admin.input"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Farbe</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={pDlg.color}
                  onChange={(e) =>
                    setPDlg((d) => ({ ...d, color: e.target.value }))
                  }
                  className="h-9 w-16 rounded border border-slate-200 cursor-pointer p-0.5"
                />
                <span className="text-xs text-slate-500">{pDlg.color}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs">Aktiv</Label>
              <Switch
                checked={pDlg.isActive}
                onCheckedChange={(v) => setPDlg((d) => ({ ...d, isActive: v }))}
                data-ocid="admin.switch"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPDlg((d) => ({ ...d, open: false }))}
              data-ocid="admin.cancel_button"
            >
              Abbrechen
            </Button>
            <Button
              size="sm"
              onClick={saveProject}
              disabled={pSaving}
              data-ocid="admin.save_button"
            >
              {pSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Principal Dialog ── */}
      <Dialog
        open={addPrincipalOpen}
        onOpenChange={(open) => setAddPrincipalOpen(open)}
      >
        <DialogContent className="max-w-sm" data-ocid="admin.dialog">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Admin-Benutzer hinzufügen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Principal ID</Label>
              <Input
                value={principalInput}
                onChange={(e) => setPrincipalInput(e.target.value)}
                className="h-9 text-sm font-mono"
                placeholder="xxxxx-xxxxx-..."
                data-ocid="admin.input"
              />
              <p className="text-xs text-slate-400">
                Die Principal ID findest du im Profil des Benutzers.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddPrincipalOpen(false)}
              data-ocid="admin.cancel_button"
            >
              Abbrechen
            </Button>
            <Button
              size="sm"
              onClick={addTrustedPrincipal}
              disabled={savingPrincipal}
              data-ocid="admin.save_button"
            >
              {savingPrincipal && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
