// frontend/src/pages/Home.jsx

import { useState, useCallback, useEffect } from "react";
import MainLayout from "../components/layout/MainLayout";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import ChatWindow from "../components/chat/ChatWindow";
import ChatInput from "../components/chat/ChatInput";
import useChatStore from "../store/chatStore";


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — Empty Knowledge Base Warning Banner
// Shown between Header and ChatWindow when no documents are loaded.
// Auto-hides when the first document is uploaded.
// ══════════════════════════════════════════════════════════════════════════════

function EmptyKnowledgeBaseBanner({ onDismiss }) {
  return (
    <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3">

      {/* Warning icon */}
      <div className="mt-0.5 flex-shrink-0">
        <svg
          className="h-4 w-4 text-amber-500"
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

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800">
          Knowledge base is empty
        </p>
        <p className="mt-0.5 text-xs text-amber-600">
          Upload a legal PDF or text document in the sidebar before
          submitting a query. Without documents, the system cannot
          retrieve source-cited answers.
        </p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss warning"
        className="flex-shrink-0 rounded-md p-1 text-amber-400 transition-colors hover:bg-amber-100 hover:text-amber-600"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT — Loading Overlay
// Shown briefly on first load while the backend health check runs
// ══════════════════════════════════════════════════════════════════════════════

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white">

      {/* Animated logo */}
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-3xl shadow-lg animate-pulse">
        ⚖️
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-gray-800">
          Legal & Policy Analysis Agent
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Connecting to backend...
        </p>
      </div>

      {/* Loading dots */}
      <div className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 rounded-full bg-blue-400 animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-2 w-2 rounded-full bg-blue-400 animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-2 w-2 rounded-full bg-blue-400 animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN HOME PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function Home() {

  // ── Store ─────────────────────────────────────────────────────────────────
  const documents = useChatStore((s) => s.documents);
  const stats     = useChatStore((s) => s.stats);

  // ── Local state ───────────────────────────────────────────────────────────
  const [prefillQuery,    setPrefillQuery]    = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [appReady,        setAppReady]        = useState(false);


  // ══════════════════════════════════════════════════════════════════════════
  // APP READY — short delay to allow health check and initial fetch
  // to complete before revealing the full UI
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const timer = setTimeout(() => setAppReady(true), 800);
    return () => clearTimeout(timer);
  }, []);


  // ══════════════════════════════════════════════════════════════════════════
  // BANNER VISIBILITY
  // Show when: stats loaded + KB empty + not dismissed + app ready
  // Auto re-show if all documents deleted after dismissal
  // ══════════════════════════════════════════════════════════════════════════

  const knowledgeBaseEmpty = stats !== null && !(stats?.knowledge_base_ready);
  const showBanner         = appReady && knowledgeBaseEmpty && !bannerDismissed;

  // Re-show banner if user deletes all documents after previously dismissing
  useEffect(() => {
    if (documents.length === 0 && stats?.knowledge_base_ready === false) {
      setBannerDismissed(false);
    }
  }, [documents.length, stats?.knowledge_base_ready]);


  // ══════════════════════════════════════════════════════════════════════════
  // EXAMPLE QUERY HANDLER
  // Called when user clicks an example card on the ChatWindow welcome screen.
  // Sets the prefill string which ChatInput reads via props.
  // ══════════════════════════════════════════════════════════════════════════

  const handleExampleClick = useCallback((query) => {
    setPrefillQuery(query);
  }, []);


  // ══════════════════════════════════════════════════════════════════════════
  // PREFILL CONSUMED HANDLER
  // Called by ChatInput after it has read and applied the prefill value.
  // Resets prefillQuery so the same example card can be clicked again.
  // ══════════════════════════════════════════════════════════════════════════

  const handlePrefillConsumed = useCallback(() => {
    setPrefillQuery("");
  }, []);


  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="relative h-screen w-screen overflow-hidden">

      {/* ── Loading overlay — shown briefly on first load ─────────────────── */}
      {!appReady && <LoadingOverlay />}

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <MainLayout sidebar={<Sidebar />}>

        {/* ════════════════════════════════════════════════════════════════════
            RIGHT COLUMN
            Header + Banner + ChatWindow + ChatInput stacked vertically
        ════════════════════════════════════════════════════════════════════ */}
        <div className="flex h-full flex-col overflow-hidden">

          {/* ── Header ────────────────────────────────────────────────────── */}
          <Header />

          {/* ── Empty KB warning banner ───────────────────────────────────── */}
          {showBanner && (
            <EmptyKnowledgeBaseBanner
              onDismiss={() => setBannerDismissed(true)}
            />
          )}

          {/* ── Chat window — grows to fill remaining vertical space ──────── */}
          <ChatWindow onExampleClick={handleExampleClick} />

          {/* ── Chat input — pinned to bottom ────────────────────────────── */}
          <ChatInput
            prefillQuery={prefillQuery}
            onPrefillConsumed={handlePrefillConsumed}
          />

        </div>

      </MainLayout>

    </div>
  );
}