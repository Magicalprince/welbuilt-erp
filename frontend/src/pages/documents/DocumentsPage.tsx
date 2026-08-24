import { useState, useMemo, useRef } from "react";
import { Upload, FolderOpen, FileText, File, Image, Download, Trash2, Search, X, Loader2 } from "lucide-react";
import { Button, Card, CardContent, Input, Skeleton, Modal, Label, Select, Textarea } from "@/components/ui";
import { cn, getRelativeTime } from "@/lib/utils";
import { useRealtimeDocuments, useClients, useProjects } from "@/hooks/useFirestore";
import { useUploadDocument, useDeleteDocument, getSignedDownloadUrlForAnyBackend } from "@/hooks/useDocuments";
import { useAuthStore } from "@/store/authStore";
import { validateFile, formatFileSize, ALLOWED_DOCUMENT_TYPES } from "@/services/serverStorageService";
import type { DocumentType } from "@/types";
import toast from "react-hot-toast";

const documentTypeConfig: Record<DocumentType, { label: string; icon: typeof FileText; color: string }> = {
  CONTRACT: { label: "Contracts", icon: FileText, color: "text-blue-500 bg-blue-500/10" },
  PROPOSAL: { label: "Proposals", icon: File, color: "text-green-500 bg-green-500/10" },
  INVOICE: { label: "Invoices", icon: FileText, color: "text-yellow-500 bg-yellow-500/10" },
  RECEIPT: { label: "Receipts", icon: FileText, color: "text-purple-500 bg-purple-500/10" },
  REPORT: { label: "Reports", icon: FileText, color: "text-orange-500 bg-orange-500/10" },
  OTHER: { label: "Other", icon: File, color: "text-gray-500 bg-gray-500/10" },
};

export default function DocumentsPage() {
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; fileUrl?: string } | null>(null);
  const [uploadForm, setUploadForm] = useState({ name: "", type: "OTHER" as DocumentType, description: "", tags: "", projectId: "", clientId: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuthStore();
  // Use real-time subscription for documents - updates automatically when data changes
  const { data: documents, isLoading, error } = useRealtimeDocuments();
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  const folderCounts = useMemo(() => documents?.reduce((acc, doc) => { acc[doc.type] = (acc[doc.type] || 0) + 1; return acc; }, {} as Partial<Record<DocumentType, number>>) ?? ({} as Partial<Record<DocumentType, number>>), [documents]);
  const filteredDocs = useMemo(() => documents?.filter((doc) => (!selectedType || doc.type === selectedType) && (!searchQuery || doc.name.toLowerCase().includes(searchQuery.toLowerCase()))) || [], [documents, selectedType, searchQuery]);

  const getDocIcon = (doc: { mimeType?: string; type: DocumentType }) => doc.mimeType?.startsWith("image/") ? Image : documentTypeConfig[doc.type].icon;
  const resetUploadForm = () => { setUploadForm({ name: "", type: "OTHER", description: "", tags: "", projectId: "", clientId: "" }); setSelectedFile(null); };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateFile(file);
    if (!validation.valid) { toast.error(validation.error || "Invalid file"); return; }
    setSelectedFile(file);
    if (!uploadForm.name) setUploadForm(prev => ({ ...prev, name: file.name }));
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) { toast.error("Please select a file"); return; }
    try {
      await uploadMutation.mutateAsync({ file: selectedFile, metadata: { name: uploadForm.name.trim(), type: uploadForm.type, uploadedBy: user.id, description: uploadForm.description.trim() || undefined, tags: uploadForm.tags.split(",").map(t => t.trim()).filter(Boolean), projectId: uploadForm.projectId || undefined, clientId: uploadForm.clientId || undefined } });
      toast.success("Document uploaded"); setIsUploadModalOpen(false); resetUploadForm();
    } catch { toast.error("Upload failed"); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try { await deleteMutation.mutateAsync({ documentId: deleteConfirm.id, fileUrl: deleteConfirm.fileUrl }); toast.success("Deleted"); setDeleteConfirm(null); } catch { toast.error("Delete failed"); }
  };

  const handleDownload = async (docId: string, fileUrl: string, fileName: string) => {
    setDownloadingId(docId);
    try {
      const signedUrl = await getSignedDownloadUrlForAnyBackend(fileUrl);
      if (!signedUrl) {
        toast.error("Unable to resolve file location");
        return;
      }
      // Open in new tab or trigger download
      const link = document.createElement("a");
      link.href = signedUrl;
      link.target = "_blank";
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div><h1 className="text-3xl font-bold">Documents</h1><p className="text-muted-foreground">Manage templates, contracts, and files</p></div>
        <Button onClick={() => setIsUploadModalOpen(true)}><Upload className="h-4 w-4 mr-2" />Upload Document</Button>
      </div>
      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div>
      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-1 h-fit"><CardContent className="p-4"><h3 className="font-semibold mb-3">Categories</h3><div className="space-y-1"><button onClick={() => setSelectedType(null)} className={cn("w-full flex items-center gap-3 p-2 rounded-lg text-left", !selectedType && "bg-primary text-primary-foreground")}><FolderOpen className="h-4 w-4" /><span>All</span><span className="ml-auto text-xs">{documents?.length || 0}</span></button>{(Object.keys(documentTypeConfig) as DocumentType[]).map(type => (<button key={type} onClick={() => setSelectedType(type)} className={cn("w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-accent", selectedType === type && "bg-primary text-primary-foreground")}><FolderOpen className="h-4 w-4" /><span>{documentTypeConfig[type].label}</span><span className="ml-auto text-xs">{folderCounts[type] || 0}</span></button>))}</div></CardContent></Card>
        <div className="lg:col-span-3">{isLoading ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div> : error ? <p className="text-destructive text-center py-12">Error loading</p> : filteredDocs.length === 0 ? <div className="text-center py-12"><FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-semibold">No documents</h3></div> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filteredDocs.map(doc => { const Icon = getDocIcon(doc); return (<Card key={doc.id} className="card-hover"><CardContent className="p-4"><div className="flex items-center gap-3"><div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", documentTypeConfig[doc.type].color)}><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="font-medium truncate text-sm">{doc.name}</p><p className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize || 0)} . {getRelativeTime(doc.createdAt)}</p></div></div><div className="flex gap-2 mt-4">{doc.fileUrl ? <Button variant="outline" size="sm" className="flex-1" onClick={() => handleDownload(doc.id, doc.fileUrl!, doc.name)} disabled={downloadingId === doc.id}>{downloadingId === doc.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}Download</Button> : <Button variant="outline" size="sm" className="flex-1" disabled>No file</Button>}<Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ id: doc.id, name: doc.name, fileUrl: doc.fileUrl })}><Trash2 className="h-3 w-3" /></Button></div></CardContent></Card>); })}</div>}</div>
      </div>
      <Modal isOpen={isUploadModalOpen} onClose={() => { setIsUploadModalOpen(false); resetUploadForm(); }} title="Upload Document">
        <div className="space-y-4">
          <div><Label>File</Label><div className={cn("mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer", selectedFile ? "border-primary" : "border-border")} onClick={() => fileInputRef.current?.click()}>{selectedFile ? <div className="flex items-center justify-center gap-2"><FileText className="h-5 w-5" /><span>{selectedFile.name}</span><button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}><X className="h-4 w-4" /></button></div> : <div><Upload className="h-8 w-8 mx-auto mb-2" /><p className="text-sm">Click to select</p></div>}</div><input ref={fileInputRef} type="file" className="hidden" accept={ALLOWED_DOCUMENT_TYPES.join(",")} onChange={handleFileSelect} /></div>
          <div><Label>Name</Label><Input value={uploadForm.name} onChange={e => setUploadForm(p => ({...p, name: e.target.value}))} /></div>
          <div><Label>Category</Label><Select value={uploadForm.type} onChange={e => setUploadForm(p => ({...p, type: e.target.value as DocumentType}))} options={Object.entries(documentTypeConfig).map(([k,v]) => ({ value: k, label: v.label }))} /></div>
          <div><Label>Description</Label><Textarea value={uploadForm.description} onChange={e => setUploadForm(p => ({...p, description: e.target.value}))} rows={2} /></div>
          <div><Label>Client</Label><Select value={uploadForm.clientId} onChange={e => setUploadForm(p => ({...p, clientId: e.target.value}))} placeholder="None" options={clients?.map(c => ({ value: c.id, label: c.companyName })) || []} /></div>
          <div><Label>Project</Label><Select value={uploadForm.projectId} onChange={e => setUploadForm(p => ({...p, projectId: e.target.value}))} placeholder="None" options={projects?.map(p => ({ value: p.id, label: p.title })) || []} /></div>
          <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => { setIsUploadModalOpen(false); resetUploadForm(); }}>Cancel</Button><Button className="flex-1" onClick={handleUpload} disabled={!selectedFile || uploadMutation.isPending}>{uploadMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : "Upload"}</Button></div>
        </div>
      </Modal>
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Document">
        <p>Delete {deleteConfirm?.name}?</p>
        <div className="flex gap-3 mt-4"><Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button><Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? "Deleting..." : "Delete"}</Button></div>
      </Modal>
    </div>
  );
}
