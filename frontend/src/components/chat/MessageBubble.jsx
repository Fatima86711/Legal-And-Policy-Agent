// frontend/src/components/chat/MessageBubble.jsx

import ReactMarkdown from "react-markdown";
import SourceCitation from "./SourceCitation";
import { formatProcessingTime, formatRelevanceScore, getTaskTypeColors, getTaskTypeLabel } from "../../utils/helpers";

// ══════════════════════════════════════════════════════════════════════════════
// TASK TYPE CONFIG
// Maps task_type strings from the backend to display labels and colors
// ══════════════════════════════════════════════════════════════════════════════
const TASK_TYPE_CONFIG = {
  RETRIEVAL: {
    label: "Document Retrieval",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
    dotClass:   "bg-blue-500",
  },
  EXPLANATION: {
    label: "Legal Terminology",
    badgeClass: "bg-green-100 text-green-700 border-green-200",
    dotClass:   "bg-green-500",
  },
  COMPARISON: {
    label: "Comparative Analysis",
    badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
    dotClass:   "bg-purple-500",
  },
  UNKNOWN: {
    label: "Off-topic",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
    dotClass:   "bg-gray-400",
  },
  ERROR: {
    label: "Error",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    dotClass:   "bg-red-500",
  },
};

// Fallback for any unrecognized task type
const DEFAULT_TASK_CONFIG = {
  label:      "Legal Analysis",
  badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
  dotClass:   "bg-gray-400",
};


// ══════════════════════════════════════════════════════════════════════════════
// TASK TYPE BADGE
// Small pill shown at the top of every assistant message
// ══════════════════════════════════════════════════════════════════════════════
function TaskTypeBadge({ taskType }) {
  const config = TASK_TYPE_CONFIG[taskType] || DEFAULT_TASK_CONFIG;

  return (
    <div className="mb-2 flex items-center gap-1.5">
      <span
        className={`
          inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5
          text-xs font-medium
          ${config.badgeClass}
        `}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
        {config.label}
      </span>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// RETRIEVAL METADATA BAR
// Shows chunks used, top score, and processing time under assistant messages
// ══════════════════════════════════════════════════════════════════════════════
function MetadataBar({ meta }) {
  const {
    chunks_used        = 0,
    top_score          = 0,
    avg_score          = 0,
    processing_time_ms = 0,
    used_fallback      = false,
  } = meta || {};

  // Do not show metadata bar for error or unknown responses
  if (!chunks_used && !processing_time_ms) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-100 pt-2.5">

      {/* Chunks used */}
      {chunks_used > 0 && (
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"
            />
          </svg>
          {chunks_used} chunk{chunks_used !== 1 ? "s" : ""} referenced
        </span>
      )}

      {/* Top relevance score */}
      {top_score > 0 && (
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
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
          relevance {(top_score * 100).toFixed(0)}%
        </span>
      )}

      {/* Processing time */}
      {processing_time_ms > 0 && (
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {processing_time_ms < 1000
            ? `${Math.round(processing_time_ms)}ms`
            : `${(processing_time_ms / 1000).toFixed(1)}s`}
        </span>
      )}

      {/* Fallback indicator */}
      {used_fallback && chunks_used === 0 && (
        <span className="flex items-center gap-1 text-xs text-amber-500">
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
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          No matching document found
        </span>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// WARNING BAR
// Shows validation warnings from the backend if any exist
// ══════════════════════════════════════════════════════════════════════════════
function WarningBar({ warnings }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="mb-1 text-xs font-medium text-amber-700">
        Response quality notice
      </p>
      {warnings.map((warning, index) => (
        <p key={index} className="text-xs text-amber-600">
          • {warning}
        </p>
      ))}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// USER BUBBLE
// Right-aligned bubble for user messages
// ══════════════════════════════════════════════════════════════════════════════
function UserBubble({ message }) {
  return (
    <div className="flex items-end justify-end gap-2 px-4 py-1">

      {/* Message bubble */}
      <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5 shadow-sm">
        <p className="text-sm leading-relaxed text-white">
          {message.content}
        </p>
      </div>

      {/* User avatar */}
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
        U
      </div>

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ERROR BUBBLE
// Red-styled bubble for messages with task_type ERROR
// ══════════════════════════════════════════════════════════════════════════════
function ErrorBubble({ message }) {
  return (
    <div className="flex items-start gap-3 px-4 py-1">

      {/* Avatar */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-sm">
        ⚠️
      </div>

      {/* Error bubble */}
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-red-200 bg-red-50 px-4 py-3 shadow-sm">

        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-medium text-red-600">
            Something went wrong
          </span>
        </div>

        <p className="text-sm leading-relaxed text-red-700">
          {message.content}
        </p>

        <p className="mt-2 text-xs text-red-400">
          Check that your backend is running and try again.
        </p>

      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ASSISTANT BUBBLE
// Left-aligned bubble for all successful assistant messages
// ══════════════════════════════════════════════════════════════════════════════
function AssistantBubble({ message }) {
  const meta = message.meta || {};

  return (
    <div className="flex items-start gap-3 px-4 py-1">

      {/* Avatar */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm text-white shadow-sm">
        ⚖️
      </div>

      {/* Bubble */}
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3 shadow-sm">

        {/* Task type badge */}
        <TaskTypeBadge taskType={meta.task_type} />

        {/* ── Markdown content ───────────────────────────────────────────── */}
        <div className="prose prose-sm max-w-none text-gray-800">
          <ReactMarkdown
            components={{
              // Style headings
              h1: ({ children }) => (
                <h1 className="mb-2 mt-4 text-base font-semibold text-gray-900 first:mt-0">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-2 mt-3 text-sm font-semibold text-gray-900 first:mt-0">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mb-1 mt-2 text-sm font-medium text-gray-800">
                  {children}
                </h3>
              ),
              // Style paragraphs
              p: ({ children }) => (
                <p className="mb-2 text-sm leading-relaxed text-gray-700 last:mb-0">
                  {children}
                </p>
              ),
              // Style bold text — critical for **Legal Analysis** headers
              strong: ({ children }) => (
                <strong className="font-semibold text-gray-900">
                  {children}
                </strong>
              ),
              // Style italic text
              em: ({ children }) => (
                <em className="italic text-gray-700">{children}</em>
              ),
              // Style unordered lists
              ul: ({ children }) => (
                <ul className="mb-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
                  {children}
                </ul>
              ),
              // Style ordered lists
              ol: ({ children }) => (
                <ol className="mb-2 ml-4 list-decimal space-y-1 text-sm text-gray-700">
                  {children}
                </ol>
              ),
              // Style list items
              li: ({ children }) => (
                <li className="leading-relaxed">{children}</li>
              ),
              // Style inline code
              code: ({ children }) => (
                <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-800">
                  {children}
                </code>
              ),
              // Style blockquotes — used for legal citations sometimes
              blockquote: ({ children }) => (
                <blockquote className="my-2 border-l-4 border-blue-300 pl-3 text-sm italic text-gray-600">
                  {children}
                </blockquote>
              ),
              // Style horizontal rules — used between sections
              hr: () => (
                <hr className="my-3 border-gray-100" />
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* ── Validation warnings ────────────────────────────────────────── */}
        <WarningBar warnings={meta.warnings} />

        {/* ── Source citations ───────────────────────────────────────────── */}
        <SourceCitation sources={meta.sources} />

        {/* ── Metadata bar ──────────────────────────────────────────────── */}
        <MetadataBar meta={meta} />

      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN MESSAGE BUBBLE — routes to correct sub-component
// ══════════════════════════════════════════════════════════════════════════════
export default function MessageBubble({ message }) {
  // User message
  if (message.role === "user") {
    return <UserBubble message={message} />;
  }

  // Error message
  if (message.meta?.task_type === "ERROR") {
    return <ErrorBubble message={message} />;
  }

  // Assistant message (RETRIEVAL, EXPLANATION, COMPARISON, UNKNOWN)
  return <AssistantBubble message={message} />;
}