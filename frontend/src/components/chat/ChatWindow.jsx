// frontend/src/components/chat/ChatWindow.jsx

import { useEffect, useRef } from "react";
import useChatStore from "../../store/chatStore";
import MessageBubble from "./MessageBubble";

// ══════════════════════════════════════════════════════════════════════════════
// EXAMPLE QUERIES — shown on the welcome screen when chat is empty
// ══════════════════════════════════════════════════════════════════════════════
const EXAMPLE_QUERIES = [
  {
    label: "Document Retrieval",
    color: "blue",
    icon: "📄",
    query: "What are the penalties for data breaches under GDPR?",
    description: "Ask what a specific law or policy says",
  },
  {
    label: "Legal Terminology",
    color: "green",
    icon: "📖",
    query: "What does habeas corpus mean in plain language?",
    description: "Get a plain-language explanation of a legal term",
  },
  {
    label: "Comparative Analysis",
    color: "purple",
    icon: "⚖️",
    query: "How does GDPR differ from Pakistan's data protection laws?",
    description: "Compare laws, policies, or legal concepts",
  },
];

// ── Color map for example query cards ────────────────────────────────────────
const CARD_COLORS = {
  blue:   "border-blue-200 bg-blue-50 hover:bg-blue-100",
  green:  "border-green-200 bg-green-50 hover:bg-green-100",
  purple: "border-purple-200 bg-purple-50 hover:bg-purple-100",
};

const LABEL_COLORS = {
  blue:   "bg-blue-100 text-blue-700",
  green:  "bg-green-100 text-green-700",
  purple: "bg-purple-100 text-purple-700",
};


// ══════════════════════════════════════════════════════════════════════════════
// WELCOME SCREEN — rendered when messages array is empty
// ══════════════════════════════════════════════════════════════════════════════
function WelcomeScreen({ onExampleClick }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12">

      {/* ── App icon + title ──────────────────────────────────────────────── */}
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl shadow-sm">
        ⚖️
      </div>

      <h1 className="mb-1 text-xl font-semibold text-gray-800">
        Legal & Policy Analysis Agent
      </h1>

      <p className="mb-8 max-w-sm text-center text-sm text-gray-500">
        Upload a legal document in the sidebar, then ask questions about it.
        The system retrieves answers directly from your documents — no
        hallucination.
      </p>

      {/* ── Example query cards ───────────────────────────────────────────── */}
      <div className="w-full max-w-lg space-y-3">
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-gray-400">
          Try an example
        </p>

        {EXAMPLE_QUERIES.map((example) => (
          <button
            key={example.label}
            onClick={() => onExampleClick(example.query)}
            className={`
              w-full rounded-xl border px-4 py-3 text-left transition-all
              ${CARD_COLORS[example.color]}
            `}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg leading-none">{example.icon}</span>

              <div className="flex-1 min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`
                      rounded-full px-2 py-0.5 text-xs font-medium
                      ${LABEL_COLORS[example.color]}
                    `}
                  >
                    {example.label}
                  </span>
                </div>

                <p className="text-sm font-medium text-gray-700">
                  "{example.query}"
                </p>

                <p className="mt-0.5 text-xs text-gray-500">
                  {example.description}
                </p>
              </div>

              {/* Arrow indicator */}
              <svg
                className="mt-1 h-4 w-4 flex-shrink-0 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* ── Bottom hint ───────────────────────────────────────────────────── */}
      <p className="mt-8 text-xs text-gray-400">
        Upload a PDF or text file in the sidebar to get started
      </p>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// TYPING INDICATOR — shown while a query is being processed
// ══════════════════════════════════════════════════════════════════════════════
function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-2">

      {/* Avatar */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
        ⚖️
      </div>

      {/* Animated dots bubble */}
      <div className="rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 mr-1">Analyzing</span>
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
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// DATE SEPARATOR — shown between messages from different sessions
// ══════════════════════════════════════════════════════════════════════════════
function DateSeparator() {
  const now = new Date();
  const label = now.toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
  });

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex-1 border-t border-gray-100" />
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN CHAT WINDOW COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function ChatWindow({ onExampleClick }) {
  // ── Store ───────────────────────────────────────────────────────────────────
  const messages  = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);

  // ── Ref for auto-scroll to bottom ───────────────────────────────────────────
  const bottomRef = useRef(null);

  // ── Scroll to bottom whenever messages change or loading state changes ───────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);


  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — Empty state
  // ══════════════════════════════════════════════════════════════════════════
  if (messages.length === 0 && !isLoading) {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <WelcomeScreen onExampleClick={onExampleClick} />
    </div>
  );
}


  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — Message list
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">

      {/* Top padding */}
      <div className="h-4" />

      {/* Date separator at the top of every session */}
      <DateSeparator />

      {/* ── Message list ──────────────────────────────────────────────────── */}
      <div className="space-y-1 pb-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      {/* ── Typing indicator (shown while loading) ────────────────────────── */}
      {isLoading && <TypingIndicator />}

      {/* ── Invisible scroll anchor ───────────────────────────────────────── */}
      <div ref={bottomRef} className="h-4" />

    </div>
  );
}