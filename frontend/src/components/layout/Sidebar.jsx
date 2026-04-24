// frontend/src/components/layout/Sidebar.jsx

import { useEffect } from "react";
import { fetchDocuments } from "../../api/index";
import useChatStore from "../../store/chatStore";
import DocumentUpload from "../documents/DocumentUpload";
import DocumentList from "../documents/DocumentList";

function StatsBar({ stats }) {
  const totalDocuments = stats?.total_documents ?? 0;
  const totalChunks    = stats?.total_chunks    ?? 0;
  const isReady        = stats?.knowledge_base_ready ?? false;

  return (
    <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Knowledge Base
        </span>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isReady ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isReady ? "bg-green-500" : "bg-amber-400"}`} />
          {isReady ? "Ready" : "Empty"}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-lg font-bold leading-none text-gray-800">{totalDocuments}</span>
          <span className="mt-0.5 text-[10px] text-gray-400">{totalDocuments === 1 ? "Document" : "Documents"}</span>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div className="flex flex-col">
          <span className="text-lg font-bold leading-none text-gray-800">{totalChunks.toLocaleString()}</span>
          <span className="mt-0.5 text-[10px] text-gray-400">Chunks indexed</span>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div className="flex flex-col">
          <span className="text-lg font-bold leading-none text-gray-800">{isReady ? "✓" : "—"}</span>
          <span className="mt-0.5 text-[10px] text-gray-400">Indexed</span>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </span>
      {count !== undefined && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          {count}
        </span>
      )}
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t border-gray-100 px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-[10px] font-medium text-gray-400">Legal & Policy Analysis Agent</p>
        <p className="text-[10px] text-gray-300">Cohere Command-R · ChromaDB · FastAPI</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-500">RAG</span>
          <span className="rounded-md border border-purple-100 bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-purple-500">Multi-Agent</span>
          <span className="rounded-md border border-green-100 bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-green-500">OCR</span>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const documents    = useChatStore((s) => s.documents);
  const stats        = useChatStore((s) => s.stats);
  const setDocuments = useChatStore((s) => s.setDocuments);
  const setStats     = useChatStore((s) => s.setStats);

  async function loadData() {
    try {
      const data = await fetchDocuments();
      setDocuments(data.documents || []);
      setStats({
        total_documents:      data.total_documents,
        total_chunks:         data.total_chunks,
        knowledge_base_ready: data.total_documents > 0,
      });
    } catch (err) {
      console.error("Failed to load documents:", err.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleUploadSuccess() {
    try {
      const data = await fetchDocuments();
      setDocuments(data.documents || []);
      setStats({
        total_documents:      data.total_documents,
        total_chunks:         data.total_chunks,
        knowledge_base_ready: data.total_documents > 0,
      });
    } catch (err) {
      console.error("Failed to refresh after upload:", err.message);
    }
  }

  async function handleDocumentDeleted() {
    try {
      const data = await fetchDocuments();
      setDocuments(data.documents || []);
      setStats({
        total_documents:      data.total_documents,
        total_chunks:         data.total_chunks,
        knowledge_base_ready: data.total_documents > 0,
      });
    } catch (err) {
      console.error("Failed to refresh after delete:", err.message);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <StatsBar stats={stats} />

      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="px-3 pt-3">
          <SectionHeader title="Upload Document" />
          <DocumentUpload onUploadSuccess={handleUploadSuccess} />
        </div>

        <div className="mx-4 my-3 border-t border-gray-100" />

        <div className="flex-1 px-3 pb-3">
          <SectionHeader title="Ingested Documents" count={documents.length} />
          <DocumentList documents={documents} onDocumentDeleted={handleDocumentDeleted} />
        </div>
      </div>

      <SidebarFooter />
    </div>
  );
}