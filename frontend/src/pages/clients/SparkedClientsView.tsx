import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, MapPin, Phone } from "lucide-react";
import { Card, CardContent, Badge, Skeleton, Button } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { useSparkedConvertedColleges } from "@/hooks/useLeads";
import { SPARKED_DEPT_STATUS_LABELS } from "@/types";

export default function SparkedClientsView() {
  const { data: colleges, isLoading } = useSparkedConvertedColleges();

  const cards = useMemo(() => {
    if (!colleges) return [];
    return colleges.map((c) => {
      const signedDepts = c.departments.filter(
        (d) => d.status === "CONVERTED" || d.status === "MOU_SIGNED"
      );
      const totalApproxCount = signedDepts.reduce((sum, d) => sum + (d.approxCount || 0), 0);
      return {
        college: c.college,
        departments: c.departments,
        signedCount: signedDepts.length,
        totalApproxCount,
      };
    });
  }, [colleges]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No SparkED clients yet</h3>
        <p className="text-muted-foreground">
          Colleges appear here once a department signs an MOU or converts.
        </p>
        <Link to="/leads" className="mt-4 inline-block">
          <Button variant="outline">Go to Leads</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((c, index) => (
        <motion.div
          key={c.college.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card className="h-full">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{c.college.collegeName}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{c.college.address}</span>
                  </div>
                </div>
                <Badge variant="success" className="shrink-0">
                  {c.signedCount} of {c.departments.length} signed
                </Badge>
              </div>

              <div className="mt-4 pt-4 border-t space-y-2">
                {c.departments.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{d.deptName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {d.contactName} · {d.contactNumber}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        variant={d.status === "MOU_SIGNED" ? "default" : d.status === "CONVERTED" ? "success" : "secondary"}
                        className="text-xs"
                      >
                        {SPARKED_DEPT_STATUS_LABELS[d.status]}
                      </Badge>
                      {d.rateDiscussed !== undefined && (
                        <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(d.rateDiscussed)}</p>
                      )}
                      {d.approxCount !== undefined && (
                        <p className="text-xs text-muted-foreground">~{d.approxCount} students</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t flex justify-between text-sm">
                <div>
                  <p className="text-muted-foreground">Departments Signed</p>
                  <p className="font-semibold">
                    {c.signedCount} of {c.departments.length}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Total Headcount</p>
                  <p className="font-semibold">{c.totalApproxCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
