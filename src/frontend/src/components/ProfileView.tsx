import { Button } from "@/components/ui/button";
import type { Identity } from "@dfinity/agent";
import { Check, Copy, User } from "lucide-react";
import { useState } from "react";

interface ProfileViewProps {
  identity: Identity | null;
}

export default function ProfileView({ identity }: ProfileViewProps) {
  const [copied, setCopied] = useState(false);

  const principalId = identity?.getPrincipal().toText() ?? "—";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(principalId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6" data-ocid="profile.panel">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
            <User className="h-5 w-5 text-slate-500" />
          </div>
          <h1 className="text-xl font-semibold text-slate-800">Mein Profil</h1>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Principal ID
            </p>
            <div className="flex items-center gap-2 p-3 rounded-md bg-slate-50 border border-slate-200">
              <code className="flex-1 text-xs font-mono text-slate-700 break-all select-all">
                {principalId}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 shrink-0"
                onClick={handleCopy}
                title="Kopieren"
                data-ocid="profile.button"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            {copied && (
              <p className="text-xs text-green-600 mt-1">
                In Zwischenablage kopiert
              </p>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Deine Principal ID identifiziert dich eindeutig im Internet Computer
            Netzwerk.
          </p>
        </div>
      </div>
    </div>
  );
}
