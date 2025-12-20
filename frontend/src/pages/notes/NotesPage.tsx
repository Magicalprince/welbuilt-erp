import { useState, useMemo } from "react";
import { Plus, Search, Pin, CheckSquare, Trash2, Edit, X } from "lucide-react";
import { Button, Input, Card, CardContent, Badge, Skeleton, Modal, Textarea, Select } from "@/components/ui";
import { getRelativeTime, cn } from "@/lib/utils";
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useToggleNotePin,
  useToggleCheckpoint,
  useAddCheckpoint,
  useProjects,
  useClients,
} from "@/hooks/useFirestore";
import { useAuthStore } from "@/store/authStore";
import type { Note } from "@/types";
import toast from "react-hot-toast";

interface NoteFormData {
  title: string;
  content: string;
  isPinned: boolean;
  projectId: string;
  clientId: string;
  checkpoints: { text: string; isChecked: boolean }[];
}

const initialFormData: NoteFormData = {
  title: "",
  content: "",
  isPinned: false,
  projectId: "",
  clientId: "",
  checkpoints: [],
};

export default function NotesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formData, setFormData] = useState<NoteFormData>(initialFormData);
  const [newCheckpointText, setNewCheckpointText] = useState("");

  const { user } = useAuthStore();
  const { data: notes, isLoading, error } = useNotes();
  const { data: projects } = useProjects();
  const { data: clients } = useClients();

  const createNoteMutation = useCreateNote();
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();
  const togglePinMutation = useToggleNotePin();
  const toggleCheckpointMutation = useToggleCheckpoint();
  const addCheckpointMutation = useAddCheckpoint();

  const projectOptions = useMemo(() => {
    if (!projects) return [];
    return projects.map((p) => ({ value: p.id, label: p.title }));
  }, [projects]);

  const clientOptions = useMemo(() => {
    if (!clients) return [];
    return clients.map((c) => ({ value: c.id, label: c.companyName }));
  }, [clients]);

  const filteredNotes = useMemo(() => {
    if (!notes) return [];

    return notes
      .filter((note) => {
        const matchesSearch =
          note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPinned = !showPinnedOnly || note.isPinned;
        return matchesSearch && matchesPinned;
      })
      .sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
  }, [notes, searchQuery, showPinnedOnly]);

  const handleOpenModal = (note?: Note) => {
    if (note) {
      setEditingNote(note);
      setFormData({
        title: note.title,
        content: note.content,
        isPinned: note.isPinned,
        projectId: note.projectId || "",
        clientId: note.clientId || "",
        checkpoints: note.checkpoints.map((cp) => ({
          text: cp.text,
          isChecked: cp.isChecked,
        })),
      });
    } else {
      setEditingNote(null);
      setFormData(initialFormData);
    }
    setNewCheckpointText("");
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingNote(null);
    setFormData(initialFormData);
    setNewCheckpointText("");
  };

  const handleAddCheckpointToForm = () => {
    if (!newCheckpointText.trim()) return;
    setFormData((prev) => ({
      ...prev,
      checkpoints: [...prev.checkpoints, { text: newCheckpointText.trim(), isChecked: false }],
    }));
    setNewCheckpointText("");
  };

  const handleRemoveCheckpointFromForm = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      checkpoints: prev.checkpoints.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    try {
      if (editingNote) {
        await updateNoteMutation.mutateAsync({
          noteId: editingNote.id,
          data: {
            title: formData.title,
            content: formData.content,
            isPinned: formData.isPinned,
            projectId: formData.projectId || undefined,
            clientId: formData.clientId || undefined,
          },
          userId: user?.id,
          noteTitle: formData.title,
        });
        toast.success("Note updated successfully");
      } else {
        if (!user?.id) {
          toast.error("You must be logged in to create a note");
          return;
        }
        await createNoteMutation.mutateAsync({
          title: formData.title,
          content: formData.content,
          isPinned: formData.isPinned,
          projectId: formData.projectId || undefined,
          clientId: formData.clientId || undefined,
          createdBy: user.id,
          checkpoints: formData.checkpoints,
        });
        toast.success("Note created successfully");
      }
      handleCloseModal();
    } catch (error) {
      console.error("Note operation failed:", error);
      toast.error(editingNote ? "Failed to update note" : "Failed to create note");
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      await deleteNoteMutation.mutateAsync(noteId);
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const handleTogglePin = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await togglePinMutation.mutateAsync({
        noteId: note.id,
        isPinned: !note.isPinned,
        userId: user?.id,
        noteTitle: note.title,
      });
      toast.success(note.isPinned ? "Note unpinned" : "Note pinned");
    } catch {
      toast.error("Failed to update pin status");
    }
  };

  const handleToggleCheckpoint = async (noteId: string, checkpointId: string, isChecked: boolean) => {
    try {
      await toggleCheckpointMutation.mutateAsync({
        noteId,
        checkpointId,
        isChecked: !isChecked,
      });
    } catch {
      toast.error("Failed to update checkpoint");
    }
  };

  const handleAddCheckpointToNote = async (noteId: string, text: string) => {
    if (!text.trim()) return;
    try {
      await addCheckpointMutation.mutateAsync({ noteId, text: text.trim() });
      toast.success("Checkpoint added");
    } catch {
      toast.error("Failed to add checkpoint");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notes & Checkpoints</h1>
          <p className="text-muted-foreground">Collaborate and track important decisions</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          New Note
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={!showPinnedOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPinnedOnly(false)}
          >
            All Notes
          </Button>
          <Button
            variant={showPinnedOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPinnedOnly(true)}
          >
            <Pin className="h-4 w-4 mr-1" />
            Pinned
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <NoteCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">Error loading notes. Please try again.</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold">No notes found</h3>
          <p className="text-muted-foreground">
            {notes && notes.length > 0
              ? "Try adjusting your search"
              : "Get started by creating your first note"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => handleOpenModal(note)}
              onDelete={() => handleDelete(note.id)}
              onTogglePin={(e) => handleTogglePin(note, e)}
              onToggleCheckpoint={handleToggleCheckpoint}
              onAddCheckpoint={handleAddCheckpointToNote}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Note Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingNote ? "Edit Note" : "New Note"}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title *</label>
            <Input
              placeholder="Note title..."
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Content</label>
            <Textarea
              placeholder="Write your note..."
              value={formData.content}
              onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
              className="min-h-[120px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Link to Project</label>
              <Select
                options={[{ value: "", label: "None" }, ...projectOptions]}
                value={formData.projectId}
                onChange={(e) => setFormData((prev) => ({ ...prev, projectId: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Link to Client</label>
              <Select
                options={[{ value: "", label: "None" }, ...clientOptions]}
                value={formData.clientId}
                onChange={(e) => setFormData((prev) => ({ ...prev, clientId: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPinned"
              checked={formData.isPinned}
              onChange={(e) => setFormData((prev) => ({ ...prev, isPinned: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="isPinned" className="text-sm font-medium flex items-center gap-1">
              <Pin className="h-4 w-4" />
              Pin this note
            </label>
          </div>

          {/* Checkpoints (only for new notes) */}
          {!editingNote && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Checkpoints</label>
              <div className="space-y-2">
                {formData.checkpoints.map((cp, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <CheckSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm">{cp.text}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCheckpointFromForm(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a checkpoint..."
                    value={newCheckpointText}
                    onChange={(e) => setNewCheckpointText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCheckpointToForm();
                      }
                    }}
                  />
                  <Button variant="outline" onClick={handleAddCheckpointToForm}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createNoteMutation.isPending || updateNoteMutation.isPending}
            >
              {createNoteMutation.isPending || updateNoteMutation.isPending
                ? "Saving..."
                : editingNote
                ? "Update Note"
                : "Create Note"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface NoteCardProps {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onToggleCheckpoint: (noteId: string, checkpointId: string, isChecked: boolean) => void;
  onAddCheckpoint: (noteId: string, text: string) => void;
}

function NoteCard({
  note,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleCheckpoint,
  onAddCheckpoint,
}: NoteCardProps) {
  const [showAddCheckpoint, setShowAddCheckpoint] = useState(false);
  const [newCheckpoint, setNewCheckpoint] = useState("");

  const completedCheckpoints = note.checkpoints.filter((cp) => cp.isChecked).length;
  const totalCheckpoints = note.checkpoints.length;

  const handleAddCheckpoint = () => {
    if (newCheckpoint.trim()) {
      onAddCheckpoint(note.id, newCheckpoint);
      setNewCheckpoint("");
      setShowAddCheckpoint(false);
    }
  };

  return (
    <Card className="card-hover">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <button
            onClick={onTogglePin}
            className={cn(
              "shrink-0 p-1 rounded hover:bg-accent transition-colors",
              note.isPinned ? "text-primary" : "text-muted-foreground"
            )}
            title={note.isPinned ? "Unpin note" : "Pin note"}
          >
            <Pin className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{note.title}</h3>
                {totalCheckpoints > 0 && (
                  <Badge variant="secondary">
                    <CheckSquare className="h-3 w-3 mr-1" />
                    {completedCheckpoints}/{totalCheckpoints}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{note.content}</p>

            {totalCheckpoints > 0 && (
              <div className="mb-3 space-y-1">
                {note.checkpoints.map((checkpoint) => (
                  <button
                    key={checkpoint.id}
                    onClick={() => onToggleCheckpoint(note.id, checkpoint.id, checkpoint.isChecked)}
                    className="flex items-center gap-2 text-sm w-full text-left hover:bg-accent p-1 rounded transition-colors"
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                        checkpoint.isChecked ? "bg-primary border-primary" : "border-muted-foreground"
                      )}
                    >
                      {checkpoint.isChecked && <span className="text-white text-xs">✓</span>}
                    </div>
                    <span className={checkpoint.isChecked ? "line-through text-muted-foreground" : ""}>
                      {checkpoint.text}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Add checkpoint inline */}
            {showAddCheckpoint ? (
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="New checkpoint..."
                  value={newCheckpoint}
                  onChange={(e) => setNewCheckpoint(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCheckpoint();
                    }
                    if (e.key === "Escape") {
                      setShowAddCheckpoint(false);
                      setNewCheckpoint("");
                    }
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={handleAddCheckpoint}>
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddCheckpoint(false);
                    setNewCheckpoint("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddCheckpoint(true)}
                className="text-sm text-primary hover:underline mb-3 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Add checkpoint
              </button>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{getRelativeTime(note.createdAt)}</span>
              {note.projectId && (
                <>
                  <span>•</span>
                  <span>Linked to project</span>
                </>
              )}
              {note.clientId && (
                <>
                  <span>•</span>
                  <span>Linked to client</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NoteCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
