// frontend/src/utils/helpers.js


// ══════════════════════════════════════════════════════════════════════════════
// FILE SIZE FORMATTING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Convert a file size in KB to a human-readable string.
 * Used in DocumentList to show file size on each document card.
 *
 * Examples:
 *   formatFileSize(0)       → "Unknown size"
 *   formatFileSize(245.3)   → "245.3 KB"
 *   formatFileSize(3820.5)  → "3.73 MB"
 */
export function formatFileSize(kb) {
  if (!kb || kb === 0) return "Unknown size";
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}


/**
 * Convert raw bytes to a human-readable string.
 * Used in DocumentUpload to show the size of the file being uploaded
 * since the browser File object exposes size in bytes, not KB.
 *
 * Examples:
 *   formatBytes(0)          → "0 B"
 *   formatBytes(512)        → "512 B"
 *   formatBytes(204800)     → "200.0 KB"
 *   formatBytes(5242880)    → "5.00 MB"
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024)          return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}


// ══════════════════════════════════════════════════════════════════════════════
// FILENAME FORMATTING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Truncate a long filename for display while preserving the file extension.
 * Used in DocumentList and DocumentUpload so long filenames do not overflow.
 *
 * Examples:
 *   truncateFilename("gdpr.pdf", 28)
 *     → "gdpr.pdf"   (short enough, returned as-is)
 *
 *   truncateFilename("Pakistan_Electronic_Crimes_Act_2016_Official.pdf", 28)
 *     → "Pakistan_Electronic_Cr...pdf"
 */
export function truncateFilename(filename, maxLength = 28) {
  if (!filename) return "Unknown";
  if (filename.length <= maxLength) return filename;

  const ext  = filename.split(".").pop();
  const base = filename.slice(0, maxLength - ext.length - 4);
  return `${base}...${ext}`;
}


/**
 * Extract just the filename from a full path string.
 * Handles both forward slashes (Linux/Mac) and backslashes (Windows).
 * Used in SourceCitation where the backend returns full paths like
 * "data\\raw\\gdpr.pdf" and we only want to display "gdpr.pdf".
 *
 * Examples:
 *   getFilename("data\\raw\\gdpr.pdf")   → "gdpr.pdf"
 *   getFilename("data/raw/peca.pdf")     → "peca.pdf"
 *   getFilename("gdpr.pdf")             → "gdpr.pdf"
 *   getFilename(null)                   → "Unknown Source"
 */
export function getFilename(source) {
  if (!source) return "Unknown Source";
  return source.split(/[\\/]/).pop() || source;
}


/**
 * Extract the file extension from a filename as an uppercase label.
 * Used in SourceCitation and DocumentList for the file type badge.
 *
 * Examples:
 *   getFileTypeLabel("gdpr.pdf")   → "PDF"
 *   getFileTypeLabel("peca.txt")   → "TXT"
 *   getFileTypeLabel("report.doc") → "DOC"
 */
export function getFileTypeLabel(filename) {
  if (!filename) return "FILE";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "PDF";
  if (ext === "txt") return "TXT";
  return ext?.toUpperCase() || "FILE";
}


// ══════════════════════════════════════════════════════════════════════════════
// TASK TYPE STYLING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Return Tailwind color classes for a given task type string.
 * Used in MessageBubble for the task type badge and in ChatWindow
 * for the example query cards.
 *
 * Returns an object with three class strings:
 *   - badge   : classes for the pill/badge element
 *   - dot     : classes for the colored status dot inside the badge
 *   - card    : classes for a larger card background (example queries)
 */
export function getTaskTypeColors(taskType) {
  const map = {
    RETRIEVAL: {
      badge: "bg-blue-100 text-blue-700 border-blue-200",
      dot:   "bg-blue-500",
      card:  "border-blue-200 bg-blue-50 hover:bg-blue-100",
    },
    EXPLANATION: {
      badge: "bg-green-100 text-green-700 border-green-200",
      dot:   "bg-green-500",
      card:  "border-green-200 bg-green-50 hover:bg-green-100",
    },
    COMPARISON: {
      badge: "bg-purple-100 text-purple-700 border-purple-200",
      dot:   "bg-purple-500",
      card:  "border-purple-200 bg-purple-50 hover:bg-purple-100",
    },
    UNKNOWN: {
      badge: "bg-gray-100 text-gray-600 border-gray-200",
      dot:   "bg-gray-400",
      card:  "border-gray-200 bg-gray-50 hover:bg-gray-100",
    },
    ERROR: {
      badge: "bg-red-100 text-red-700 border-red-200",
      dot:   "bg-red-500",
      card:  "border-red-200 bg-red-50 hover:bg-red-100",
    },
  };

  return map[taskType] || map["UNKNOWN"];
}


/**
 * Return a human-readable label for a task type string.
 * Used in MessageBubble badge and anywhere the raw "RETRIEVAL"
 * string needs to be displayed as "Document Retrieval".
 *
 * Examples:
 *   getTaskTypeLabel("RETRIEVAL")   → "Document Retrieval"
 *   getTaskTypeLabel("EXPLANATION") → "Legal Terminology"
 *   getTaskTypeLabel("COMPARISON")  → "Comparative Analysis"
 *   getTaskTypeLabel("UNKNOWN")     → "Off-topic"
 *   getTaskTypeLabel("ERROR")       → "Error"
 */
export function getTaskTypeLabel(taskType) {
  const labels = {
    RETRIEVAL:   "Document Retrieval",
    EXPLANATION: "Legal Terminology",
    COMPARISON:  "Comparative Analysis",
    UNKNOWN:     "Off-topic",
    ERROR:       "Error",
  };

  return labels[taskType] || "Legal Analysis";
}


// ══════════════════════════════════════════════════════════════════════════════
// FILE TYPE STYLING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Return Tailwind color classes for the file type icon based on extension.
 * Used in SourceCitation pills and DocumentList cards.
 *
 * Returns a string of combined icon color + background classes.
 *
 * Examples:
 *   getFileIconColors("gdpr.pdf")  → "text-red-500 bg-red-50"
 *   getFileIconColors("peca.txt")  → "text-blue-500 bg-blue-50"
 *   getFileIconColors("other.doc") → "text-gray-500 bg-gray-100"
 */
export function getFileIconColors(filename) {
  const ext = filename?.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "text-red-500 bg-red-50";
  if (ext === "txt") return "text-blue-500 bg-blue-50";
  return "text-gray-500 bg-gray-100";
}


// ══════════════════════════════════════════════════════════════════════════════
// TIME FORMATTING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Format a processing time in milliseconds to a readable string.
 * Used in MessageBubble metadata bar.
 *
 * Examples:
 *   formatProcessingTime(320)    → "320ms"
 *   formatProcessingTime(1450)   → "1.5s"
 *   formatProcessingTime(12300)  → "12.3s"
 */
export function formatProcessingTime(ms) {
  if (!ms || ms === 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}


/**
 * Format a relevance score (0.0 to 1.0) as a percentage string.
 * Used in MessageBubble metadata bar next to the star icon.
 *
 * Examples:
 *   formatRelevanceScore(0.87)  → "87%"
 *   formatRelevanceScore(0.5)   → "50%"
 *   formatRelevanceScore(0)     → ""
 */
export function formatRelevanceScore(score) {
  if (!score || score === 0) return "";
  return `${(score * 100).toFixed(0)}%`;
}


// ══════════════════════════════════════════════════════════════════════════════
// UNIQUE ID GENERATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a lightweight unique ID for React list keys and message IDs.
 * Not cryptographically secure — only used for UI key management within
 * a single browser session.
 *
 * Example output: "msg_1714032000000_x7k2a"
 */
export function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}


// ══════════════════════════════════════════════════════════════════════════════
// STRING UTILITIES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Capitalize the first letter of a string.
 * Used for display formatting of backend string values.
 *
 * Examples:
 *   capitalize("retrieval")  → "Retrieval"
 *   capitalize("")           → ""
 *   capitalize(null)         → ""
 */
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}


/**
 * Pluralize a word based on a count.
 * Used in DocumentList, SourceCitation, and MetadataBar.
 *
 * Examples:
 *   pluralize(1, "chunk")    → "chunk"
 *   pluralize(5, "chunk")    → "chunks"
 *   pluralize(1, "document") → "document"
 *   pluralize(3, "document") → "documents"
 */
export function pluralize(count, word) {
  return count === 1 ? word : `${word}s`;
}