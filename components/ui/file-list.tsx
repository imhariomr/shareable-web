"use client"
import {
  Download,
  X,
  Trash2,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  File as FileIcon,
} from "lucide-react"
import { Button } from "./button"
import { formatFileSize } from "@/lib/file-utils"
import type { TransferFile } from "@/app/context/files-context"

function iconFor(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage
  if (mimeType.startsWith("video/")) return FileVideo
  if (mimeType.startsWith("audio/")) return FileAudio
  if (mimeType.includes("zip") || mimeType.includes("compressed") || mimeType.includes("tar")) return FileArchive
  if (mimeType.startsWith("text/") || mimeType.includes("pdf")) return FileText
  return FileIcon
}

const STATUS_LABEL: Record<TransferFile["status"], string> = {
  pending: "Queued",
  transferring: "Transferring",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
}

interface FileListProps {
  files: TransferFile[]
  onDownload: (id: string) => void
  onDeleteIncoming: (id: string) => void
  onCancelOutgoing: (id: string) => void
  onClearIncoming: () => void
  hasClearableIncoming: boolean
}

export default function FileList({
  files,
  onDownload,
  onDeleteIncoming,
  onCancelOutgoing,
  onClearIncoming,
  hasClearableIncoming,
}: FileListProps) {
  const sorted = [...files].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Files</h2>
        {hasClearableIncoming && (
          <button
            type="button"
            onClick={onClearIncoming}
            className="text-xs font-medium text-gray-500 hover:text-red-500 transition-colors underline-offset-2 hover:underline"
          >
            Clear shared files
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="flex items-center justify-center h-32 text-sm text-gray-400 border-2 border-dashed rounded-xl border-gray-200 dark:border-slate-700">
          No files shared yet
        </p>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto">
          {sorted.map((file) => {
            const Icon = iconFor(file.mimeType)
            return (
              <li
                key={file.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60 px-3 py-2.5"
              >
                <Icon className="shrink-0 text-gray-400" size={20} aria-hidden="true" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{file.name}</span>
                    <span
                      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5
                        ${file.direction === "incoming"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                    >
                      {file.direction === "incoming" ? "Received" : "Sent"}
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <span>{formatFileSize(file.size)}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        file.status === "failed"
                          ? "text-red-500"
                          : file.status === "completed"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : ""
                      }
                    >
                      {file.status === "transferring" ? `${STATUS_LABEL.transferring} ${file.progress}%` : STATUS_LABEL[file.status]}
                    </span>
                  </div>

                  {file.status === "transferring" && (
                    <div
                      className="mt-1.5 h-1.5 w-full rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={file.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${file.name} transfer progress`}
                    >
                      <div
                        className="h-full rounded-full bg-slate-900 dark:bg-white transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}

                  {file.error && <p className="mt-1 text-xs text-red-500">{file.error}</p>}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {file.direction === "incoming" && file.status === "completed" && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label={`Download ${file.name}`}
                      onClick={() => onDownload(file.id)}
                    >
                      <Download size={14} />
                    </Button>
                  )}
                  {file.direction === "outgoing" && (file.status === "pending" || file.status === "transferring") && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Cancel sharing ${file.name}`}
                      onClick={() => onCancelOutgoing(file.id)}
                    >
                      <X size={14} />
                    </Button>
                  )}
                  {file.direction === "incoming" && file.status !== "transferring" && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${file.name} from this device`}
                      onClick={() => onDeleteIncoming(file.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
