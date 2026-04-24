# backend/main.py

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import ALLOWED_ORIGINS, IS_DEV
from routers import chat, documents


# ══════════════════════════════════════════════════════════════════════════════
# LIFESPAN — Startup & Shutdown Events
# ══════════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application startup and shutdown logic.

    On startup:
        - Confirms core clients (Cohere + ChromaDB) are initialized
        - Optionally bulk-ingests any documents already in data/raw/
        - Prints a ready message with available routes

    On shutdown:
        - Prints a clean shutdown message
    """
    # ── Startup ───────────────────────────────────────────────────────────────
    print("\n" + "█" * 60)
    print("  Legal & Policy Analysis AI Agent — Starting Up")
    print("█" * 60)

    # Trigger client initialization by importing them.
    # Both clients print a ✅ confirmation on successful init.
    from core.cohere_client import co
    from core.chroma_client import collection

    # Optional: auto-ingest any documents already sitting in data/raw/
    # This is useful during development when you drop PDFs manually.
    try:
        from pipeline.ingestion import ingest_all
        from core.config import RAW_DATA_DIR

        raw_files = list(RAW_DATA_DIR.iterdir()) if RAW_DATA_DIR.exists() else []
        supported = [f for f in raw_files if f.suffix.lower() in {".pdf", ".txt"}]

        if supported:
            print(f"\n📂 Found {len(supported)} document(s) in data/raw/ — running auto-ingest...")
            ingest_all()
        else:
            print("\nℹ️  No documents found in data/raw/ — skipping auto-ingest.")

    except Exception as e:
        print(f"⚠️  Auto-ingest skipped due to error: {e}")

    print("\n" + "─" * 60)
    print("  ✅ Backend is ready.")
    print("  📡 API docs available at: http://127.0.0.1:8000/docs")
    print("─" * 60 + "\n")

    yield  # Application runs here

    # ── Shutdown ──────────────────────────────────────────────────────────────
    print("\n" + "█" * 60)
    print("  Legal & Policy Analysis AI Agent — Shutting Down")
    print("█" * 60 + "\n")


# ══════════════════════════════════════════════════════════════════════════════
# APPLICATION INSTANCE
# ══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Legal & Policy Analysis AI Agent",
    description=(
        "A multi-agent AI system for legal and policy document analysis. "
        "Supports document ingestion, RAG-based retrieval, legal terminology "
        "explanation, and comparative legal analysis using Cohere Command-R "
        "and ChromaDB."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ══════════════════════════════════════════════════════════════════════════════
# MIDDLEWARE — CORS
# ══════════════════════════════════════════════════════════════════════════════

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════════
# MIDDLEWARE — REQUEST TIMING
# ══════════════════════════════════════════════════════════════════════════════

@app.middleware("http")
async def add_request_timing(request: Request, call_next):
    """
    Middleware that measures and logs the total time taken for every
    incoming HTTP request. Adds an X-Process-Time-Ms header to every
    response so the frontend can read it from response headers if needed.
    """
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    response.headers["X-Process-Time-Ms"] = str(round(duration_ms, 2))

    print(f"  [{request.method}] {request.url.path} — {duration_ms:.2f}ms")

    return response


# ══════════════════════════════════════════════════════════════════════════════
# ROUTERS
# ══════════════════════════════════════════════════════════════════════════════

app.include_router(chat.router)
app.include_router(documents.router)


# ══════════════════════════════════════════════════════════════════════════════
# ROOT ROUTE
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint. Returns a basic system info response confirming
    the API is running. Used by the frontend health check on load.
    """
    return {
        "name":    "Legal & Policy Analysis AI Agent",
        "version": "1.0.0",
        "status":  "running",
        "docs":    "/docs",
        "routes": {
            "chat":      "/chat/query",
            "classify":  "/chat/classify",
            "health":    "/chat/health",
            "documents": "/documents/",
            "stats":     "/documents/stats/summary",
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# GLOBAL EXCEPTION HANDLER
# ══════════════════════════════════════════════════════════════════════════════

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all exception handler for any unhandled error that escapes
    the routers. Returns a clean JSON error response instead of a
    raw 500 HTML page, which is important for the React frontend to
    handle errors gracefully.
    """
    print(f"\n❌ Unhandled exception on [{request.method}] {request.url.path}")
    print(f"   Error: {exc}")

    return JSONResponse(
        status_code=500,
        content={
            "error":   "Internal server error.",
            "detail":  str(exc) if IS_DEV else "An unexpected error occurred.",
            "path":    str(request.url.path),
            "method":  request.method,
        },
    )


# ══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT — Run directly with `python main.py`
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=IS_DEV,
        log_level="info" if IS_DEV else "warning",
    )