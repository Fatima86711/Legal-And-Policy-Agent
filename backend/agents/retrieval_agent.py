# agents/retrieval_agent.py

from core.cohere_client import embed_query
from core.chroma_client import query_collection
from core.config import TOP_K_RESULTS, SIMILARITY_THRESHOLD


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — QUERY PREPROCESSING
# ══════════════════════════════════════════════════════════════════════════════

def preprocess_query(query: str) -> str:
    """
    Clean and normalize the user's raw query before embedding.

    Operations performed:
        - Strip leading and trailing whitespace
        - Collapse multiple spaces into one
        - Remove newlines and tab characters
        - Truncate to 512 characters maximum (Cohere Embed v3 token limit
          for query inputs is well within this range and excessively long
          queries dilute the embedding signal)

    Args:
        query : Raw query string from the user

    Returns:
        Cleaned query string ready for embedding.
    """
    import re

    query = query.strip()
    query = re.sub(r"[\n\t\r]", " ", query)
    query = re.sub(r" {2,}", " ", query)
    query = query[:512]

    return query


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — QUERY EXPANSION
# ══════════════════════════════════════════════════════════════════════════════

def expand_query(query: str) -> str:
    """
    Expand the user query with legal synonyms and related terms to improve
    retrieval recall.

    Legal documents use highly formal and specific vocabulary. A user asking
    about "fines" may not retrieve chunks that use the word "penalties" or
    "sanctions." This function maps common informal terms to their formal
    legal equivalents and appends them to the query so the embedding captures
    a broader semantic range.

    This is a lightweight rule-based expansion. It does not call the LLM,
    keeping retrieval fast and cost-free.

    Args:
        query : Preprocessed query string

    Returns:
        Expanded query string with appended legal synonyms where applicable.
    """
    legal_synonyms = {
        "fine":          "penalty sanction monetary punishment",
        "fines":         "penalties sanctions monetary punishment",
        "punishment":    "penalty sanction liability",
        "ban":           "prohibition restriction injunction",
        "banned":        "prohibited restricted enjoined",
        "allowed":       "permitted authorized lawful",
        "not allowed":   "prohibited unlawful restricted forbidden",
        "rights":        "entitlements legal rights provisions",
        "rule":          "regulation provision statute article clause",
        "rules":         "regulations provisions statutes articles clauses",
        "law":           "statute legislation act regulation",
        "laws":          "statutes legislation acts regulations",
        "company":       "organization entity corporation legal person",
        "companies":     "organizations entities corporations legal persons",
        "personal data": "personal information data subject private data",
        "delete":        "erasure right to be forgotten removal",
        "share":         "transfer disclose transmit process",
        "consent":       "authorization permission agreement lawful basis",
        "complaint":     "grievance petition application claim",
        "court":         "tribunal judiciary judicial authority",
        "contract":      "agreement deed instrument obligation",
        "break":         "breach violation infringement non-compliance",
        "breaking":      "breaching violating infringing non-compliant",
    }

    query_lower = query.lower()
    expansions = []

    for term, synonyms in legal_synonyms.items():
        if term in query_lower:
            expansions.append(synonyms)

    if expansions:
        expanded = query + " " + " ".join(expansions)
        return expanded.strip()

    return query


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — RESULT RERANKING
# ══════════════════════════════════════════════════════════════════════════════

def rerank_results(chunks: list[dict], query: str) -> list[dict]:
    """
    Apply a secondary scoring pass over retrieved chunks to improve ranking.

    ChromaDB returns results ordered by cosine similarity of embeddings.
    This reranking layer applies additional heuristics on top of that score
    to surface the most legally relevant chunks:

    Scoring bonuses applied:
        +0.05  if the query terms appear directly in the chunk text
               (exact keyword overlap signals high relevance)
        +0.03  if the chunk's detected section matches a legal structural
               marker relevant to the query (e.g. query mentions "Article 17"
               and chunk section is "Article 17")
        +0.02  if the chunk is from the first 20% of the document
               (definitions and scope sections appear early and are often
               the most foundational for legal analysis)

    Results are re-sorted by the adjusted score in descending order.

    Args:
        chunks : List of chunk dicts from query_collection()
        query  : Original preprocessed query string

    Returns:
        Re-sorted list of chunk dicts with updated 'score' values.
    """
    import re

    query_terms = set(re.findall(r"\b\w{4,}\b", query.lower()))

    for chunk in chunks:
        text_lower = chunk["text"].lower()
        meta = chunk["metadata"]
        base_score = chunk["score"]
        bonus = 0.0

        # Bonus 1 — Keyword overlap
        chunk_terms = set(re.findall(r"\b\w{4,}\b", text_lower))
        overlap = query_terms & chunk_terms
        if overlap:
            overlap_ratio = len(overlap) / max(len(query_terms), 1)
            bonus += min(overlap_ratio * 0.05, 0.05)

        # Bonus 2 — Section header match
        section = meta.get("section", "").lower()
        for term in query_terms:
            if term in section:
                bonus += 0.03
                break

        # Bonus 3 — Early document position (definitions / scope sections)
        try:
            chunk_index = int(meta.get("chunk_index", 999))
            if chunk_index <= 10:
                bonus += 0.02
        except ValueError:
            pass

        chunk["score"] = round(min(base_score + bonus, 1.0), 4)

    reranked = sorted(chunks, key=lambda x: x["score"], reverse=True)
    return reranked


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — DEDUPLICATION
# ══════════════════════════════════════════════════════════════════════════════

def deduplicate_chunks(chunks: list[dict]) -> list[dict]:
    """
    Remove near-duplicate chunks from the retrieved results.

    Because of the chunk overlap strategy used during ingestion
    (CHUNK_OVERLAP = 150 characters), adjacent chunks share text.
    If both are retrieved for the same query, the LLM receives
    almost identical content twice, wasting context window space
    and potentially over-weighting that section.

    This function removes any chunk whose first 100 characters
    are identical to an already-seen chunk. This catches direct
    duplicates and heavily overlapping near-duplicates.

    Args:
        chunks : List of chunk dicts, possibly containing near-duplicates

    Returns:
        Deduplicated list preserving original order.
    """
    seen_prefixes = set()
    unique_chunks = []

    for chunk in chunks:
        # Use first 100 characters as a fingerprint
        prefix = chunk["text"][:100].strip().lower()

        if prefix not in seen_prefixes:
            seen_prefixes.add(prefix)
            unique_chunks.append(chunk)

    removed = len(chunks) - len(unique_chunks)
    if removed > 0:
        print(f"🔁 Deduplication removed {removed} near-duplicate chunk(s).")

    return unique_chunks


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — RESULT FORMATTING
# ══════════════════════════════════════════════════════════════════════════════

def format_retrieval_results(chunks: list[dict]) -> dict:
    """
    Format the final list of retrieved chunks into a structured result dict
    that the Coordinator and Explainer agents consume.

    Returns a dict containing:
        - chunks        : The list of chunk dicts (text, metadata, score)
        - total_found   : How many chunks passed filtering
        - sources       : Deduplicated list of source filenames cited
        - has_results   : Boolean flag for empty result handling
        - top_score     : The highest similarity score in the result set
        - avg_score     : Average similarity score across all results

    Args:
        chunks : Final deduplicated and reranked list of chunk dicts

    Returns:
        Structured result dict consumed by agents/explainer_agent.py
    """
    if not chunks:
        return {
            "chunks": [],
            "total_found": 0,
            "sources": [],
            "has_results": False,
            "top_score": 0.0,
            "avg_score": 0.0,
        }

    scores = [c["score"] for c in chunks]
    sources = list({c["metadata"].get("filename", "Unknown") for c in chunks})

    return {
        "chunks": chunks,
        "total_found": len(chunks),
        "sources": sources,
        "has_results": True,
        "top_score": round(max(scores), 4),
        "avg_score": round(sum(scores) / len(scores), 4),
    }


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — MAIN RETRIEVAL ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def retrieve(
    query: str,
    top_k: int = TOP_K_RESULTS,
    use_expansion: bool = True,
) -> dict:
    """
    Main entry point for the Retrieval Agent.

    Runs the full retrieval pipeline in sequence:
        Preprocess → Expand → Embed → Query ChromaDB →
        Rerank → Deduplicate → Format

    Args:
        query         : Raw user query string from the Coordinator
        top_k         : Number of chunks to retrieve from ChromaDB
        use_expansion : Whether to apply query expansion (default True)
                        Set to False for exact terminology queries where
                        expansion might dilute the embedding signal

    Returns:
        Structured result dict from format_retrieval_results() containing
        chunks, sources, scores, and has_results flag.

    Called exclusively by agents/coordinator.py.
    """
    print(f"\n{'─' * 50}")
    print(f"🔍 Retrieval Agent — Query received:")
    print(f"   {query[:120]}{'...' if len(query) > 120 else ''}")
    print(f"{'─' * 50}")

    # Stage 1 — Preprocess
    clean_query = preprocess_query(query)

    # Stage 2 — Expand (optional)
    if use_expansion:
        expanded_query = expand_query(clean_query)
        if expanded_query != clean_query:
            print(f"📖 Query expanded with legal synonyms.")
    else:
        expanded_query = clean_query

    # Stage 3 — Embed the query
    print(f"🔢 Generating query embedding...")
    query_embedding = embed_query(expanded_query)

    # Stage 4 — Query ChromaDB
    print(f"📚 Searching ChromaDB (top_k={top_k})...")
    raw_chunks = query_collection(
        query_embedding=query_embedding,
        top_k=top_k,
    )

    if not raw_chunks:
        print(f"⚠️  No chunks retrieved above similarity threshold "
              f"({SIMILARITY_THRESHOLD}).")
        return format_retrieval_results([])

    print(f"📎 Retrieved {len(raw_chunks)} chunk(s) above threshold.")

    # Stage 5 — Rerank
    reranked = rerank_results(raw_chunks, clean_query)

    # Stage 6 — Deduplicate
    deduplicated = deduplicate_chunks(reranked)

    # Stage 7 — Format and return
    result = format_retrieval_results(deduplicated)

    print(f"✅ Retrieval complete — {result['total_found']} chunk(s) returned.")
    print(f"   Top score : {result['top_score']}")
    print(f"   Avg score : {result['avg_score']}")
    print(f"   Sources   : {', '.join(result['sources'])}")

    return result