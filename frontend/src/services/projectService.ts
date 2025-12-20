import { Timestamp, writeBatch, doc, collection } from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  COLLECTIONS,
  getDocument,
  getDocuments,
  createDocument,
  updateDocument,
  orderBy,
  where,
} from "./firestore";
import type { Project, ProjectPhase, ProjectMVP, ProjectStatus } from "@/types";

// Default phases for every project
const DEFAULT_PHASES = [
  "Planning",
  "Design",
  "Development",
  "Testing",
  "Deployment",
  "Closure",
];

export interface FirestoreProject {
  id: string;
  title: string;
  description?: string;
  scope?: string;
  status: ProjectStatus;
  value: number;
  startDate: Timestamp;
  endDate?: Timestamp;
  progress: number;
  clientId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestorePhase {
  id: string;
  projectId: string;
  name: string;
  order: number;
  status: "pending" | "in_progress" | "completed";
  completedAt?: Timestamp;
}

export interface FirestoreMVP {
  id: string;
  projectId: string;
  name: string;
  isChecked: boolean;
  createdAt: Timestamp;
}

// Convert Firestore project to Project type
function toProject(doc: FirestoreProject, phases: ProjectPhase[] = [], mvpFeatures: ProjectMVP[] = []): Project {
  return {
    ...doc,
    startDate: doc.startDate.toDate(),
    endDate: doc.endDate?.toDate(),
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
    phases,
    mvpFeatures,
  };
}

// Get project by ID with phases and MVP features
export async function getProjectById(projectId: string): Promise<Project | null> {
  const project = await getDocument<FirestoreProject>(COLLECTIONS.PROJECTS, projectId);
  if (!project) return null;

  const phases = await getProjectPhases(projectId);
  const mvpFeatures = await getProjectMVPFeatures(projectId);

  return toProject(project, phases, mvpFeatures);
}

// Get all projects
export async function getAllProjects(): Promise<Project[]> {
  const projects = await getDocuments<FirestoreProject>(
    COLLECTIONS.PROJECTS,
    orderBy("createdAt", "desc")
  );

  return Promise.all(
    projects.map(async (project) => {
      const phases = await getProjectPhases(project.id);
      const mvpFeatures = await getProjectMVPFeatures(project.id);
      return toProject(project, phases, mvpFeatures);
    })
  );
}

// Get projects by client
export async function getProjectsByClient(clientId: string): Promise<Project[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const projects = await getDocuments<FirestoreProject>(
    COLLECTIONS.PROJECTS,
    where("clientId", "==", clientId)
  );

  const results = await Promise.all(
    projects.map(async (project) => {
      const phases = await getProjectPhases(project.id);
      const mvpFeatures = await getProjectMVPFeatures(project.id);
      return toProject(project, phases, mvpFeatures);
    })
  );

  // Sort by createdAt descending
  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Get projects by status
export async function getProjectsByStatus(status: ProjectStatus): Promise<Project[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const projects = await getDocuments<FirestoreProject>(
    COLLECTIONS.PROJECTS,
    where("status", "==", status)
  );

  const results = await Promise.all(
    projects.map(async (project) => {
      const phases = await getProjectPhases(project.id);
      const mvpFeatures = await getProjectMVPFeatures(project.id);
      return toProject(project, phases, mvpFeatures);
    })
  );

  // Sort by createdAt descending
  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Get active projects count
export async function getActiveProjectsCount(): Promise<number> {
  const projects = await getDocuments<FirestoreProject>(
    COLLECTIONS.PROJECTS,
    where("status", "not-in", ["CLOSURE", "ON_HOLD"])
  );
  return projects.length;
}

// Create project with default phases
export async function createProject(
  data: Omit<Project, "id" | "createdAt" | "updatedAt" | "phases" | "mvpFeatures" | "progress">,
  mvpFeatureNames: string[] = []
): Promise<string> {
  const batch = writeBatch(db);

  // Create project document
  const projectRef = doc(collection(db, COLLECTIONS.PROJECTS));
  batch.set(projectRef, {
    ...data,
    startDate: Timestamp.fromDate(data.startDate),
    endDate: data.endDate ? Timestamp.fromDate(data.endDate) : null,
    progress: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Create default phases
  DEFAULT_PHASES.forEach((phaseName, index) => {
    const phaseRef = doc(collection(db, COLLECTIONS.PROJECT_PHASES));
    batch.set(phaseRef, {
      projectId: projectRef.id,
      name: phaseName,
      order: index + 1,
      status: index === 0 ? "in_progress" : "pending",
      createdAt: Timestamp.now(),
    });
  });

  // Create MVP features
  mvpFeatureNames.forEach((featureName) => {
    const mvpRef = doc(collection(db, COLLECTIONS.PROJECT_MVP));
    batch.set(mvpRef, {
      projectId: projectRef.id,
      name: featureName,
      isChecked: false,
      createdAt: Timestamp.now(),
    });
  });

  await batch.commit();
  return projectRef.id;
}

// Update project
export async function updateProject(
  projectId: string,
  data: Partial<Omit<Project, "id" | "createdAt" | "updatedAt" | "phases" | "mvpFeatures">>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...data };
  if (data.startDate) updateData.startDate = Timestamp.fromDate(data.startDate);
  if (data.endDate) updateData.endDate = Timestamp.fromDate(data.endDate);

  await updateDocument(COLLECTIONS.PROJECTS, projectId, updateData);
}

// Delete project (also deletes phases and MVP features)
export async function deleteProject(projectId: string): Promise<void> {
  const batch = writeBatch(db);

  // Delete project
  batch.delete(doc(db, COLLECTIONS.PROJECTS, projectId));

  // Delete phases
  const phases = await getDocuments<FirestorePhase>(
    COLLECTIONS.PROJECT_PHASES,
    where("projectId", "==", projectId)
  );
  phases.forEach((phase) => {
    batch.delete(doc(db, COLLECTIONS.PROJECT_PHASES, phase.id));
  });

  // Delete MVP features
  const mvpFeatures = await getDocuments<FirestoreMVP>(
    COLLECTIONS.PROJECT_MVP,
    where("projectId", "==", projectId)
  );
  mvpFeatures.forEach((mvp) => {
    batch.delete(doc(db, COLLECTIONS.PROJECT_MVP, mvp.id));
  });

  await batch.commit();
}

// Get project phases
export async function getProjectPhases(projectId: string): Promise<ProjectPhase[]> {
  // Fetch without orderBy to avoid needing composite index, sort in-memory
  const phases = await getDocuments<FirestorePhase>(
    COLLECTIONS.PROJECT_PHASES,
    where("projectId", "==", projectId)
  );

  return phases
    .map((phase) => ({
      ...phase,
      completedAt: phase.completedAt?.toDate(),
    }))
    .sort((a, b) => a.order - b.order);
}

// Update phase status
export async function updatePhaseStatus(
  phaseId: string,
  status: "pending" | "in_progress" | "completed"
): Promise<void> {
  const updateData: Record<string, unknown> = { status };
  if (status === "completed") {
    updateData.completedAt = Timestamp.now();
  }
  await updateDocument(COLLECTIONS.PROJECT_PHASES, phaseId, updateData);
}

// Get project MVP features
export async function getProjectMVPFeatures(projectId: string): Promise<ProjectMVP[]> {
  // Fetch without orderBy to avoid needing composite index, sort in-memory
  const mvpFeatures = await getDocuments<FirestoreMVP>(
    COLLECTIONS.PROJECT_MVP,
    where("projectId", "==", projectId)
  );

  return mvpFeatures
    .map((mvp) => ({
      ...mvp,
      createdAt: mvp.createdAt.toDate(),
    }))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

// Toggle MVP feature
export async function toggleMVPFeature(mvpId: string, isChecked: boolean): Promise<void> {
  await updateDocument(COLLECTIONS.PROJECT_MVP, mvpId, { isChecked });
}

// Add MVP feature to project
export async function addMVPFeature(projectId: string, name: string): Promise<string> {
  return createDocument(COLLECTIONS.PROJECT_MVP, {
    projectId,
    name,
    isChecked: false,
  });
}

// Calculate and update project progress
export async function updateProjectProgress(projectId: string): Promise<number> {
  const phases = await getProjectPhases(projectId);
  const mvpFeatures = await getProjectMVPFeatures(projectId);

  const completedPhases = phases.filter((p) => p.status === "completed").length;
  const checkedMVPs = mvpFeatures.filter((m) => m.isChecked).length;
  const totalItems = phases.length + mvpFeatures.length;
  const completedItems = completedPhases + checkedMVPs;

  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  await updateDocument(COLLECTIONS.PROJECTS, projectId, { progress });
  return progress;
}
