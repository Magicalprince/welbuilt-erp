import { useEffect, useRef } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  pdfUrl: string | null;
  onDownload: () => void;
  isDownloading?: boolean;
}

// Embedding a PDF in an iframe inside a modal fights the browser's own
// native PDF viewer chrome (toolbar, zoom controls) for space and always
// looks cramped. Once the PDF blob URL is ready we open it straight in a
// new tab — the browser's full-page PDF viewer is strictly better than
// anything we could build in a modal — and this dialog just confirms that
// happened, with Open/Download as explicit fallbacks (pop-up blockers).
export function PdfPreviewModal({
  isOpen,
  onClose,
  title,
  subtitle,
  pdfUrl,
  onDownload,
  isDownloading,
}: PdfPreviewModalProps) {
  const openedForUrl = useRef<string | null>(null);

  useEffect(() => {
    if (pdfUrl && openedForUrl.current !== pdfUrl) {
      openedForUrl.current = pdfUrl;
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
    }
  }, [pdfUrl]);

  useEffect(() => {
    if (!isOpen) openedForUrl.current = null;
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} description={subtitle} size="md">
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <FileText className="h-7 w-7 text-primary" />
        </div>
        {pdfUrl ? (
          <>
            <p className="text-sm text-muted-foreground">
              Opened in a new tab. If it didn't open, use the button below.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open in New Tab
                </Button>
              </a>
              <Button size="sm" onClick={onDownload} disabled={isDownloading}>
                <Download className="h-4 w-4 mr-1" />
                {isDownloading ? "Generating..." : "Download PDF"}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Generating preview...</p>
        )}
      </div>
    </Modal>
  );
}
