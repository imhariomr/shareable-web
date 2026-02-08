"use client"
import { UseUploadingFiles } from "@/app/context/uploading-file-context";
import { useState } from "react";
import { ShowTooltipInContent } from "./tooltip-content";

export default function FileUpload({ onFiles,isShared,isSharing,progress }: any) {
    const [dragging, setDragging] = useState(false);
    const [files, setFiles] = useState<File[]>([]);

    const handleFiles = (evt: any) => {
        setFiles(Array.from(evt));
    };

    const onDrop = (evt: any) => {
        evt.preventDefault();
        setDragging(false);
        handleFiles(evt.dataTransfer.files);
    };

    const onDragOver = (e: any) => {
        e.preventDefault();
        setDragging(true);
    };

    // const onDragLeave = () => {
    //     setDragging(false);
    // };

    const sendFiles = ()=>{
        onFiles?.(files);
    }

   return (
  <div
    onDrop={onDrop}
    onDragOver={onDragOver}
    className={`rounded-2xl border p-6 shadow-md space-y-5 transition
      ${dragging
        ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-slate-900"
        : "border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      }`}
  >
    {/* Title */}
    <h3 className="text-xl font-semibold">Transfer Files</h3>

    {/* Dropzone */}
    <label
      className="flex flex-col items-center justify-center h-36 border-2 border-dashed rounded-xl cursor-pointer
      border-gray-300 dark:border-slate-700 hover:border-slate-400
      transition text-gray-500"
    >
      <input
        multiple
        type="file"
        className="hidden"
        onChange={(evt) => handleFiles(evt.target.files)}
      />

      <div className="font-medium">Drop files here</div>
      <div className="text-sm">or click to browse</div>
    </label>

    {/* File List */}
    {files.length > 0 && (
      <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-700 p-3 space-y-2 text-sm">
        {files.map((file: any, i: number) => (
          <div
            key={i}
            className="flex items-center gap-2 truncate bg-gray-50 dark:bg-slate-800 px-3 py-2 rounded-md"
          >
            <span>📄</span>
            <span className="truncate flex-1">{file.name}</span>
          </div>
        ))}
      </div>
    )}

    <ShowTooltipInContent mainContent={isSharing ? "Sharing..." : 'Tap To Share'} toolTipContent={files.length === 0 ? 'Add Files To Share' : ''}
    className={'w-full rounded-xl py-3 text-center font-medium transition bg-slate-900 text-white dark:bg-white dark:text-black'}
    useButton={false} disabled={files.length === 0 || isSharing} onClick={sendFiles} progress={progress} entity='fileUpload'/>
  </div>
);

}
