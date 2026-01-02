import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import { Award, FileText, CalendarCheck } from "lucide-react";
import CertificatesTab from "./CertificatesTab";
import OfferLettersTab from "./OfferLettersTab";

export default function InternsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Interns</h1>
        <p className="text-muted-foreground">Manage intern certificates, offer letters, and attendance</p>
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
            Attendance Slip
          </TabsTrigger>
        </TabsList>

        <TabsContent value="certificates" className="mt-6">
          <CertificatesTab />
        </TabsContent>

        <TabsContent value="offer-letters" className="mt-6">
          <OfferLettersTab />
        </TabsContent>

        <TabsContent value="attendance" className="mt-6">
          <div className="text-center py-12">
            <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Attendance Slips</h3>
            <p className="text-muted-foreground">Coming soon - Generate and manage attendance slips</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
