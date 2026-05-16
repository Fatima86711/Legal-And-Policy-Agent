// frontend/src/store/chatStore.js

import { create } from "zustand";

const useChatStore = create((set, get) => ({

  // ══════════════════════════════════════════════════════════════════════════
  // CHAT SLICE
  // ══════════════════════════════════════════════════════════════════════════

  messages: [],

  // Add any message object (user or assistant) to the list
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  // Add a user message — convenience wrapper
  addUserMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, { ...message, role: "user" }],
    })),

  // Add an assistant message — convenience wrapper
  addAssistantMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, { ...message, role: "assistant" }],
    })),

  // Remove the last message — used by retryLastMessage in useChat
  popLastMessage: () =>
    set((state) => ({
      messages: state.messages.slice(0, -1),
    })),

  // Clear the entire chat history
  clearChat: () => set({ messages: [] }),


  // ══════════════════════════════════════════════════════════════════════════
  // DOCUMENTS SLICE
  // ══════════════════════════════════════════════════════════════════════════

  documents: [],
  stats: null,

  // Replace the entire documents array
  setDocuments: (documents) => set({ documents }),

  // Replace the stats object
  setStats: (stats) => set({ stats }),

  // Append a single document after successful upload
  addDocument: (document) =>
    set((state) => ({
      documents: [...state.documents, document],
    })),

  // Remove a document by filename after successful delete
  removeDocument: (filename) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.filename !== filename),
    })),


  // ══════════════════════════════════════════════════════════════════════════
  // UI SLICE
  // ══════════════════════════════════════════════════════════════════════════

  isLoading:   false,
  isUploading: false,

  setIsLoading:   (value) => set({ isLoading: value }),
  setIsUploading: (value) => set({ isUploading: value }),


  // ══════════════════════════════════════════════════════════════════════════
  // SELECTORS
  // Call inside components as: useChatStore((s) => s.hasMessages())
  // ══════════════════════════════════════════════════════════════════════════

  hasMessages:      () => get().messages.length > 0,
  isKnowledgeReady: () => get().stats?.knowledge_base_ready ?? false,
  totalDocuments:   () => get().stats?.total_documents      ?? 0,
  totalChunks:      () => get().stats?.total_chunks         ?? 0,

}));

export default useChatStore;