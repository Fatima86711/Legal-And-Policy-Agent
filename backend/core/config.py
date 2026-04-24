# core/config.py

import os
from pathlib import Path
from dotenv import load_dotenv

# ── Load .env file ────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


# ── Cohere Settings ───────────────────────────────────────────────────────────
COHERE_API_KEY: str = os.getenv("COHERE_API_KEY", "")
COHERE_MODEL: str = os.getenv("COHERE_MODEL", "command-r")
EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "embed-english-v3.0")

if not COHERE_API_KEY:
    raise EnvironmentError(
        "COHERE_API_KEY is not set. Please add it to your .env file."
    )


# ── ChromaDB Settings ─────────────────────────────────────────────────────────
CHROMA_PERSIST_DIR: str = os.getenv(
    "CHROMA_PERSIST_DIR",
    str(BASE_DIR / "vectorstore")
)
CHROMA_COLLECTION_NAME: str = "legal_documents"


# ── Chunking Settings ─────────────────────────────────────────────────────────
CHUNK_SIZE: int = 800          # Max tokens per chunk
CHUNK_OVERLAP: int = 150       # Overlap between consecutive chunks
TOP_K_RESULTS: int = 5         # Number of chunks retrieved per query
SIMILARITY_THRESHOLD: float = 0.5  # Minimum similarity score to include a chunk


# ── LLM Generation Settings ───────────────────────────────────────────────────
MAX_TOKENS: int = 1024         # Max tokens in LLM response
TEMPERATURE: float = 0.2       # Low = more factual, High = more creative


# ── App Settings ──────────────────────────────────────────────────────────────
APP_ENV: str = os.getenv("APP_ENV", "development")
IS_DEV: bool = APP_ENV == "development"

ALLOWED_ORIGINS: list[str] = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

ALLOWED_FILE_TYPES: list[str] = [
    "application/pdf",
    "text/plain",
]

MAX_FILE_SIZE_MB: int = 20
MAX_FILE_SIZE_BYTES: int = MAX_FILE_SIZE_MB * 1024 * 1024


# ── Data Directories ──────────────────────────────────────────────────────────
RAW_DATA_DIR: Path = BASE_DIR / "data" / "raw"
PROCESSED_DATA_DIR: Path = BASE_DIR / "data" / "processed"

# Create directories if they don't exist
RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)


# OCR Settings
TESSERACT_PATH: str = os.getenv("TESSERACT_PATH", r"C:\Program Files\Tesseract-OCR\tesseract.exe")
POPPLER_PATH: str = os.getenv("POPPLER_PATH", r"C:\Release-25.12.0-0\poppler-25.12.0\Library\bin")

