import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SETTINGS,
  type AlignmentInfo,
  type PhotoEntry,
  type Project,
  type ProjectMode,
  type ProjectSettings,
  type VideoFormat,
  type ViewAngle,
} from '../types';
import type { SimilarityTransform } from '../lib/geometry/similarity';
import { makeId } from '../lib/id';
import { deleteProjectFiles } from '../lib/storage/photos';

interface ProjectsState {
  projects: Project[];
  createProject: (name: string, mode: ProjectMode, format: VideoFormat) => Project;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  updateSettings: (id: string, patch: Partial<ProjectSettings>) => void;

  addPhoto: (
    projectId: string,
    photo: Omit<PhotoEntry, 'id' | 'addedAt' | 'sortKey' | 'status'> & { auto?: AlignmentInfo }
  ) => PhotoEntry;
  setAuto: (projectId: string, photoId: string, auto: AlignmentInfo) => void;
  setManualTransform: (projectId: string, photoId: string, t: SimilarityTransform | null) => void;
  setPhotoDate: (projectId: string, photoId: string, iso: string) => void;
  setPhotoView: (projectId: string, photoId: string, view: ViewAngle) => void;
  replacePhotoImage: (
    projectId: string,
    photoId: string,
    file: { uri: string; width: number; height: number }
  ) => void;
  duplicatePhoto: (projectId: string, photoId: string) => void;
  removePhoto: (projectId: string, photoId: string) => void;
  movePhoto: (projectId: string, photoId: string, direction: -1 | 1) => void;
}

function touch(p: Project): Project {
  return { ...p, updatedAt: new Date().toISOString() };
}

function statusFor(photo: Pick<PhotoEntry, 'auto' | 'manual'>): PhotoEntry['status'] {
  if (photo.manual) return 'manual';
  if (!photo.auto) return 'pending';
  return photo.auto.flagged ? 'flagged' : 'aligned';
}

export function sortedPhotos(project: Project, view: ViewAngle): PhotoEntry[] {
  return project.photos
    .filter((p) => p.view === view)
    .sort((a, b) => a.sortKey - b.sortKey || a.addedAt.localeCompare(b.addedAt));
}

export const useProjects = create<ProjectsState>()(
  persist(
    (set, get) => {
      const patchProject = (id: string, fn: (p: Project) => Project) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? touch(fn(p)) : p)),
        }));

      const patchPhoto = (projectId: string, photoId: string, fn: (ph: PhotoEntry) => PhotoEntry) =>
        patchProject(projectId, (p) => ({
          ...p,
          photos: p.photos.map((ph) => (ph.id === photoId ? fn(ph) : ph)),
        }));

      return {
        projects: [],

        createProject: (name, mode, format) => {
          const now = new Date().toISOString();
          const project: Project = {
            id: makeId(),
            name: name.trim() || 'My ThenNow',
            mode,
            format,
            createdAt: now,
            updatedAt: now,
            photos: [],
            settings: { ...DEFAULT_SETTINGS },
          };
          set((s) => ({ projects: [project, ...s.projects] }));
          return project;
        },

        renameProject: (id, name) =>
          patchProject(id, (p) => ({ ...p, name: name.trim() || p.name })),

        deleteProject: (id) => {
          set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
          deleteProjectFiles(id).catch(() => {});
        },

        updateSettings: (id, patch) =>
          patchProject(id, (p) => ({ ...p, settings: { ...p.settings, ...patch } })),

        addPhoto: (projectId, photo) => {
          const entry: PhotoEntry = {
            ...photo,
            id: makeId(),
            addedAt: new Date().toISOString(),
            sortKey: Date.parse(photo.capturedAt) || Date.now(),
            status: statusFor(photo),
          };
          patchProject(projectId, (p) => ({ ...p, photos: [...p.photos, entry] }));
          return entry;
        },

        setAuto: (projectId, photoId, auto) =>
          patchPhoto(projectId, photoId, (ph) => ({
            ...ph,
            auto,
            status: statusFor({ auto, manual: ph.manual }),
          })),

        setManualTransform: (projectId, photoId, t) =>
          patchPhoto(projectId, photoId, (ph) => ({
            ...ph,
            manual: t ?? undefined,
            status: statusFor({ auto: ph.auto, manual: t ?? undefined }),
          })),

        setPhotoDate: (projectId, photoId, iso) =>
          patchPhoto(projectId, photoId, (ph) => ({
            ...ph,
            capturedAt: iso,
            sortKey: Date.parse(iso) || ph.sortKey,
          })),

        setPhotoView: (projectId, photoId, view) =>
          patchPhoto(projectId, photoId, (ph) => ({ ...ph, view })),

        replacePhotoImage: (projectId, photoId, file) =>
          patchPhoto(projectId, photoId, (ph) => ({
            ...ph,
            uri: file.uri,
            width: file.width,
            height: file.height,
            auto: undefined,
            manual: undefined,
            status: 'pending',
          })),

        duplicatePhoto: (projectId, photoId) =>
          patchProject(projectId, (p) => {
            const src = p.photos.find((ph) => ph.id === photoId);
            if (!src) return p;
            const copy: PhotoEntry = {
              ...src,
              id: makeId(),
              addedAt: new Date().toISOString(),
              sortKey: src.sortKey + 1,
            };
            return { ...p, photos: [...p.photos, copy] };
          }),

        removePhoto: (projectId, photoId) =>
          patchProject(projectId, (p) => ({
            ...p,
            photos: p.photos.filter((ph) => ph.id !== photoId),
          })),

        movePhoto: (projectId, photoId, direction) =>
          patchProject(projectId, (p) => {
            const photo = p.photos.find((ph) => ph.id === photoId);
            if (!photo) return p;
            const line = sortedPhotos(p, photo.view);
            const idx = line.findIndex((ph) => ph.id === photoId);
            const swapWith = line[idx + direction];
            if (!swapWith) return p;
            return {
              ...p,
              photos: p.photos.map((ph) => {
                if (ph.id === photo.id) return { ...ph, sortKey: swapWith.sortKey };
                if (ph.id === swapWith.id) return { ...ph, sortKey: photo.sortKey };
                return ph;
              }),
            };
          }),
      };
    },
    {
      name: 'thennow-projects',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);

export function useProject(id: string | undefined): Project | undefined {
  return useProjects((s) => s.projects.find((p) => p.id === id));
}
