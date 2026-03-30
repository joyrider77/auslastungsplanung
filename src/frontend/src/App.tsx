import { Toaster } from "@/components/ui/sonner";
import { User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Employee, Entry, Holiday, Project } from "./backend";
import AdminView from "./components/AdminView";
import AuslastungView from "./components/AuslastungView";
import KalenderView from "./components/KalenderView";
import ProfileView from "./components/ProfileView";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";

type Tab = "kalender" | "auslastung" | "admin" | "profil";

export default function App() {
  const { identity, login, clear, isInitializing, isLoggingIn } =
    useInternetIdentity();
  const { actor, isFetching: actorFetching } = useActor();
  const actorError = !actorFetching && !actor && identity;
  const [activeTab, setActiveTab] = useState<Tab>("kalender");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(
    async (year: number) => {
      if (!actor || !identity) return;
      setIsLoading(true);
      try {
        const [emps, projs] = await Promise.all([
          actor.getAllEmployees(),
          actor.getAllProjects(),
        ]);

        if (emps.length === 0) {
          try {
            await actor.seedSampleData();
          } catch {
            // seedSampleData requires admin – ignore if not admin
          }
          const [emps2, projs2, ents2, hols2] = await Promise.all([
            actor.getAllEmployees(),
            actor.getAllProjects(),
            actor.getEntriesForYear(BigInt(year)),
            actor.getHolidaysForYear(BigInt(year)),
          ]);
          setEmployees(emps2);
          setProjects(projs2);
          setEntries(ents2.filter((e) => e.days > 0));
          setHolidays(hols2);
        } else {
          const [ents, hols] = await Promise.all([
            actor.getEntriesForYear(BigInt(year)),
            actor.getHolidaysForYear(BigInt(year)),
          ]);
          setEmployees(emps);
          setProjects(projs);
          setEntries(ents.filter((e) => e.days > 0));
          setHolidays(hols);
        }
      } catch (e) {
        console.error("loadData failed:", e);
      } finally {
        setIsLoading(false);
      }
    },
    [actor, identity],
  );

  useEffect(() => {
    if (identity && actor) {
      loadData(selectedYear);
    }
  }, [selectedYear, loadData, identity, actor]);

  const refresh = useCallback(
    () => loadData(selectedYear),
    [loadData, selectedYear],
  );

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  const tabLabel = (tab: Tab) => {
    if (tab === "kalender") return "Kalender";
    if (tab === "auslastung") return `Auslastung ${selectedYear}`;
    if (tab === "admin") return "Admin";
    return "Profil";
  };

  // Initializing
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-slate-300 border-t-slate-700 rounded-full mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Wird initialisiert…</p>
        </div>
      </div>
    );
  }

  // Not logged in → show login screen
  if (!identity) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 max-w-sm w-full text-center">
          <h1 className="text-xl font-bold text-slate-800 mb-2">
            Auslastungsplanung
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            Bitte melde dich an, um fortzufahren.
          </p>
          <button
            type="button"
            onClick={login}
            disabled={isLoggingIn}
            data-ocid="login.primary_button"
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg py-2.5 px-4 text-sm font-medium transition-colors"
          >
            {isLoggingIn
              ? "Anmeldung läuft…"
              : "Mit Internet Identity anmelden"}
          </button>
        </div>
      </div>
    );
  }

  // Actor error – show message with reload button
  if (actorError && !actor) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 max-w-sm w-full text-center">
          <p className="text-slate-700 font-medium mb-2">
            Verbindung fehlgeschlagen
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Die Verbindung zum Backend konnte nicht hergestellt werden.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            data-ocid="actor_error.primary_button"
            className="w-full bg-slate-800 hover:bg-slate-700 text-white rounded-lg py-2.5 px-4 text-sm font-medium transition-colors"
          >
            Neu laden
          </button>
        </div>
      </div>
    );
  }

  // Actor not ready yet
  if (!actor) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-slate-300 border-t-slate-700 rounded-full mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Verbindung wird hergestellt…</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-slate-300 border-t-slate-700 rounded-full mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Daten werden geladen…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navigation */}
      <header
        className="bg-slate-800 text-white shadow-lg"
        data-ocid="app.panel"
      >
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-6">
            <h1 className="text-sm font-bold tracking-widest uppercase text-slate-200 whitespace-nowrap">
              Auslastungsplanung
            </h1>
            <nav className="flex items-center gap-1" data-ocid="nav.panel">
              {(["kalender", "auslastung", "admin"] as Tab[]).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  data-ocid="nav.link"
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                  }`}
                >
                  {tabLabel(tab)}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("profil")}
              data-ocid="nav.link"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === "profil"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              Profil
            </button>
            <button
              type="button"
              onClick={clear}
              className="text-slate-400 hover:text-white text-xs transition-colors ml-2"
              data-ocid="nav.link"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "kalender" && (
          <KalenderView
            employees={employees}
            projects={projects}
            entries={entries}
            holidays={holidays}
            selectedYear={selectedYear}
            onYearChange={handleYearChange}
            actor={actor}
            onRefresh={refresh}
          />
        )}
        {activeTab === "auslastung" && (
          <AuslastungView
            employees={employees}
            projects={projects}
            entries={entries}
            selectedYear={selectedYear}
            onYearChange={handleYearChange}
          />
        )}
        {activeTab === "admin" && (
          <AdminView
            employees={employees}
            projects={projects}
            selectedYear={selectedYear}
            actor={actor}
            onRefresh={refresh}
          />
        )}
        {activeTab === "profil" && <ProfileView identity={identity} />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-2 px-6 text-center text-xs text-slate-400 no-print">
        © {new Date().getFullYear()}. Built with ♥ using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          caffeine.ai
        </a>
      </footer>

      <Toaster />
    </div>
  );
}
