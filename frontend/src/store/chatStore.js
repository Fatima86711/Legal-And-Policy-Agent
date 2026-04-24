// frontend/src/store/chatStore.js

import { create } from "zustand";


// ══════════════════════════════════════════════════════════════════════════════
// STORE
// ══════════════════════════════════════════════════════════════════════════════

const useChatStore = create((set, get) => ({

  // ══════════════════════════════════════════════════════════════════════════
  // CHAT SLICE
  // Holds the full message history for the current session
  // ══════════════════════════════════════════════════════════════════════════

  messages: [],

  // Add any message object (user or assistant) to the list
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  // Add a user message — convenience wrapper used by some components
  addUserMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, { ...message, role: "user" }],
    })),

  // Add an assistant message — convenience wrapper used by some components
  addAssistantMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, { ...message, role: "assistant" }],
    })),

  // Remove the last message in the list
  // Used by retryLastMessage in useChat to pop the error bubble before retrying
  popLastMessage: () =>
    set((state) => ({
      messages: state.messages.slice(0, -1),
    })),

  // Clear the entire chat history
  clearChat: () => set({ messages: [] }),


  // ══════════════════════════════════════════════════════════════════════════
  // DOCUMENTS SLICE
  // Holds the list of ingested documents and knowledge base stats
  // ══════════════════════════════════════════════════════════════════════════

  documents: [],
  stats: null,

  // Replace the entire documents array (used after fetchDocuments)
  setDocuments: (documents) => set({ documents }),

  // Replace the stats object (used after fetchStats)
  setStats: (stats) => set({ stats }),

  // Append a single document (used after successful upload)
  addDocument: (document) =>
    set((state) => ({
      documents: [...state.documents, document],
    })),

  // Remove a document by filename (used after successful delete)
  removeDocument: (filename) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.filename !== filename),
    })),


  // ══════════════════════════════════════════════════════════════════════════
  // UI SLICE
  // Holds loading flags shared across multiple components
  // ══════════════════════════════════════════════════════════════════════════

  // True while a chat query API call is in flight
  isLoading: false,
  setIsLoading: (value) => set({ isLoading: value }),

  // True while a document upload API call is in flight
  isUploading: false,
  setIsUploading: (value) => set({ isUploading: value }),


  // ══════════════════════════════════════════════════════════════════════════
  // SELECTORS (derived values as functions)
  // Call these inside components as: useChatStore((s) => s.hasMessages())
  // ══════════════════════════════════════════════════════════════════════════

  hasMessages: () => get().messages.length > 0,

  isKnowledgeReady: () => get().stats?.knowledge_base_ready ?? false,

  totalDocuments: () => get().stats?.total_documents ?? 0,

  totalChunks: () => get().stats?.total_chunks ?? 0,

}));

export default useChatStore;