// frontend/src/components/documents/DocumentUpload.jsx

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { uploadDocument } from "../../api/index";
import useChatStore from "../../store/chatStore";


// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════
const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "text/plain":      [".txt"],
};

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB — matches backend config
const MAX_SIZE_LABEL = "20MB";


// ══════════════════════════════════════════════════════════════════════════════
// HELPER — Format bytes to readable size string
// ══════════════════════════════════════════════════════════════════════════════
function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}


// ══════════════════════════════════════════════════════════════════════════════
// UPLOAD STATES — all possible states the upload zone can be in
// ══════════════════════════════════════════════════════════════════════════════
const STATE = {
  IDLE:      "idle",       // Default — waiting for file
  UPLOADING: "uploading",  // File accepted, API call in progress
  SUCCESS:   "success",    // Upload and ingestion completed
  ERROR:     "error",      // Upload or ingestion failed
};


// ══════════════════════════════════════════════════════════════════════════════
// UPLOAD PROGRESS STAGES
// Shown sequentially during the uploading state to keep user informed
// ══════════════════════════════════════════════════════════════════════════════
const PROGRESS_STAGES = [
  { label: "Uploading file...",       duration: 800  },
  { label: "Extracting text...",      duration: 2000 },
  { label: "Chunking document...",    duration: 1500 },
  { label: "Generating embeddings...", duration: 3000 },
  { label: "Storing in knowledge base...", duration: 1000 },
];


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — Idle Zone Content
// Default state — shown when no file is being processed
// ══════════════════════════════════════════════════════════════════════════════
function IdleZoneContent({ isDragActive }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 px-4 text-center">

      {/* Upload icon */}
      <div
        className={`
          flex h-11 w-11 items-center justify-center rounded-full transition-colors
          ${isDragActive ? "bg-blue-100" : "bg-gray-100"}
        `}
      >
        <svg
          className={`h-5 w-5 transition-colors ${isDragActive ? "text-blue-600" : "text-gray-400"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0
               011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </div>

      {/* Primary text */}
      <div>
        <p className={`text-sm font-medium transition-colors ${isDragActive ? "text-blue-600" : "text-gray-700"}`}>
          {isDragActive ? "Drop your file here" : "Upload a legal document"}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          Drag & drop or{" "}
          <span className="font-medium text-blue-500 underline underline-offset-2">
            browse files
          </span>
        </p>
      </div>

      {/* Accepted formats */}
      <div className="flex items-center gap-1.5">
        <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          PDF
        </span>
        <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          TXT
        </span>
        <span className="text-xs text-gray-400">· Max {MAX_SIZE_LABEL}</span>
      </div>

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — Uploading Zone Content
// Shown while the API call is in progress
// ══════════════════════════════════════════════════════════════════════════════
function UploadingZoneContent({ filename, fileSize, stageLabel }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6 px-4 text-center">

      {/* Animated spinner */}
      <div className="relative flex h-11 w-11 items-center justify-center">
        <svg
          className="absolute h-11 w-11 animate-spin text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-20"
            cx="12" cy="12" r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-80"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        {/* Document icon in center */}
        <svg
          className="relative h-4 w-4 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586
               a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19
               a2 2 0 01-2 2z"
          />
        </svg>
      </div>

      {/* File info */}
      <div>
        <p className="max-w-[180px] truncate text-sm font-medium text-gray-700">
          {filename}
        </p>
        <p className="text-xs text-gray-400">{fileSize}</p>
      </div>

      {/* Current stage label */}
      <div className="flex items-center gap-1.5">
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: "300ms" }} />
        </span>
        <p className="text-xs font-medium text-blue-600">{stageLabel}</p>
      </div>

      <p className="text-xs text-gray-400">
        Please wait — this may take a moment for large documents
      </p>

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — Success Zone Content
// Shown after successful ingestion
// ══════════════════════════════════════════════════════════════════════════════
function SuccessZoneContent({ filename, chunksStored, onUploadAnother }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 px-4 text-center">

      {/* Success icon */}
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-5 w-5 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      {/* Success message */}
      <div>
        <p className="text-sm font-medium text-green-700">
          Document ingested successfully
        </p>
        <p className="mt-0.5 max-w-[180px] truncate text-xs text-gray-500">
          {filename}
        </p>
      </div>

      {/* Chunks stored badge */}
      <div className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1">
        <svg
          className="h-3 w-3 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0
               01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9
               a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <span className="text-xs font-medium text-green-700">
          {chunksStored} chunk{chunksStored !== 1 ? "s" : ""} stored in knowledge base
        </span>
      </div>

      {/* Upload another button */}
      <button
        onClick={onUploadAnother}
        className="
          mt-1 rounded-lg border border-gray-200 px-3 py-1.5
          text-xs font-medium text-gray-600 transition-colors
          hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600
        "
      >
        Upload another document
      </button>

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — Error Zone Content
// Shown when upload or ingestion fails
// ══════════════════════════════════════════════════════════════════════════════
function ErrorZoneContent({ filename, errorMessage, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 px-4 text-center">

      {/* Error icon */}
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
        <svg
          className="h-5 w-5 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      {/* Error heading */}
      <div>
        <p className="text-sm font-medium text-red-700">
          Upload failed
        </p>
        {filename && (
          <p className="mt-0.5 max-w-[180px] truncate text-xs text-gray-500">
            {filename}
          </p>
        )}
      </div>

      {/* Error detail */}
      <p className="max-w-[200px] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
        {errorMessage}
      </p>

      {/* Retry button */}
      <button
        onClick={onRetry}
        className="
          rounded-lg border border-gray-200 px-3 py-1.5
          text-xs font-medium text-gray-600 transition-colors
          hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600
        "
      >
        Try again
      </button>

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — Rejected File Message
// Shown briefly when a file fails dropzone validation
// ══════════════════════════════════════════════════════════════════════════════
function RejectionMessage({ rejections }) {
  if (!rejections || rejections.length === 0) return null;

  const firstRejection = rejections[0];
  const firstError     = firstRejection?.errors?.[0];

  let message = "File not accepted.";

  if (firstError?.code === "file-too-large") {
    message = `File is too large. Maximum size is ${MAX_SIZE_LABEL}.`;
  } else if (firstError?.code === "file-invalid-type") {
    message = "Only PDF and plain text (.txt) files are accepted.";
  } else if (firstError?.message) {
    message = firstError.message;
  }

  return (
    <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
      <svg
        className="mt-0.5 h-3 w-3 flex-shrink-0 text-red-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <p className="text-xs text-red-600">{message}</p>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN DOCUMENT UPLOAD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function DocumentUpload({ onUploadSuccess }) {

  // ── Local state ───────────────────────────────────────────────────────────
  const [uploadState,   setUploadState]   = useState(STATE.IDLE);
  const [currentFile,   setCurrentFile]   = useState(null);
  const [errorMessage,  setErrorMessage]  = useState("");
  const [chunksStored,  setChunksStored]  = useState(0);
  const [stageIndex,    setStageIndex]    = useState(0);
  const [rejectedFiles, setRejectedFiles] = useState([]);

  // ── Store ─────────────────────────────────────────────────────────────────
  const addDocument    = useChatStore((s) => s.addDocument);
  const setIsUploading = useChatStore((s) => s.setIsUploading);

  // ── Stage label derived from stageIndex ───────────────────────────────────
  const stageLabel = PROGRESS_STAGES[stageIndex]?.label || "Processing...";


  // ══════════════════════════════════════════════════════════════════════════
  // STAGE PROGRESSION DURING UPLOAD
  // Advances through PROGRESS_STAGES sequentially while the API call runs
  // Gives the user visibility into what is happening during a long ingestion
  // ══════════════════════════════════════════════════════════════════════════
  function startStageProgression() {
    let index = 0;
    setStageIndex(0);

    function advance() {
      index += 1;
      if (index < PROGRESS_STAGES.length) {
        setStageIndex(index);
        setTimeout(advance, PROGRESS_STAGES[index].duration);
      }
    }

    setTimeout(advance, PROGRESS_STAGES[0].duration);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // FILE DROP HANDLER
  // Called by react-dropzone when a valid file is dropped or selected
  // ══════════════════════════════════════════════════════════════════════════
  const onDrop = useCallback(
    async (acceptedFiles, rejections) => {
      // ── Clear previous rejection messages ──────────────────────────────
      setRejectedFiles(rejections);

      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];

      // ── Transition to uploading state ──────────────────────────────────
      setCurrentFile(file);
      setUploadState(STATE.UPLOADING);
      setErrorMessage("");
      setIsUploading(true);
      startStageProgression();

      // ── Call upload API ────────────────────────────────────────────────
      try {
        const result = await uploadDocument(file);

        // ── Success ──────────────────────────────────────────────────────
        setChunksStored(result.chunks_stored || 0);
        setUploadState(STATE.SUCCESS);

        // Update global store so DocumentList re-renders immediately
        addDocument({
          filename:     result.filename,
          chunk_count:  result.chunks_stored,
          file_size_kb: parseFloat((file.size / 1024).toFixed(2)),
          source:       `data/raw/${result.filename}`,
        });

        // Notify parent (Sidebar) so it can refresh stats
        if (onUploadSuccess) onUploadSuccess(result);

      } catch (err) {
        // ── Failure ──────────────────────────────────────────────────────
        setErrorMessage(err.message || "Upload failed. Please try again.");
        setUploadState(STATE.ERROR);

      } finally {
        setIsUploading(false);
      }
    },
    [addDocument, setIsUploading, onUploadSuccess]
  );


  // ══════════════════════════════════════════════════════════════════════════
  // RESET — go back to idle state
  // ══════════════════════════════════════════════════════════════════════════
  function resetToIdle() {
    setUploadState(STATE.IDLE);
    setCurrentFile(null);
    setErrorMessage("");
    setChunksStored(0);
    setStageIndex(0);
    setRejectedFiles([]);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // DROPZONE CONFIG
  // ══════════════════════════════════════════════════════════════════════════
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept:         ACCEPTED_TYPES,
    maxSize:        MAX_SIZE_BYTES,
    maxFiles:       1,
    multiple:       false,
    // Disable dropzone interaction while uploading or showing result
    disabled: uploadState === STATE.UPLOADING,
  });


  // ══════════════════════════════════════════════════════════════════════════
  // ZONE BORDER STYLE — changes based on state and drag status
  // ══════════════════════════════════════════════════════════════════════════
  function getZoneBorderClass() {
    if (uploadState === STATE.UPLOADING) return "border-blue-300 bg-blue-50";
    if (uploadState === STATE.SUCCESS)   return "border-green-300 bg-green-50";
    if (uploadState === STATE.ERROR)     return "border-red-300 bg-red-50";
    if (isDragReject)                    return "border-red-400 bg-red-50";
    if (isDragActive)                    return "border-blue-400 bg-blue-50";
    return "border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50";
  }


  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full">

      {/* ── Drop zone ───────────────────────────────────────────────────── */}
      <div
        {...getRootProps()}
        className={`
          cursor-pointer rounded-xl border-2 border-dashed
          transition-all duration-200
          ${getZoneBorderClass()}
          ${uploadState === STATE.UPLOADING ? "cursor-not-allowed" : ""}
        `}
      >
        <input {...getInputProps()} />

        {/* Render correct content based on current state */}
        {uploadState === STATE.IDLE && (
          <IdleZoneContent isDragActive={isDragActive} />
        )}

        {uploadState === STATE.UPLOADING && (
          <UploadingZoneContent
            filename={currentFile?.name || ""}
            fileSize={formatBytes(currentFile?.size)}
            stageLabel={stageLabel}
          />
        )}

        {uploadState === STATE.SUCCESS && (
          <SuccessZoneContent
            filename={currentFile?.name || ""}
            chunksStored={chunksStored}
            onUploadAnother={resetToIdle}
          />
        )}

        {uploadState === STATE.ERROR && (
          <ErrorZoneContent
            filename={currentFile?.name || ""}
            errorMessage={errorMessage}
            onRetry={resetToIdle}
          />
        )}

      </div>

      {/* ── Rejected file message (outside drop zone) ────────────────────── */}
      <RejectionMessage rejections={rejectedFiles} />

    </div>
  );
}