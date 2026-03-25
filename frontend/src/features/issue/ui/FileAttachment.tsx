import { FiFile, FiUploadCloud, FiX } from "react-icons/fi";

import { ATTACHMENT_FILE_INPUT_ACCEPT, ATTACHMENT_MAX_FILES, formatBytes } from "@shared/lib/media";
import { AttachmentUploadInfoPopover } from "@shared/ui/AttachmentUploadInfoPopover";
import { useFileValidation } from "@features/issue/lib/useFileValidation";

interface FileAttachmentProps {
  onFilesChange: (files: File[]) => void;
}

export function FileAttachment({ onFilesChange }: FileAttachmentProps) {
  const { files, error, isPreparingFiles, handleFiles, removeFile } = useFileValidation({
    maxFiles: ATTACHMENT_MAX_FILES,
    onFilesChange,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold capitalize tracking-wide text-neutral-400">
          {`File Attachment (Max ${ATTACHMENT_MAX_FILES} files)`}
        </label>
        <AttachmentUploadInfoPopover />
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFiles(event.dataTransfer.files);
        }}
        className="group relative cursor-pointer rounded-xl border-2 border-dashed border-white/5 bg-[#121620]/30 p-8 text-center transition-all hover:border-[#5671F6]/50 hover:bg-[#5671F6]/5"
      >
        <input
          type="file"
          multiple
          accept={ATTACHMENT_FILE_INPUT_ACCEPT}
          onChange={(event) => handleFiles(event.target.files)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <div className="flex flex-col items-center gap-2">
          <FiUploadCloud
            size={32}
            className="text-neutral-500 transition-colors group-hover:text-[#5671F6]"
          />
          <p className="text-sm text-neutral-400">
            Drag files here or <span className="font-medium text-[#5671F6]">browse</span> to
            upload images, videos, PDFs, logs, JSON, CSV, ZIP
          </p>
        </div>
      </div>

      {error ? <p className="text-xs font-medium text-rose-500">{error}</p> : null}
      {isPreparingFiles ? (
        <p className="text-xs font-medium text-sky-300">Optimizing selected media...</p>
      ) : null}

      {files.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2 rounded-lg border border-white/5 bg-[#1A1D24] px-3 py-2"
            >
              <FiFile size={14} className="text-neutral-500" />
              <span className="max-w-[150px] truncate text-xs text-white/90">{file.name}</span>
              <span className="text-[11px] text-neutral-500">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="ml-1 text-neutral-500 hover:text-rose-400"
              >
                <FiX size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
