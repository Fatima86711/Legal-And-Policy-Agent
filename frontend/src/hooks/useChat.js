// frontend/src/hooks/useChat.js

import { useCallback } from "react";
import { sendQuery } from "../api/index";
import useChatStore from "../store/chatStore";

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function buildUserMessage(query) {
  return {
    id:      generateId(),
    role:    "user",
    content: query,
    meta:    null,
  };
}

function buildAssistantMessage(result) {
  return {
    id:      generateId(),
    role:    "assistant",
    content: result.response,
    meta: {
      task_type:          result.task_type          ?? "UNKNOWN",
      sources:            result.sources            ?? [],
      chunks_used:        result.chunks_used        ?? 0,
      top_score:          result.top_score          ?? 0,
      avg_score:          result.avg_score          ?? 0,
      used_fallback:      result.used_fallback      ?? false,
      is_valid:           result.is_valid           ?? true,
      warnings:           result.warnings           ?? [],
      processing_time_ms: result.processing_time_ms ?? 0,
      error:              result.error              ?? null,
    },
  };
}

function buildErrorMessage(errorText) {
  return {
    id:      generateId(),
    role:    "assistant",
    content: errorText,
    meta: {
      task_type:          "ERROR",
      sources:            [],
      chunks_used:        0,
      top_score:          0,
      avg_score:          0,
      used_fallback:      true,
      is_valid:           false,
      warnings:           [],
      processing_time_ms: 0,
      error:              errorText,
    },
  };
}

export default function useChat() {
  const messages         = useChatStore((s) => s.messages);
  const isLoading        = useChatStore((s) => s.isLoading);
  const addMessage       = useChatStore((s) => s.addMessage);
  const setIsLoading     = useChatStore((s) => s.setIsLoading);
  const clearChat        = useChatStore((s) => s.clearChat);

  const sendMessage = useCallback(async (query) => {
    const trimmed = query?.trim();
    if (!trimmed || isLoading) return;

    addMessage(buildUserMessage(trimmed));
    setIsLoading(true);

    try {
      const result = await sendQuery(trimmed);
      addMessage(buildAssistantMessage(result));
    } catch (err) {
      const errorText = err?.message || "Something went wrong. Please try again.";
      addMessage(buildErrorMessage(errorText));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, addMessage, setIsLoading]);

  const retryLastMessage = useCallback(async () => {
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length === 0) return;

    const lastUserMessage = userMessages[userMessages.length - 1];
    const lastMessage     = messages[messages.length - 1];

    if (lastMessage?.meta?.task_type === "ERROR") {
      useChatStore.getState().popLastMessage();
    }

    await sendMessage(lastUserMessage.content);
  }, [messages, sendMessage]);

  const sendExampleQuery = useCallback(async (query) => {
    await sendMessage(query);
  }, [sendMessage]);

  const hasMessages           = messages.length > 0;
  const lastMessage           = messages[messages.length - 1] ?? null;
  const hasError              = lastMessage?.meta?.task_type === "ERROR";
  const messageCount          = messages.length;
  const userMessageCount      = messages.filter((m) => m.role === "user").length;
  const assistantMessageCount = messages.filter(
    (m) => m.role === "assistant" && m.meta?.task_type !== "ERROR"
  ).length;

  return {
    messages,
    isLoading,
    hasMessages,
    hasError,
    messageCount,
    userMessageCount,
    assistantMessageCount,
    lastMessage,
    sendMessage,
    retryLastMessage,
    sendExampleQuery,
    clearChat,
  };
}