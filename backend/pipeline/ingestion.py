# pipeline/ingestion.py

import os
import uuid
import hashlib
from pathlib import Path
from typing import Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader

from core.config import (
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    RAW_DATA_DIR,
    PROCESSED_DATA_DIR,
)
from core.cohere_client import generate_embeddings
from core.chroma_client import add_documents, document_exists


# ── Supported File Types ──────────────────────────────────────────────────────
SUPPORTED_EXTENSIONS = {
    ".pdf": "pdf",
    ".txt": "text",
}


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — FILE LOADING
# ══════════════════════════════════════════════════════════════════════════════

def load_document(file_path: Path) -> list[dict]:
    """
    Load a document from disk and return a list of page dicts.
    Automatically detects scanned PDFs and runs OCR on them.

    Each page dict contains:
        - content  : Raw text of the page
        - page     : Page number (1-indexed)
        - source   : Absolute file path as string

    Supports PDF (text-based and scanned) and plain text files.
    Raises ValueError for unsupported file types.
    """
    from pipeline.ocr import is_scanned_pdf, ocr_pdf

    extension = file_path.suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{extension}'. "
            f"Supported types: {list(SUPPORTED_EXTENSIONS.keys())}"
        )

    pages = []

    try:
        if extension == ".pdf":

            # ── Detect if scanned or text-based ──────────────────────────────
            if is_scanned_pdf(file_path):
                print(f"🖼️  '{file_path.name}' is a scanned PDF — using OCR.")
                pages = ocr_pdf(file_path)

            else:
                print(f"📄 '{file_path.name}' is text-based — using standard loader.")
                loader = PyPDFLoader(str(file_path))
                raw_pages = loader.load()

                for i, page in enumerate(raw_pages):
                    content = page.page_content.strip()
                    if content:
                        pages.append({
                            "content": content,
                            "page":    i + 1,
                            "source":  str(file_path),
                        })

        elif extension == ".txt":
            loader = TextLoader(str(file_path), encoding="utf-8")
            raw_docs = loader.load()

            for doc in raw_docs:
                content = doc.page_content.strip()
                if content:
                    pages.append({
                        "content": content,
                        "page":    1,
                        "source":  str(file_path),
                    })

    except Exception as e:
        raise RuntimeError(f"❌ Failed to load document '{file_path.name}': {e}")

    if not pages:
        raise ValueError(
            f"❌ Document '{file_path.name}' appears to be empty or unreadable."
        )

    print(f"📄 Loaded '{file_path.name}' — {len(pages)} page(s) extracted.")
    return pages

# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — TEXT CLEANING
# ══════════════════════════════════════════════════════════════════════════════

def clean_text(text: str) -> str:
    """
    Clean raw extracted text from PDF or plain text files.

    Operations performed:
        - Collapse multiple consecutive blank lines into one
        - Remove null bytes and non-printable control characters
        - Strip leading and trailing whitespace per line
        - Remove lines that are purely numeric (page numbers)
        - Normalize multiple spaces into single spaces

    Legal documents often have heavy header/footer artifacts from PDF
    extraction. This function reduces noise before chunking.
    """
    import re

    # Remove null bytes
    text = text.replace("\x00", "")

    # Remove non-printable control characters except newlines and tabs
    text = re.sub(r"[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]", "", text)

    # Split into lines and clean each
    lines = text.splitlines()
    cleaned_lines = []

    for line in lines:
        stripped = line.strip()

        # Skip lines that are purely numeric (page numbers)
        if stripped.isdigit():
            continue

        # Skip very short lines that are likely artifacts (e.g. "| |", "—")
        if len(stripped) < 3 and stripped not in ["", "\n"]:
            continue

        cleaned_lines.append(stripped)

    # Join lines and collapse multiple blank lines
    text = "\n".join(cleaned_lines)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Normalize multiple spaces
    text = re.sub(r" {2,}", " ", text)

    return text.strip()


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — SECTION DETECTION
# ══════════════════════════════════════════════════════════════════════════════

def detect_section(text: str) -> str:
    """
    Attempt to detect the section or article heading from a chunk of text.

    Looks for common legal document structural patterns:
        - "Article 17", "Section 3.2", "Clause 4", "Part II"
        - "Chapter 1", "Schedule 2", "Regulation 5"

    Returns the first matching heading found, or "General" if none found.
    This value is stored as metadata on every chunk in ChromaDB and
    appears in citations shown to the user.
    """
    import re

    patterns = [
        r"(Article\s+\d+[\w\.]*)",
        r"(Section\s+\d+[\w\.]*)",
        r"(Clause\s+\d+[\w\.]*)",
        r"(Part\s+[IVXLCDM]+|\bPart\s+\d+)",
        r"(Chapter\s+\d+[\w\.]*)",
        r"(Schedule\s+\d+[\w\.]*)",
        r"(Regulation\s+\d+[\w\.]*)",
        r"(Rule\s+\d+[\w\.]*)",
        r"(\d+\.\d+[\w\.]*\s+[A-Z][a-z]+)",  # e.g. "3.2 Definitions"
    ]

    for pattern in patterns:
        match = re.search(pattern, text[:500], re.IGNORECASE)
        if match:
            return match.group(1).strip()

    return "General"


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — CHUNKING
# ══════════════════════════════════════════════════════════════════════════════

def chunk_pages(pages: list[dict], filename: str) -> list[dict]:
    """
    Split loaded pages into smaller overlapping chunks suitable for embedding.

    Strategy:
        1. Clean each page's text first.
        2. Apply RecursiveCharacterTextSplitter with legal-aware separators.
           The separator priority list is ordered from largest legal boundary
           (double newline / section break) down to word boundary.
        3. Detect section heading for each chunk.
        4. Attach full metadata to every chunk.

    Each returned chunk dict contains:
        - id        : Unique deterministic ID (hash of filename + chunk index)
        - text      : The cleaned chunk text
        - metadata  : filename, source, page, section, chunk_index

    Args:
        pages    : List of page dicts from load_document()
        filename : Original filename for metadata and ID generation

    Returns:
        List of chunk dicts ready for embedding and ChromaDB storage.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=[
            "\n\n",        # Paragraph / section boundary (highest priority)
            "\n",          # Line boundary
            ". ",          # Sentence boundary
            ", ",          # Clause boundary
            " ",           # Word boundary
            "",            # Character boundary (last resort)
        ],
        length_function=len,
    )

    all_chunks = []
    chunk_index = 0

    for page in pages:
        raw_text = page["content"]
        page_number = page["page"]
        source = page["source"]

        cleaned = clean_text(raw_text)

        if not cleaned:
            continue

        # Split this page's text into chunks
        splits = splitter.split_text(cleaned)

        for split_text in splits:
            split_text = split_text.strip()

            if not split_text or len(split_text) < 50:
                # Skip chunks that are too short to be meaningful
                continue

            section = detect_section(split_text)

            # Generate a deterministic unique ID based on filename + index
            raw_id = f"{filename}_{chunk_index}"
            chunk_id = hashlib.md5(raw_id.encode()).hexdigest()

            all_chunks.append({
                "id": chunk_id,
                "text": split_text,
                "metadata": {
                    "filename": filename,
                    "source": source,
                    "page": str(page_number),
                    "section": section,
                    "chunk_index": str(chunk_index),
                },
            })

            chunk_index += 1

    print(f"✂️  '{filename}' split into {len(all_chunks)} chunks.")
    return all_chunks


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — EMBEDDING
# ══════════════════════════════════════════════════════════════════════════════

def embed_chunks(chunks: list[dict]) -> list[dict]:
    """
    Generate Cohere embeddings for all chunks in batches.

    Cohere Embed v3 has a maximum batch size of 96 texts per API call.
    This function handles batching automatically so you never hit that limit
    regardless of how large the document is.

    Each chunk dict is updated in place with an 'embedding' key containing
    the vector as a list of floats.

    Args:
        chunks : List of chunk dicts from chunk_pages()

    Returns:
        Same list of chunk dicts, each now containing an 'embedding' field.
    """
    COHERE_BATCH_SIZE = 90  # Stay under the 96 limit with a safety margin

    texts = [chunk["text"] for chunk in chunks]
    all_embeddings = []

    total_batches = (len(texts) + COHERE_BATCH_SIZE - 1) // COHERE_BATCH_SIZE

    for batch_num in range(total_batches):
        start = batch_num * COHERE_BATCH_SIZE
        end = start + COHERE_BATCH_SIZE
        batch_texts = texts[start:end]

        print(f"🔢 Embedding batch {batch_num + 1}/{total_batches} "
              f"({len(batch_texts)} chunks)...")

        batch_embeddings = generate_embeddings(
            texts=batch_texts,
            input_type="search_document",
        )
        all_embeddings.extend(batch_embeddings)

    for chunk, embedding in zip(chunks, all_embeddings):
        chunk["embedding"] = embedding

    print(f"✅ Generated {len(all_embeddings)} embeddings successfully.")
    return chunks


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — STORAGE
# ══════════════════════════════════════════════════════════════════════════════

def store_chunks(chunks: list[dict]) -> None:
    """
    Store embedded chunks into ChromaDB.

    Extracts parallel lists of ids, embeddings, documents, and metadatas
    from the chunk dicts and passes them to chroma_client.add_documents().

    Args:
        chunks : List of chunk dicts with 'embedding' field populated.
    """
    ids = [chunk["id"] for chunk in chunks]
    embeddings = [chunk["embedding"] for chunk in chunks]
    documents = [chunk["text"] for chunk in chunks]
    metadatas = [chunk["metadata"] for chunk in chunks]

    add_documents(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 7 — MAIN INGESTION ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def ingest_document(file_path: Path) -> dict:
    """
    Full ingestion pipeline for a single document.

    Runs all stages in sequence:
        Load → Clean → Chunk → Embed → Store

    Args:
        file_path : Path object pointing to the document in data/raw/

    Returns:
        A result dict containing:
            - filename      : Name of the ingested file
            - status        : 'success' or 'skipped' or 'error'
            - chunks_stored : Number of chunks added to ChromaDB
            - message       : Human-readable status message

    This function is called by:
        - routers/documents.py  when a user uploads a file via the API
        - ingest_all()          when bulk ingesting from data/raw/ on startup
    """
    filename = file_path.name

    # ── Duplicate Check ───────────────────────────────────────────────────────
    if document_exists(filename):
        print(f"⏭️  '{filename}' already ingested. Skipping.")
        return {
            "filename": filename,
            "status": "skipped",
            "chunks_stored": 0,
            "message": f"'{filename}' is already in the knowledge base.",
        }

    try:
        print(f"\n{'═' * 60}")
        print(f"📥 Starting ingestion: {filename}")
        print(f"{'═' * 60}")

        # Stage 1 — Load
        pages = load_document(file_path)

        # Stage 2 — Chunk (clean happens inside chunk_pages)
        chunks = chunk_pages(pages, filename)

        if not chunks:
            return {
                "filename": filename,
                "status": "error",
                "chunks_stored": 0,
                "message": f"'{filename}' produced no valid chunks after processing.",
            }

        # Stage 3 — Embed
        chunks = embed_chunks(chunks)

        # Stage 4 — Store
        store_chunks(chunks)

        print(f"\n✅ Ingestion complete: '{filename}' — {len(chunks)} chunks stored.")

        return {
            "filename": filename,
            "status": "success",
            "chunks_stored": len(chunks),
            "message": f"'{filename}' successfully ingested with {len(chunks)} chunks.",
        }

    except Exception as e:
        print(f"❌ Ingestion failed for '{filename}': {e}")
        return {
            "filename": filename,
            "status": "error",
            "chunks_stored": 0,
            "message": f"Ingestion failed: {str(e)}",
        }


def ingest_all(directory: Optional[Path] = None) -> list[dict]:
    """
    Bulk ingest all supported documents from a directory.

    Scans the given directory (defaults to RAW_DATA_DIR from config)
    for all supported file types and runs ingest_document() on each one.

    Args:
        directory : Path to scan. Defaults to data/raw/

    Returns:
        List of result dicts from ingest_document(), one per file found.

    Useful for:
        - Initial setup when you drop documents into data/raw/ manually
        - A startup check to ensure all raw documents are ingested
    """
    target_dir = directory or RAW_DATA_DIR

    if not target_dir.exists():
        raise FileNotFoundError(
            f"❌ Directory not found: {target_dir}"
        )

    supported_files = [
        f for f in target_dir.iterdir()
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    ]

    if not supported_files:
        print(f"⚠️  No supported documents found in '{target_dir}'.")
        return []

    print(f"\n📂 Found {len(supported_files)} document(s) in '{target_dir}'.")

    results = []
    for file_path in supported_files:
        result = ingest_document(file_path)
        results.append(result)

    # ── Summary ───────────────────────────────────────────────────────────────
    success = sum(1 for r in results if r["status"] == "success")
    skipped = sum(1 for r in results if r["status"] == "skipped")
    errors  = sum(1 for r in results if r["status"] == "error")

    print(f"\n{'═' * 60}")
    print(f"📊 Ingestion Summary")
    print(f"   ✅ Success : {success}")
    print(f"   ⏭️  Skipped : {skipped}")
    print(f"   ❌ Errors  : {errors}")
    print(f"{'═' * 60}\n")

    return results