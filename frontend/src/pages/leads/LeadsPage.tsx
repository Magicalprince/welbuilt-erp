import { useState } from "react";
import { Building2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import SparksLeadsTab from "./SparksLeadsTab";
import SparkedLeadsTab from "./SparkedLeadsTab";

type LeadsBrand = "sparks" | "sparked";

export default function LeadsPage() {
  const [activeBrand, setActiveBrand] = useState<LeadsBrand>("sparks");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leads</h1>
        <p className="text-muted-foreground">Track prospects from first contact through conversion</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveBrand("sparks")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
            activeBrand === "sparks"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-transparent text-muted-foreground border-border hover:border-blue-400"
          )}
        >
          <Building2 className="h-3.5 w-3.5" /> Sparks AI
        </button>
        <button
          onClick={() => setActiveBrand("sparked")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
            activeBrand === "sparked"
              ? "bg-amber-500 text-white border-amber-500"
              : "bg-transparent text-muted-foreground border-border hover:border-amber-400"
          )}
        >
          <Zap className="h-3.5 w-3.5" /> SparkED
        </button>
      </div>

      {activeBrand === "sparks" ? <SparksLeadsTab /> : <SparkedLeadsTab />}
    </div>
  );
}
