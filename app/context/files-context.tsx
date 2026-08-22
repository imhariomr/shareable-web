"use client"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  clearAllPersistedFiles,
  deletePersistedFile,
  getAllPersistedMeta,
  getPersistedBlob,
  saveReceivedFile,
  type PersistedFileMeta,
} from "@/lib/indexed-db";

export type TransferDirection = "outgoing" | "incoming";
export type TransferStatus = "pending" | "transferring" | "completed" | "failed" | "cancelled";

export interface TransferFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  direction: TransferDirection;
  status: TransferStatus;
  progress: number;
  createdAt: number;
  persisted: boolean;
  error?: string;
}

interface FilesContextValue {
  files: TransferFile[];
  upsertFile: (patch: Partial<TransferFile> & { id: string }) => void;
  removeFile: (id: string) => void;
  markInterrupted: () => void;
  persistIncomingBlob: (meta: PersistedFileMeta, blob: Blob) => Promise<void>;
  downloadFile: (id: string) => Promise<void>;
  deleteIncomingFile: (id: string) => Promise<void>;
  clearAllIncoming: () => Promise<void>;
}

const FilesContext = createContext<FilesContextValue | null>(null);

export const FilesProvider = ({ children }: { children: React.ReactNode }) => {
  const [files, setFiles] = useState<TransferFile[]>([]);
  const filesRef = useRef<TransferFile[]>([]);
  const blobsRef = useRef<Map<string, Blob>>(new Map());

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    (async () => {
      try {
        const persisted = await getAllPersistedMeta();
        if (!persisted.length) return;
        setFiles((prev) => {
          const existingIds = new Set(prev.map((f) => f.id));
          const restored: TransferFile[] = persisted
            .filter((m) => !existingIds.has(m.id))
            .map((m) => ({
              id: m.id,
              name: m.name,
              size: m.size,
              mimeType: m.mimeType,
              direction: "incoming",
              status: "completed",
              progress: 100,
              createdAt: m.createdAt,
              persisted: true,
            }));
          return [...restored, ...prev];
        });
      } catch {
        // IndexedDB unavailable (e.g. private browsing) — received files just won't survive a refresh.
      }
    })();
  }, []);

  const upsertFile = useCallback((patch: Partial<TransferFile> & { id: string }) => {
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f.id === patch.id);
      if (idx === -1) {
        return [
          ...prev,
          {
            direction: "outgoing",
            status: "pending",
            progress: 0,
            persisted: false,
            mimeType: "application/octet-stream",
            size: 0,
            name: "file",
            createdAt: Date.now(),
            ...patch,
          } as TransferFile,
        ];
      }
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    blobsRef.current.delete(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const markInterrupted = useCallback(() => {
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "pending" || f.status === "transferring"
          ? { ...f, status: "failed", error: "Connection lost during transfer" }
          : f
      )
    );
  }, []);

  const persistIncomingBlob = useCallback(async (meta: PersistedFileMeta, blob: Blob) => {
    blobsRef.current.set(meta.id, blob);
    try {
      await saveReceivedFile(meta, blob);
      upsertFile({ id: meta.id, persisted: true });
    } catch {
      toast.warning(`"${meta.name}" couldn't be saved for later — download it before disconnecting.`);
    }
  }, [upsertFile]);

  const downloadFile = useCallback(async (id: string) => {
    const file = filesRef.current.find((f) => f.id === id);
    if (!file || file.status !== "completed") return;
    let blob = blobsRef.current.get(id);
    if (!blob) {
      try {
        blob = await getPersistedBlob(id);
      } catch {
        // fall through to the "not available" error below
      }
    }
    if (!blob) {
      toast.error(`"${file.name}" is no longer available on this device.`);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, []);

  const deleteIncomingFile = useCallback(async (id: string) => {
    blobsRef.current.delete(id);
    try {
      await deletePersistedFile(id);
    } catch {
      // best effort — still remove from the visible list below
    }
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearAllIncoming = useCallback(async () => {
    filesRef.current.filter((f) => f.direction === "incoming").forEach((f) => blobsRef.current.delete(f.id));
    try {
      await clearAllPersistedFiles();
    } catch {
      // best effort — still clear from the visible list below
    }
    setFiles((prev) => prev.filter((f) => f.direction !== "incoming"));
  }, []);

  return (
    <FilesContext.Provider
      value={{
        files,
        upsertFile,
        removeFile,
        markInterrupted,
        persistIncomingBlob,
        downloadFile,
        deleteIncomingFile,
        clearAllIncoming,
      }}
    >
      {children}
    </FilesContext.Provider>
  );
};

export const useFiles = () => {
  const ctx = useContext(FilesContext);
  if (!ctx) throw new Error("useFiles must be used within a FilesProvider");
  return ctx;
};
