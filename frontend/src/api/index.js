// frontend/src/api/index.js

// ── Base URL ──────────────────────────────────────────────────────────────────
// This is the only place the backend URL appears in the entire frontend.
// Change this one constant if your backend moves to a different port or host.
const BASE_URL = "http://127.0.0.1:8000";


// ── Helper — Parse Error ──────────────────────────────────────────────────────
// Extracts the most useful error message from a failed API response.
// FastAPI returns errors in a { detail: "..." } shape.
// If that is not available, falls back to the HTTP status text.
async function parseError(response) {
  try {
    const data = await response.json();
    return data.detail || data.message || response.statusText;
  } catch {
    return response.statusText || "An unknown error occurred.";
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// CHAT ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Send a Chat Query ─────────────────────────────────────────────────────────
// Calls POST /chat/query with the user's query string.
// Returns the full coordinator result dict from the backend.
//
// Expected response shape:
// {
//   query, response, task_type, sources, chunks_used,
//   top_score, avg_score, used_fallback, is_valid,
//   warnings, error, processing_time_ms
// }
export async function sendQuery(query) {
  const response = await fetch(`${BASE_URL}/chat/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }

  return await response.json();
}


// ── Classify a Query (No Generation) ─────────────────────────────────────────
// Calls POST /chat/classify — returns only the task type label.
// Useful for showing the user what type of task their query triggered
// before the full response arrives.
//
// Expected response shape:
// { query, task_type, processing_time_ms }
export async function classifyQuery(query) {
  const response = await fetch(`${BASE_URL}/chat/classify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }

  return await response.json();
}


// ── Chat Health Check ─────────────────────────────────────────────────────────
// Calls GET /chat/health — confirms the backend chat pipeline is reachable.
// Called on app load to show the connection status in the Header.
//
// Expected response shape:
// { status, service, message }
export async function checkChatHealth() {
  const response = await fetch(`${BASE_URL}/chat/health`);

  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }

  return await response.json();
}


// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Upload a Document ─────────────────────────────────────────────────────────
// Calls POST /documents/upload with the file as multipart form data.
// Returns the ingestion result including chunks_stored and status.
//
// Args:
//   file — a browser File object from an <input type="file"> or react-dropzone
//
// Expected response shape:
// { message, filename, chunks_stored, status }
export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BASE_URL}/documents/upload`, {
    method: "POST",
    body: formData,
    // Do NOT set Content-Type header manually when using FormData.
    // The browser sets it automatically with the correct multipart boundary.
  });

  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }

  return await response.json();
}


// ── Fetch All Documents ───────────────────────────────────────────────────────
// Calls GET /documents/ — returns the list of all ingested documents.
// Called on app load and after every upload or delete.
//
// Expected response shape:
// {
//   documents: [{ filename, chunk_count, source, file_size_kb }],
//   total_documents,
//   total_chunks
// }
export async function fetchDocuments() {
  const response = await fetch(`${BASE_URL}/documents/`);

  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }

  return await response.json();
}


// ── Delete a Document ─────────────────────────────────────────────────────────
// Calls DELETE /documents/{filename} — removes all chunks from ChromaDB
// and deletes the raw file from disk.
//
// Args:
//   filename — the exact sanitized filename string as stored in ChromaDB
//
// Expected response shape:
// { message, filename, chunks_deleted, disk_deleted }
export async function deleteDocument(filename) {
  const response = await fetch(
    `${BASE_URL}/documents/${encodeURIComponent(filename)}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }

  return await response.json();
}


// ── Fetch Knowledge Base Stats ────────────────────────────────────────────────
// Calls GET /documents/stats/summary — returns aggregate counts.
// Used by the Header status indicator and the Sidebar stats bar.
//
// Expected response shape:
// { total_chunks, total_documents, collection_name, knowledge_base_ready }
export async function fetchStats() {
  const response = await fetch(`${BASE_URL}/documents/stats/summary`);

  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }

  return await response.json();
}


// ── Fetch Single Document Info ────────────────────────────────────────────────
// Calls GET /documents/{filename} — returns details about one document.
// Optional — can be used to show a detail view for a specific document.
//
// Expected response shape:
// { filename, exists, chunk_count, file_size_kb, file_exists_on_disk }
export async function fetchDocumentInfo(filename) {
  const response = await fetch(
    `${BASE_URL}/documents/${encodeURIComponent(filename)}`
  );

  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }

  return await response.json();
}