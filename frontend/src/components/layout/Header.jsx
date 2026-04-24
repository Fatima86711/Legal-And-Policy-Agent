// frontend/src/components/layout/Header.jsx

import { useEffect, useState } from "react";
import { checkChatHealth, fetchStats } from "../../api/index";
import useChatStore from "../../store/chatStore";


// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════
const HEALTH_CHECK_INTERVAL_MS = 30000; // Re-check backend health every 30s


// ══════════════════════════════════════════════════════════════════════════════
// BACKEND STATUS STATES
// ══════════════════════════════════════════════════════════════════════════════
const BACKEND_STATUS = {
  CHECKING:     "checking",
  CONNECTED:    "connected",
  DISCONNECTED: "disconnected",
};


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — Backend Status Indicator
// Shows a colored dot and label reflecting backend connectivity
// ══════════════════════════════════════════════════════════════════════════════
function BackendStatusIndicator({ status }) {

  const config = {
    [BACKEND_STATUS.CHECKING]: {
      dotClass:   "bg-yellow-400 animate-pulse",
      labelClass: "text-yellow-600",
      label:      "Connecting...",
    },
    [BACKEND_STATUS.CONNECTED]: {
      dotClass:   "bg-green-500",
      labelClass: "text-green-600",
      label:      "Backend connected",
    },
    [BACKEND_STATUS.DISCONNECTED]: {
      dotClass:   "bg-red-500 animate-pulse",
      labelClass: "text-red-600",
      label:      "Backend offline",
    },
  }[status] || {
    dotClass:   "bg-gray-400",
    labelClass: "text-gray-500",
    label:      "Unknown",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
      <span className={`text-xs font-medium ${config.labelClass}`}>
        {config.label}
      </span>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — Knowledge Base Status
// Shows document count and readiness with color-coded indicator
// ══════════════════════════════════════════════════════════════════════════════
function KnowledgeBaseStatus({ stats, backendStatus }) {

  // Do not show KB status while backend is still connecting
  if (backendStatus === BACKEND_STATUS.CHECKING) return null;

  // Show offline message if backend is down
  if (backendStatus === BACKEND_STATUS.DISCONNECTED) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1">
        <svg
          className="h-3.5 w-3.5 text-red-500"
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
        <span className="text-xs font-medium text-red-600">
          Cannot reach backend
        </span>
      </div>
    );
  }

  const isReady        = stats?.knowledge_base_ready ?? false;
  const totalDocuments = stats?.total_documents       ?? 0;
  const totalChunks    = stats?.total_chunks          ?? 0;

  // ── Knowledge base is empty ───────────────────────────────────────────────
  if (!isReady) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1">
        <svg
          className="h-3.5 w-3.5 text-amber-500"
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
        <span className="text-xs font-medium text-amber-600">
          No documents loaded — upload a file to begin
        </span>
      </div>
    );
  }

  // ── Knowledge base has documents ──────────────────────────────────────────
  return (
    <div className="flex items-center gap-2">

      {/* Document count pill */}
      <div className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1">
        <svg
          className="h-3.5 w-3.5 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-xs font-medium text-green-700">
          {totalDocuments} {totalDocuments === 1 ? "document" : "documents"} loaded
        </span>
      </div>

      {/* Chunk count — subtle secondary info */}
      <span className="hidden text-xs text-gray-400 sm:inline">
        {totalChunks.toLocaleString()} chunks indexed
      </span>

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — Clear Chat Button
// Allows user to reset the conversation history
// ══════════════════════════════════════════════════════════════════════════════
function ClearChatButton() {
  const messages  = useChatStore((s) => s.messages);
  const clearChat = useChatStore((s) => s.clearChat);
  const [confirming, setConfirming] = useState(false);

  // Do not render if no messages exist
  if (messages.length === 0) return null;

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      // Auto-cancel confirmation after 3 seconds if user does not click again
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    clearChat();
    setConfirming(false);
  }

  return (
    <button
      onClick={handleClick}
      aria-label="Clear chat history"
      className={`
        flex items-center gap-1.5 rounded-lg border px-2.5 py-1
        text-xs font-medium transition-all
        ${confirming
          ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700"
        }
      `}
    >
      {confirming ? (
        <>
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Confirm clear
        </>
      ) : (
        <>
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2
                 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1
                 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Clear chat
        </>
      )}
    </button>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — App Logo + Title
// ══════════════════════════════════════════════════════════════════════════════
function AppTitle() {
  return (
    <div className="flex items-center gap-2.5">

      {/* Logo icon */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm shadow-sm">
        ⚖️
      </div>

      {/* Title + subtitle */}
      <div className="hidden sm:block">
        <h1 className="text-sm font-semibold leading-none text-gray-900">
          Legal & Policy Agent
        </h1>
        <p className="mt-0.5 text-[11px] leading-none text-gray-400">
          Powered by Cohere Command-R · ChromaDB RAG
        </p>
      </div>

      {/* Mobile — title only, no subtitle */}
      <h1 className="text-sm font-semibold text-gray-900 sm:hidden">
        Legal Agent
      </h1>

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN HEADER COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function Header() {

  // ── Store ─────────────────────────────────────────────────────────────────
  const stats    = useChatStore((s) => s.stats);
  const setStats = useChatStore((s) => s.setStats);

  // ── Local state ───────────────────────────────────────────────────────────
  const [backendStatus, setBackendStatus] = useState(BACKEND_STATUS.CHECKING);


  // ══════════════════════════════════════════════════════════════════════════
  // HEALTH CHECK — runs on mount and on interval
  // ══════════════════════════════════════════════════════════════════════════
  async function runHealthCheck() {
    try {
      await checkChatHealth();
      setBackendStatus(BACKEND_STATUS.CONNECTED);
    } catch {
      setBackendStatus(BACKEND_STATUS.DISCONNECTED);
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // STATS FETCH — loads KB stats from backend
  // ══════════════════════════════════════════════════════════════════════════
  async function loadStats() {
    try {
      const data = await fetchStats();
      setStats(data);
    } catch {
      // Stats fetch failure is non-critical — silently ignore
      // The KnowledgeBaseStatus component handles the empty/null stats case
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ══════════════════════════════════════════════════════════════════════════

  // On mount — run health check and load stats immediately
  useEffect(() => {
    runHealthCheck();
    loadStats();
  }, []);

  // Re-check backend health every 30 seconds
  useEffect(() => {
    const interval = setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Reload stats whenever the documents in the store change
  // This ensures the header reflects the latest chunk count after uploads/deletes
  const documents = useChatStore((s) => s.documents);
  useEffect(() => {
    if (backendStatus === BACKEND_STATUS.CONNECTED) {
      loadStats();
    }
  }, [documents, backendStatus]);


  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <header className="
      flex flex-shrink-0 items-center justify-between
      border-b border-gray-200 bg-white px-4 py-2.5
      shadow-sm
    ">

      {/* ── Left — Logo and title ─────────────────────────────────────────── */}
      <AppTitle />

      {/* ── Center — Knowledge base status ───────────────────────────────── */}
      <div className="hidden flex-1 items-center justify-center md:flex">
        <KnowledgeBaseStatus
          stats={stats}
          backendStatus={backendStatus}
        />
      </div>

      {/* ── Right — Backend status + clear chat button ────────────────────── */}
      <div className="flex items-center gap-3">

        {/* Backend connectivity dot */}
        <BackendStatusIndicator status={backendStatus} />

        {/* Divider */}
        <div className="h-4 w-px bg-gray-200" />

        {/* Clear chat */}
        <ClearChatButton />

      </div>

    </header>
  );
}