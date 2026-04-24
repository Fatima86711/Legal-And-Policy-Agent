# routers/documents.py

import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse

from core.config import (
    RAW_DATA_DIR,
    ALLOWED_FILE_TYPES,
    MAX_FILE_SIZE_BYTES,
    MAX_FILE_SIZE_MB,
)
from core.chroma_client import (
    list_documents,
    delete_document,
    get_collection_stats,
    document_exists,
)
from pipeline.ingestion import ingest_document


# ── Router Initialization ─────────────────────────────────────────────────────
router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def validate_file_type(content_type: str, filename: str) -> tuple[bool, str]:
    """
    Validate the uploaded file's MIME type and extension.

    Checks both the content_type header sent by the browser AND the
    file extension independently. Relying only on content_type is
    insecure because it can be spoofed by the client. Checking both
    provides a basic two-layer validation.

    Args:
        content_type : MIME type string from the upload request header
        filename     : Original filename string from the upload

    Returns:
        Tuple of (is_valid: bool, error_message: str).
        error_message is empty string if is_valid is True.
    """
    allowed_extensions = {".pdf", ".txt"}
    file_extension = Path(filename).suffix.lower()

    if content_type not in ALLOWED_FILE_TYPES:
        return False, (
            f"File type '{content_type}' is not supported. "
            f"Please upload a PDF or plain text file."
        )

    if file_extension not in allowed_extensions:
        return False, (
            f"File extension '{file_extension}' is not supported. "
            f"Allowed extensions: {', '.join(allowed_extensions)}"
        )

    return True, ""


def validate_file_size(file_size: int) -> tuple[bool, str]:
    """
    Validate that the uploaded file does not exceed the maximum size limit.

    Args:
        file_size : File size in bytes

    Returns:
        Tuple of (is_valid: bool, error_message: str).
    """
    if file_size > MAX_FILE_SIZE_BYTES:
        return False, (
            f"File size exceeds the {MAX_FILE_SIZE_MB}MB limit. "
            f"Please upload a smaller file or split the document."
        )
    return True, ""


def sanitize_filename(filename: str) -> str:
    """
    Sanitize the uploaded filename to prevent path traversal attacks
    and filesystem issues.

    Operations performed:
        - Strip leading and trailing whitespace
        - Replace spaces with underscores
        - Remove any path separators (/ and \\)
        - Remove characters that are unsafe in filenames
        - Truncate to 200 characters maximum

    Args:
        filename : Raw filename from the upload request

    Returns:
        Sanitized filename string safe for filesystem storage.
    """
    import re

    name = filename.strip()
    name = name.replace(" ", "_")
    name = name.replace("/", "").replace("\\", "")
    name = re.sub(r"[^\w\-_\.]", "", name)
    name = name[:200]

    if not name:
        name = "uploaded_document.pdf"

    return name


# ══════════════════════════════════════════════════════════════════════════════
# ROUTE 1 — UPLOAD DOCUMENT
# POST /documents/upload
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a legal document and ingest it into the ChromaDB knowledge base.

    Pipeline:
        1. Validate file type (MIME type + extension)
        2. Read file content and validate size
        3. Sanitize filename
        4. Check for duplicate (already ingested)
        5. Save file to data/raw/
        6. Run full ingestion pipeline (chunk → embed → store)
        7. Return ingestion result to frontend

    Request:
        Multipart form data with a single file field named 'file'.

    Response 201:
        {
            "message"       : "Success message",
            "filename"      : "sanitized_filename.pdf",
            "chunks_stored" : 42,
            "status"        : "success"
        }

    Response 400:
        { "detail": "Error description" }

    Response 409:
        { "detail": "Document already exists in knowledge base." }

    Response 500:
        { "detail": "Ingestion failed: <error>" }
    """
    print(f"\n📤 Upload request received: '{file.filename}'")

    # ── Step 1 — Validate File Type ───────────────────────────────────────────
    type_valid, type_error = validate_file_type(
        content_type=file.content_type or "",
        filename=file.filename or "",
    )

    if not type_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=type_error,
        )

    # ── Step 2 — Read Content and Validate Size ───────────────────────────────
    try:
        file_content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {str(e)}",
        )

    size_valid, size_error = validate_file_size(len(file_content))

    if not size_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=size_error,
        )

    # ── Step 3 — Sanitize Filename ────────────────────────────────────────────
    clean_filename = sanitize_filename(file.filename or "document.pdf")
    save_path = RAW_DATA_DIR / clean_filename

    print(f"📁 Sanitized filename: '{clean_filename}'")

    # ── Step 4 — Duplicate Check ──────────────────────────────────────────────
    if document_exists(clean_filename):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"'{clean_filename}' is already in the knowledge base. "
                f"Delete it first if you want to re-ingest it."
            ),
        )

    # ── Step 5 — Save File to Disk ────────────────────────────────────────────
    try:
        with open(save_path, "wb") as f:
            f.write(file_content)
        print(f"💾 File saved to: {save_path}")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file to disk: {str(e)}",
        )

    # ── Step 6 — Run Ingestion Pipeline ──────────────────────────────────────
    try:
        result = ingest_document(save_path)
    except Exception as e:
        # Clean up saved file if ingestion fails
        if save_path.exists():
            save_path.unlink()
            print(f"🗑️  Cleaned up failed upload: '{clean_filename}'")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion pipeline failed: {str(e)}",
        )

    # ── Step 7 — Handle Ingestion Result ─────────────────────────────────────
    if result["status"] == "error":
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"],
        )

    print(f"✅ Upload and ingestion complete: '{clean_filename}'")

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": f"'{clean_filename}' successfully uploaded and ingested.",
            "filename": clean_filename,
            "chunks_stored": result["chunks_stored"],
            "status": result["status"],
        },
    )


# ══════════════════════════════════════════════════════════════════════════════
# ROUTE 2 — LIST ALL DOCUMENTS
# GET /documents/
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/", status_code=status.HTTP_200_OK)
async def get_documents():
    """
    Return a list of all documents currently ingested in the knowledge base.

    Combines data from ChromaDB metadata (chunk counts, source paths)
    with filesystem data (file size in KB) to give the frontend a complete
    picture of each document.

    Response 200:
        {
            "documents": [
                {
                    "filename"    : "gdpr.pdf",
                    "chunk_count" : 87,
                    "source"      : "/path/to/data/raw/gdpr.pdf",
                    "file_size_kb": 245.3
                },
                ...
            ],
            "total_documents": 3,
            "total_chunks"   : 210
        }

    Response 500:
        { "detail": "Failed to retrieve documents: <error>" }
    """
    try:
        documents = list_documents()
        stats = get_collection_stats()

        # Enrich each document entry with filesystem info
        enriched = []
        for doc in documents:
            file_path = RAW_DATA_DIR / doc["filename"]
            file_size_kb = 0.0

            if file_path.exists():
                file_size_kb = round(file_path.stat().st_size / 1024, 2)

            enriched.append({
                "filename":     doc["filename"],
                "chunk_count":  doc["chunk_count"],
                "source":       doc.get("source", ""),
                "file_size_kb": file_size_kb,
            })

        return {
            "documents":       enriched,
            "total_documents": stats["total_documents"],
            "total_chunks":    stats["total_chunks"],
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve document list: {str(e)}",
        )


# ══════════════════════════════════════════════════════════════════════════════
# ROUTE 3 — GET SINGLE DOCUMENT INFO
# GET /documents/{filename}
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{filename}", status_code=status.HTTP_200_OK)
async def get_document(filename: str):
    """
    Return detailed information about a single ingested document.

    Args:
        filename : The sanitized filename as stored in ChromaDB metadata.

    Response 200:
        {
            "filename"    : "gdpr.pdf",
            "exists"      : true,
            "chunk_count" : 87,
            "file_size_kb": 245.3,
            "file_exists_on_disk": true
        }

    Response 404:
        { "detail": "Document 'gdpr.pdf' not found in knowledge base." }
    """
    try:
        if not document_exists(filename):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document '{filename}' not found in the knowledge base.",
            )

        documents = list_documents()
        doc_info = next(
            (d for d in documents if d["filename"] == filename),
            None,
        )

        file_path = RAW_DATA_DIR / filename
        file_size_kb = 0.0
        file_on_disk = file_path.exists()

        if file_on_disk:
            file_size_kb = round(file_path.stat().st_size / 1024, 2)

        return {
            "filename":           filename,
            "exists":             True,
            "chunk_count":        doc_info["chunk_count"] if doc_info else 0,
            "file_size_kb":       file_size_kb,
            "file_exists_on_disk": file_on_disk,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve document info: {str(e)}",
        )


# ══════════════════════════════════════════════════════════════════════════════
# ROUTE 4 — DELETE DOCUMENT
# DELETE /documents/{filename}
# ══════════════════════════════════════════════════════════════════════════════

@router.delete("/{filename}", status_code=status.HTTP_200_OK)
async def delete_document_route(filename: str):
    """
    Delete a document from both ChromaDB and the filesystem.

    Performs deletion in two stages:
        1. Delete all chunks from ChromaDB by filename metadata filter
        2. Delete the raw file from data/raw/ on disk

    Both stages are attempted independently. If the ChromaDB deletion
    succeeds but the disk deletion fails (e.g. file already missing),
    the response still reports success for ChromaDB deletion with a
    warning about the disk file, rather than returning an error.

    Args:
        filename : The sanitized filename to delete.

    Response 200:
        {
            "message"        : "Success message",
            "filename"       : "gdpr.pdf",
            "chunks_deleted" : 87,
            "disk_deleted"   : true
        }

    Response 404:
        { "detail": "Document not found in knowledge base." }

    Response 500:
        { "detail": "Deletion failed: <error>" }
    """
    print(f"\n🗑️  Delete request received: '{filename}'")

    # ── Check Existence ───────────────────────────────────────────────────────
    if not document_exists(filename):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{filename}' not found in the knowledge base.",
        )

    # ── Stage 1 — Delete from ChromaDB ───────────────────────────────────────
    try:
        chunks_deleted = delete_document(filename)
        print(f"✅ Deleted {chunks_deleted} chunk(s) from ChromaDB.")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document from knowledge base: {str(e)}",
        )

    # ── Stage 2 — Delete from Disk ────────────────────────────────────────────
    disk_deleted = False
    file_path = RAW_DATA_DIR / filename

    try:
        if file_path.exists():
            file_path.unlink()
            disk_deleted = True
            print(f"✅ Deleted file from disk: '{file_path}'")
        else:
            print(f"⚠️  File not found on disk (already missing): '{filename}'")
    except Exception as e:
        print(f"⚠️  ChromaDB deletion succeeded but disk deletion failed: {e}")

    return {
        "message": (
            f"'{filename}' successfully deleted from the knowledge base."
            if disk_deleted
            else f"'{filename}' removed from knowledge base. "
                 f"File was not found on disk."
        ),
        "filename":       filename,
        "chunks_deleted": chunks_deleted,
        "disk_deleted":   disk_deleted,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ROUTE 5 — KNOWLEDGE BASE STATS
# GET /documents/stats/summary
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/stats/summary", status_code=status.HTTP_200_OK)
async def get_stats():
    """
    Return high-level statistics about the ChromaDB knowledge base.

    Used by the frontend dashboard to display a summary panel showing
    how many documents and chunks are currently available for querying.

    Response 200:
        {
            "total_chunks"     : 210,
            "total_documents"  : 3,
            "collection_name"  : "legal_documents",
            "knowledge_base_ready": true
        }

    Response 500:
        { "detail": "Failed to retrieve stats: <error>" }
    """
    try:
        stats = get_collection_stats()
        stats["knowledge_base_ready"] = stats["total_documents"] > 0
        return stats

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve knowledge base stats: {str(e)}",
        )