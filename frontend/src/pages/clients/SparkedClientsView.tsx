import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, MapPin, Phone, Building2, FileSignature, Users, IndianRupee } from "lucide-react";
import { Card, CardContent, Badge, Skeleton, Button, DonutChart, ChartLegend, ChartColors } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { useSparkedConvertedColleges, useSparkedAnalytics } from "@/hooks/useLeads";
import { SPARKED_DEPT_STATUS_LABELS, WORKSHOP_EXPENSE_CATEGORY_LABELS } from "@/types";
import CollegeDetailView from "@/pages/leads/CollegeDetailView";
import DepartmentDetailView from "@/pages/leads/DepartmentDetailView";
import WorkshopDetailView from "@/pages/leads/WorkshopDetailView";

type ClientsSparkedView =
  | { type: "grid" }
  | { type: "college"; collegeId: string }
  | { type: "department"; collegeId: string; deptId: string }
  | { type: "workshop"; collegeId: string; deptId: string; workshopId: string };

export default function SparkedClientsView() {
  const [view, setView] = useState<ClientsSparkedView>({ type: "grid" });

  return (
    <div className="space-y-6">
      <SparkedAnalyticsHeader />

      {view.type === "workshop" ? (
        <WorkshopDetailView
          workshopId={view.workshopId}
          onBack={() => setView({ type: "department", collegeId: view.collegeId, deptId: view.deptId })}
        />
      ) : view.type === "department" ? (
        <DepartmentDetailView
          collegeId={view.collegeId}
          deptId={view.deptId}
          onBack={() => setView({ type: "college", collegeId: view.collegeId })}
          onOpenWorkshop={(workshopId) =>
            setView({ type: "workshop", collegeId: view.collegeId, deptId: view.deptId, workshopId })
          }
        />
      ) : view.type === "college" ? (
        <CollegeDetailView
          collegeId={view.collegeId}
          onBack={() => setView({ type: "grid" })}
          onOpenDepartment={(deptId) => setView({ type: "department", collegeId: view.collegeId, deptId })}
        />
      ) : (
        <SparkedCollegeGrid onOpenCollege={(collegeId) => setView({ type: "college", collegeId })} />
      )}
    </div>
  );
}

// ============================================
// Analytics Header
// ============================================
function SparkedAnalyticsHeader() {
  const { data: analytics, isLoading } = useSparkedAnalytics();

  if (isLoading || !analytics) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const expenseData = (Object.keys(WORKSHOP_EXPENSE_CATEGORY_LABELS) as (keyof typeof WORKSHOP_EXPENSE_CATEGORY_LABELS)[])
    .map((cat) => ({
      name: WORKSHOP_EXPENSE_CATEGORY_LABELS[cat],
      value: analytics.expenseByCategory[cat],
    }))
    .filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Colleges</p>
                <p className="font-semibold text-xl">{analytics.totalColleges}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <FileSignature className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MOU Signed</p>
                <p className="font-semibold text-xl">{analytics.mouSignedColleges}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Workshops Conducted</p>
                <p className="font-semibold text-xl">{analytics.totalWorkshops}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Students Trained</p>
                <p className="font-semibold text-xl">{analytics.totalStudentsTrained}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium mb-4 flex items-center gap-2">
              <IndianRupee className="h-4 w-4" />
              Earnings vs Expenses
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Earnings</p>
                <p className="font-semibold text-green-500 mt-1">{formatCurrency(analytics.totalEarnings)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="font-semibold text-red-500 mt-1">{formatCurrency(analytics.totalExpenses)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Margin</p>
                <p className={`font-semibold mt-1 ${analytics.netMargin >= 0 ? "text-blue-500" : "text-red-500"}`}>
                  {formatCurrency(analytics.netMargin)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium mb-2">Expense Categories</p>
            {expenseData.length > 0 ? (
              <>
                <DonutChart data={expenseData} height={140} innerRadius={32} outerRadius={56} />
                <ChartLegend
                  items={expenseData.map((d, i) => ({
                    name: d.name,
                    color: [
                      ChartColors.gold,
                      ChartColors.success,
                      ChartColors.danger,
                      ChartColors.slate,
                    ][i % 4],
                    value: formatCurrency(d.value),
                  }))}
                  className="mt-3"
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No expenses recorded yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// College Grid
// ============================================
function SparkedCollegeGrid({ onOpenCollege }: { onOpenCollege: (collegeId: string) => void }) {
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
          <Card className="card-hover cursor-pointer h-full" onClick={() => onOpenCollege(c.college.id)}>
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
