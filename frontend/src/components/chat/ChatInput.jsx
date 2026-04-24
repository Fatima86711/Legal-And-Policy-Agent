// frontend/src/components/chat/ChatInput.jsx

import { useState, useRef, useEffect } from "react";
import { sendQuery } from "../../api/index";
import useChatStore from "../../store/chatStore";

// ══════════════════════════════════════════════════════════════════════════════
// HELPER — Generate a unique ID for each message
// ══════════════════════════════════════════════════════════════════════════════
function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// CHAT INPUT COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function ChatInput() {
  // ── Local State ─────────────────────────────────────────────────────────────
  const [inputValue, setInputValue] = useState("");

  // ── Store ───────────────────────────────────────────────────────────────────
  const addUserMessage    = useChatStore((s) => s.addUserMessage);
  const addAssistantMessage = useChatStore((s) => s.addAssistantMessage);
  const isLoading         = useChatStore((s) => s.isLoading);
  const setIsLoading      = useChatStore((s) => s.setIsLoading);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const textareaRef = useRef(null);

  // ── Auto-focus on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // ── Auto-resize textarea as user types ───────────────────────────────────────
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [inputValue]);


  // ══════════════════════════════════════════════════════════════════════════
  // SUBMIT HANDLER
  // ══════════════════════════════════════════════════════════════════════════
  async function handleSubmit() {
    const query = inputValue.trim();

    // Do nothing if empty or already loading
    if (!query || isLoading) return;

    // ── Step 1 — Clear input immediately ────────────────────────────────────
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // ── Step 2 — Add user message to store immediately ──────────────────────
    const userMessageId = generateId();
    addUserMessage({
      id:      userMessageId,
      role:    "user",
      content: query,
    });

    // ── Step 3 — Set loading state ───────────────────────────────────────────
    setIsLoading(true);

    // ── Step 4 — Call API and handle response ────────────────────────────────
    try {
      const result = await sendQuery(query);

      addAssistantMessage({
        id:   generateId(),
        role: "assistant",
        content: result.response,
        meta: {
          task_type:          result.task_type,
          sources:            result.sources           || [],
          chunks_used:        result.chunks_used       ?? 0,
          top_score:          result.top_score         ?? 0,
          avg_score:          result.avg_score         ?? 0,
          used_fallback:      result.used_fallback     ?? false,
          is_valid:           result.is_valid          ?? true,
          warnings:           result.warnings          || [],
          processing_time_ms: result.processing_time_ms ?? 0,
          error:              result.error             || null,
        },
      });

    } catch (err) {
      // ── Show error as an assistant message rather than crashing ───────────
      addAssistantMessage({
        id:      generateId(),
        role:    "assistant",
        content: err.message || "Something went wrong. Please try again.",
        meta: {
          task_type:     "ERROR",
          sources:       [],
          chunks_used:   0,
          top_score:     0,
          avg_score:     0,
          used_fallback: true,
          is_valid:      false,
          warnings:      [],
          processing_time_ms: 0,
          error:         err.message || "Unknown error",
        },
      });

    } finally {
      // ── Step 5 — Always clear loading state ──────────────────────────────
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // KEYBOARD HANDLER
  // Enter = submit, Shift+Enter = new line
  // ══════════════════════════════════════════════════════════════════════════
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // DERIVED STATE
  // ══════════════════════════════════════════════════════════════════════════
  const isDisabled      = isLoading;
  const isSendDisabled  = isLoading || inputValue.trim().length === 0;
  const charCount       = inputValue.length;
  const charLimit       = 2000;
  const isNearLimit     = charCount > 1800;
  const isOverLimit     = charCount > charLimit;


  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">

      {/* ── Loading indicator bar ─────────────────────────────────────────── */}
      {isLoading && (
        <div className="mb-2 flex items-center gap-2 text-sm text-blue-600">
          <span className="flex gap-1">
            <span className="animate-bounce [animation-delay:0ms]">●</span>
            <span className="animate-bounce [animation-delay:150ms]">●</span>
            <span className="animate-bounce [animation-delay:300ms]">●</span>
          </span>
          <span>Analyzing your query...</span>
        </div>
      )}

      {/* ── Input row ─────────────────────────────────────────────────────── */}
      <div
        className={`flex items-end gap-2 rounded-xl border px-3 py-2 transition-colors
          ${isDisabled
            ? "border-gray-200 bg-gray-50"
            : "border-gray-300 bg-white focus-within:border-blue-500"
          }
          ${isOverLimit ? "border-red-400" : ""}
        `}
      >
        {/* ── Textarea ──────────────────────────────────────────────────── */}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          maxLength={charLimit + 50}
          rows={1}
          placeholder={
            isLoading
              ? "Waiting for response..."
              : "Ask about a legal document, term, or policy..."
          }
          className={`
            flex-1 resize-none bg-transparent text-sm leading-relaxed
            text-gray-800 placeholder-gray-400 outline-none
            disabled:cursor-not-allowed disabled:text-gray-400
          `}
          style={{ minHeight: "36px", maxHeight: "160px" }}
        />

        {/* ── Send Button ───────────────────────────────────────────────── */}
        <button
          onClick={handleSubmit}
          disabled={isSendDisabled || isOverLimit}
          aria-label="Send query"
          className={`
            mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center
            rounded-lg transition-all
            ${isSendDisabled || isOverLimit
              ? "cursor-not-allowed bg-gray-100 text-gray-400"
              : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
            }
          `}
        >
          {isLoading ? (
            /* Spinner when loading */
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          ) : (
            /* Send arrow icon */
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
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>

      {/* ── Footer row — char count + hint ────────────────────────────────── */}
      <div className="mt-1.5 flex items-center justify-between px-1">
        <p className="text-xs text-gray-400">
          Press <kbd className="rounded border border-gray-200 px-1 py-0.5 text-xs">Enter</kbd> to send
          &nbsp;·&nbsp;
          <kbd className="rounded border border-gray-200 px-1 py-0.5 text-xs">Shift+Enter</kbd> for new line
        </p>

        <span
          className={`text-xs ${
            isOverLimit
              ? "font-medium text-red-500"
              : isNearLimit
              ? "text-amber-500"
              : "text-gray-400"
          }`}
        >
          {charCount}/{charLimit}
        </span>
      </div>

    </div>
  );
}