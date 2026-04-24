# core/chroma_client.py

import chromadb
from chromadb.config import Settings
from core.config import (
    CHROMA_PERSIST_DIR,
    CHROMA_COLLECTION_NAME,
    TOP_K_RESULTS,
    SIMILARITY_THRESHOLD,
)


# ── Initialize ChromaDB Client ────────────────────────────────────────────────
try:
    chroma_client = chromadb.PersistentClient(
        path=CHROMA_PERSIST_DIR,
        settings=Settings(anonymized_telemetry=False),
    )
    print("✅ ChromaDB client initialized successfully.")
except Exception as e:
    raise ConnectionError(f"❌ Failed to initialize ChromaDB client: {e}")


# ── Get or Create Collection ──────────────────────────────────────────────────
try:
    collection = chroma_client.get_or_create_collection(
        name=CHROMA_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    print(f"✅ Collection '{CHROMA_COLLECTION_NAME}' ready. "
          f"Total chunks stored: {collection.count()}")
except Exception as e:
    raise RuntimeError(f"❌ Failed to get or create ChromaDB collection: {e}")


# ── Add Documents to Collection ───────────────────────────────────────────────
def add_documents(
    ids: list[str],
    embeddings: list[list[float]],
    documents: list[str],
    metadatas: list[dict],
) -> None:
    """
    Store a batch of document chunks into ChromaDB.

    Args:
        ids        : Unique string ID for each chunk (e.g. 'gdpr_chunk_001')
        embeddings : Precomputed embedding vectors from Cohere Embed v3
        documents  : Raw text content of each chunk
        metadatas  : Dicts with keys like source, section, page, filename
    
    Called exclusively by pipeline/ingestion.py after chunking a document.
    """
    try:
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )
        print(f"✅ Successfully stored {len(ids)} chunks into ChromaDB.")
    except Exception as e:
        raise RuntimeError(f"❌ Failed to add documents to ChromaDB: {e}")


# ── Query Collection ──────────────────────────────────────────────────────────
def query_collection(
    query_embedding: list[float],
    top_k: int = TOP_K_RESULTS,
) -> list[dict]:
    """
    Search ChromaDB for the most semantically similar chunks to a query.

    Args:
        query_embedding : Single embedding vector generated from the user query
        top_k           : Number of top results to retrieve

    Returns:
        A list of result dicts, each containing:
            - text      : The raw chunk text
            - metadata  : Source, section, page, filename info
            - score     : Cosine similarity score (0.0 to 1.0)
        
        Only chunks above SIMILARITY_THRESHOLD are returned.
        If no chunks pass the threshold, returns an empty list.
    
    Called exclusively by agents/retrieval_agent.py.
    """
    try:
        raw_results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

        chunks = []

        documents = raw_results.get("documents", [[]])[0]
        metadatas = raw_results.get("metadatas", [[]])[0]
        distances = raw_results.get("distances", [[]])[0]

        for doc, meta, distance in zip(documents, metadatas, distances):
            # ChromaDB returns cosine distance (0=identical, 2=opposite)
            # Convert to similarity score (1=identical, 0=opposite)
            similarity_score = 1 - distance

            if similarity_score >= SIMILARITY_THRESHOLD:
                chunks.append({
                    "text": doc,
                    "metadata": meta,
                    "score": round(similarity_score, 4),
                })

        if not chunks:
            print("⚠️  No chunks found above similarity threshold.")

        return chunks

    except Exception as e:
        raise RuntimeError(f"❌ ChromaDB query failed: {e}")


# ── Check if Document Already Ingested ───────────────────────────────────────
def document_exists(filename: str) -> bool:
    """
    Check if a document has already been ingested into ChromaDB
    by searching for any chunk whose metadata filename matches.

    Prevents duplicate ingestion if the same file is uploaded twice.
    Called by pipeline/ingestion.py before processing a new file.
    """
    try:
        results = collection.get(
            where={"filename": filename},
            limit=1,
        )
        return len(results["ids"]) > 0
    except Exception as e:
        raise RuntimeError(f"❌ Failed to check document existence: {e}")


# ── Delete Document Chunks ────────────────────────────────────────────────────
def delete_document(filename: str) -> int:
    """
    Delete all chunks belonging to a specific document from ChromaDB.
    Returns the number of chunks deleted.

    Called by routers/documents.py when a user deletes an uploaded document.
    """
    try:
        existing = collection.get(where={"filename": filename})
        ids_to_delete = existing["ids"]

        if not ids_to_delete:
            print(f"⚠️  No chunks found for filename: {filename}")
            return 0

        collection.delete(ids=ids_to_delete)
        print(f"✅ Deleted {len(ids_to_delete)} chunks for '{filename}'.")
        return len(ids_to_delete)

    except Exception as e:
        raise RuntimeError(f"❌ Failed to delete document from ChromaDB: {e}")


# ── List All Ingested Documents ───────────────────────────────────────────────
def list_documents() -> list[dict]:
    """
    Return a deduplicated list of all documents currently stored in ChromaDB.
    Each entry contains the filename, source path, and chunk count.

    Called by routers/documents.py to show the user their uploaded documents.
    """
    try:
        all_items = collection.get(include=["metadatas"])
        metadatas = all_items.get("metadatas", [])

        seen = {}
        for meta in metadatas:
            fname = meta.get("filename", "unknown")
            if fname not in seen:
                seen[fname] = {
                    "filename": fname,
                    "source": meta.get("source", ""),
                    "chunk_count": 1,
                }
            else:
                seen[fname]["chunk_count"] += 1

        return list(seen.values())

    except Exception as e:
        raise RuntimeError(f"❌ Failed to list documents from ChromaDB: {e}")


# ── Collection Stats ──────────────────────────────────────────────────────────
def get_collection_stats() -> dict:
    """
    Return basic stats about the ChromaDB collection.
    Useful for the frontend dashboard and debugging.
    """
    try:
        total_chunks = collection.count()
        documents = list_documents()

        return {
            "total_chunks": total_chunks,
            "total_documents": len(documents),
            "collection_name": CHROMA_COLLECTION_NAME,
        }
    except Exception as e:
        raise RuntimeError(f"❌ Failed to get collection stats: {e}")