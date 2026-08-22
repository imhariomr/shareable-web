"use client"
import { useCallback, useState } from "react"
import { X } from "lucide-react"
import { Button } from "./button"
import { formatFileSize } from "@/lib/file-utils"

export default function ShareDropzone({ onShare }: { onShare: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false)
  const [staged, setStaged] = useState<File[]>([])

  const addFiles = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return
    setStaged((prev) => [...prev, ...Array.from(list)])
  }, [])

  const removeStaged = (index: number) => setStaged((prev) => prev.filter((_, i) => i !== index))

  const share = () => {
    if (staged.length === 0) return
    onShare(staged)
    setStaged([])
  }

  return (
    <div
      onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      className={`rounded-2xl border p-6 shadow-sm space-y-4 transition-colors
        ${dragging
          ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-slate-900"
          : "border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900"
        }`}
    >
      <h2 className="text-lg font-semibold">Share files</h2>

      <label
        htmlFor="sendvia-file-picker"
        className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer
          border-gray-300 dark:border-slate-700 hover:border-slate-400 transition-colors text-gray-500 gap-1"
      >
        <input
          id="sendvia-file-picker"
          multiple
          type="file"
          className="sr-only"
          onChange={(e) => { addFiles(e.target.files); e.target.value = "" }}
        />
        <span className="font-medium">Drop files here</span>
        <span className="text-sm">or click to browse</span>
      </label>

      {staged.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-800 text-sm">
          {staged.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center gap-2 px-3 py-2">
              <span className="truncate flex-1">{file.name}</span>
              <span className="text-xs text-gray-400 shrink-0">{formatFileSize(file.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name} from selection`}
                onClick={() => removeStaged(i)}
                className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" className="w-full" disabled={staged.length === 0} onClick={share}>
        {staged.length === 0 ? "Select files to share" : `Share ${staged.length} file${staged.length > 1 ? "s" : ""}`}
      </Button>
    </div>
  )
}
