# core/cohere_client.py

import cohere
from core.config import (
    COHERE_API_KEY,
    COHERE_MODEL,
    EMBEDDING_MODEL,
    MAX_TOKENS,
    TEMPERATURE,
)


# ── Initialize Cohere Client ──────────────────────────────────────────────────
try:
    co = cohere.Client(api_key=COHERE_API_KEY)
    print("✅ Cohere client initialized successfully.")
except Exception as e:
    raise ConnectionError(f"❌ Failed to initialize Cohere client: {e}")


# ── Chat / Text Generation ────────────────────────────────────────────────────
def generate_response(
    prompt: str,
    temperature: float = TEMPERATURE,
    max_tokens: int = MAX_TOKENS,
) -> str:
    """
    Send a prompt to Cohere Command-R and return the generated text.
    Used by the Explainer Agent and Coordinator Agent.
    """
    try:
        response = co.chat(
            model=COHERE_MODEL,
            message=prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.text.strip()

    except cohere.errors.UnauthorizedError:
        raise PermissionError(
            "❌ Invalid Cohere API key. Check your .env file."
        )
    except cohere.errors.TooManyRequestsError:
        raise RuntimeError(
            "❌ Cohere rate limit reached. Wait a moment and try again."
        )
    except Exception as e:
        raise RuntimeError(f"❌ Cohere generation failed: {e}")


# ── Embedding Generation ──────────────────────────────────────────────────────
def generate_embeddings(
    texts: list[str],
    input_type: str = "search_document",
) -> list[list[float]]:
    """
    Generate vector embeddings for a list of texts using Cohere Embed v3.
    
    input_type options:
      - "search_document"  → use when embedding chunks during ingestion
      - "search_query"     → use when embedding a user query at search time
    
    Always match the input_type to the context. Mismatching degrades
    retrieval accuracy significantly.
    """
    try:
        response = co.embed(
            texts=texts,
            model=EMBEDDING_MODEL,
            input_type=input_type,
        )
        return response.embeddings

    except cohere.errors.UnauthorizedError:
        raise PermissionError(
            "❌ Invalid Cohere API key. Check your .env file."
        )
    except Exception as e:
        raise RuntimeError(f"❌ Cohere embedding failed: {e}")


# ── Query Embedding (Single) ──────────────────────────────────────────────────
def embed_query(query: str) -> list[float]:
    """
    Convenience wrapper to embed a single user query string.
    Uses input_type='search_query' which is required by Cohere Embed v3
    for query-time embeddings — different from document embeddings.
    """
    embeddings = generate_embeddings(
        texts=[query],
        input_type="search_query",
    )
    return embeddings[0]


# ── Classify / Route Query ────────────────────────────────────────────────────
def classify_query(prompt: str) -> str:
    """
    Used by the Coordinator Agent to classify incoming user queries
    into one of three task types before routing to the correct agent.
    Runs at low temperature for consistent, deterministic classification.
    """
    return generate_response(
        prompt=prompt,
        temperature=0.0,
        max_tokens=20,
    )