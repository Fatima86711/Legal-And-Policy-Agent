// frontend/src/components/documents/DocumentList.jsx

import { useState } from "react";
import { deleteDocument } from "../../api/index";
import useChatStore from "../../store/chatStore";
// import { formatFileSize, truncateFilename, getFileIconColors } from "../../utils/helpers";

// ══════════════════════════════════════════════════════════════════════════════
// HELPER — Format file size from KB to a readable string
// ══════════════════════════════════════════════════════════════════════════════
function formatFileSize(kb) {
  if (!kb || kb === 0) return "Unknown size";
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}


// ══════════════════════════════════════════════════════════════════════════════
// HELPER — Truncate long filenames for display
// ══════════════════════════════════════════════════════════════════════════════
function truncateFilename(filename, maxLength = 28) {
  if (!filename) return "Unknown";
  if (filename.length <= maxLength) return filename;
  const ext   = filename.split(".").pop();
  const base  = filename.slice(0, maxLength - ext.length - 4);
  return `${base}...${ext}`;
}


// ══════════════════════════════════════════════════════════════════════════════
// HELPER — File type icon color
// ══════════════════════════════════════════════════════════════════════════════
function getFileIconColor(filename) {
  const ext = filename?.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "text-red-500 bg-red-50";
  if (ext === "txt") return "text-blue-500 bg-blue-50";
  return "text-gray-500 bg-gray-100";
}


// ══════════════════════════════════════════════════════════════════════════════
// FILE ICON
// ══════════════════════════════════════════════════════════════════════════════
function FileIcon({ filename }) {
  const colorClass = getFileIconColor(filename);

  return (
    <div
      className={`
        flex h-9 w-9 flex-shrink-0 items-center justify-center
        rounded-lg ${colorClass}
      `}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={1.8}
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
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// Shown when no documents are ingested yet
// ══════════════════════════════════════════════════════════════════════════════
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">

      {/* Icon */}
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <svg
          className="h-6 w-6 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0
               01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0
               00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1
               1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      </div>

      <p className="text-sm font-medium text-gray-600">
        No documents yet
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Upload a legal PDF or text file above to get started
      </p>

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// DELETE CONFIRMATION INLINE
// Appears inside the document card when delete is first clicked
// ══════════════════════════════════════════════════════════════════════════════
function DeleteConfirmation({ filename, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
      <p className="mb-2 text-xs text-red-700">
        Remove <span className="font-semibold">"{truncateFilename(filename, 22)}"</span> from
        the knowledge base? This cannot be undone.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="
            rounded-md bg-red-600 px-3 py-1 text-xs font-medium
            text-white transition-colors hover:bg-red-700
            disabled:cursor-not-allowed disabled:opacity-60
          "
        >
          {isDeleting ? "Removing..." : "Yes, remove"}
        </button>
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="
            rounded-md border border-gray-200 bg-white px-3 py-1
            text-xs font-medium text-gray-600 transition-colors
            hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60
          "
        >
          Cancel
        </button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT CARD
// A single document entry with metadata and delete action
// ══════════════════════════════════════════════════════════════════════════════
function DocumentCard({ doc, onDeleteSuccess }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting,       setIsDeleting]       = useState(false);
  const [deleteError,      setDeleteError]       = useState("");

  // ── Delete handler ────────────────────────────────────────────────────────
  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteDocument(doc.filename);
      onDeleteSuccess(doc.filename);
    } catch (err) {
      setDeleteError(err.message || "Failed to delete document.");
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div
      className="
        rounded-xl border border-gray-200 bg-white p-3
        transition-shadow hover:shadow-sm
      "
    >
      {/* ── Top row — icon + filename + delete button ─────────────────────── */}
      <div className="flex items-start gap-3">

        {/* File icon */}
        <FileIcon filename={doc.filename} />

        {/* Document info */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium text-gray-800"
            title={doc.filename}
          >
            {truncateFilename(doc.filename)}
          </p>

          {/* Metadata row */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">

            {/* Chunk count */}
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2
                     0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5
                     11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012
                     2v2M7 7h10"
                />
              </svg>
              {doc.chunk_count} chunk{doc.chunk_count !== 1 ? "s" : ""}
            </span>

            {/* Separator dot */}
            <span className="text-xs text-gray-300">·</span>

            {/* File size */}
            <span className="text-xs text-gray-400">
              {formatFileSize(doc.file_size_kb)}
            </span>

          </div>
        </div>

        {/* Delete trigger button */}
        {!confirmingDelete && (
          <button
            onClick={() => {
              setConfirmingDelete(true);
              setDeleteError("");
            }}
            aria-label={`Delete ${doc.filename}`}
            className="
              ml-1 flex h-7 w-7 flex-shrink-0 items-center justify-center
              rounded-lg text-gray-400 transition-colors
              hover:bg-red-50 hover:text-red-500
            "
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0
                   01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0
                   00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}

      </div>

      {/* ── Inline delete confirmation ─────────────────────────────────────── */}
      {confirmingDelete && (
        <DeleteConfirmation
          filename={doc.filename}
          onConfirm={handleDelete}
          onCancel={() => {
            setConfirmingDelete(false);
            setDeleteError("");
          }}
          isDeleting={isDeleting}
        />
      )}

      {/* ── Delete error message ───────────────────────────────────────────── */}
      {deleteError && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">
          {deleteError}
        </p>
      )}

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT LIST HEADER
// Shows document count and a clear-all option when multiple docs exist
// ══════════════════════════════════════════════════════════════════════════════
function DocumentListHeader({ count }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <span className="text-xs font-medium text-gray-500">
        Knowledge Base
      </span>
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
        {count} {count === 1 ? "doc" : "docs"}
      </span>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN DOCUMENT LIST COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function DocumentList({ documents = [], onDocumentDeleted }) {

  // ── Read removeDocument action from store ─────────────────────────────────
  const removeDocument = useChatStore((s) => s.removeDocument);

  // ── Handle successful deletion ────────────────────────────────────────────
  function handleDeleteSuccess(filename) {
    removeDocument(filename);
    if (onDocumentDeleted) onDocumentDeleted(filename);
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!documents || documents.length === 0) {
    return <EmptyState />;
  }

  // ── Document list ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2">

      {/* Header with count */}
      <DocumentListHeader count={documents.length} />

      {/* Document cards */}
      {documents.map((doc) => (
        <DocumentCard
          key={doc.filename}
          doc={doc}
          onDeleteSuccess={handleDeleteSuccess}
        />
      ))}

    </div>
  );
}