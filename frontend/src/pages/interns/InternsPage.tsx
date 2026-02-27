import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import { Award, FileText, CalendarCheck, Receipt } from "lucide-react";
import CertificatesTab from "./CertificatesTab";
import OfferLettersTab from "./OfferLettersTab";
import AttendanceTab from "./AttendanceTab";
import PayslipTab from "./PayslipTab";

export default function InternsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Interns</h1>
        <p className="text-muted-foreground">Manage intern certificates, offer letters, attendance, and payslips</p>
      </div>

      <Tabs defaultValue="certificates">
        <TabsList>
          <TabsTrigger value="certificates" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Certificates
          </TabsTrigger>
          <TabsTrigger value="offer-letters" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Offer Letters
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="payslips" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Payslips
          </TabsTrigger>
        </TabsList>

        <TabsContent value="certificates" className="mt-6">
          <CertificatesTab />
        </TabsContent>

        <TabsContent value="offer-letters" className="mt-6">
          <OfferLettersTab />
        </TabsContent>

        <TabsContent value="attendance" className="mt-6">
          <AttendanceTab />
        </TabsContent>

        <TabsContent value="payslips" className="mt-6">
          <PayslipTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
