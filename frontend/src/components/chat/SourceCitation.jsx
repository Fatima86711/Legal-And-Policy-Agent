// frontend/src/components/chat/SourceCitation.jsx
// import { getFilename, getFileTypeLabel, getFileIconColors } from "../../utils/helpers";

// ══════════════════════════════════════════════════════════════════════════════
// HELPER — Strip directory path and return only the filename
// ══════════════════════════════════════════════════════════════════════════════
function getFilename(source) {
  if (!source) return "Unknown Source";
  return source.split(/[\\/]/).pop() || source;
}


// ══════════════════════════════════════════════════════════════════════════════
// HELPER — Derive a file type label from the extension
// ══════════════════════════════════════════════════════════════════════════════
function getFileTypeLabel(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf")  return "PDF";
  if (ext === "txt")  return "TXT";
  return "DOC";
}


// ══════════════════════════════════════════════════════════════════════════════
// HELPER — Derive icon color class based on file type
// ══════════════════════════════════════════════════════════════════════════════
function getFileTypeColor(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "text-red-500";
  if (ext === "txt") return "text-blue-500";
  return "text-gray-500";
}


// ══════════════════════════════════════════════════════════════════════════════
// FILE ICON — SVG document icon
// ══════════════════════════════════════════════════════════════════════════════
function FileIcon({ colorClass }) {
  return (
    <svg
      className={`h-3 w-3 flex-shrink-0 ${colorClass}`}
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
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SINGLE SOURCE PILL
// Renders one source document as a labeled pill tag
// ══════════════════════════════════════════════════════════════════════════════
function SourcePill({ source, index }) {
  const filename  = getFilename(source);
  const typeLabel = getFileTypeLabel(filename);
  const iconColor = getFileTypeColor(filename);

  return (
    <span
      className="
        inline-flex items-center gap-1.5 rounded-full border
        border-gray-200 bg-gray-50 px-2.5 py-1
        text-xs text-gray-600 transition-colors
        hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700
      "
      title={source}
    >
      {/* Source index number */}
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600">
        {index + 1}
      </span>

      {/* File icon */}
      <FileIcon colorClass={iconColor} />

      {/* Filename — truncated if too long */}
      <span className="max-w-[160px] truncate font-medium">
        {filename}
      </span>

      {/* File type badge */}
      <span className="rounded bg-gray-200 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {typeLabel}
      </span>
    </span>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN SOURCE CITATION COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SourceCitation({ sources }) {

  // ── Guard — render nothing if no sources ──────────────────────────────────
  if (!sources || sources.length === 0) return null;

  // ── Deduplicate sources in case the same file appears twice ───────────────
  const uniqueSources = [...new Set(sources)];

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">

      {/* ── Section label ──────────────────────────────────────────────────── */}
      <div className="mb-2 flex items-center gap-1.5">
        {/* Chain link icon */}
        <svg
          className="h-3 w-3 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656
               5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4
               a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>

        <span className="text-xs font-medium text-gray-400">
          {uniqueSources.length === 1
            ? "Source document"
            : `Source documents (${uniqueSources.length})`}
        </span>
      </div>

      {/* ── Source pills ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {uniqueSources.map((source, index) => (
          <SourcePill
            key={`${source}-${index}`}
            source={source}
            index={index}
          />
        ))}
      </div>

    </div>
  );
}