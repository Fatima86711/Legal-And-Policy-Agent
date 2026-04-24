# agents/explainer_agent.py

from core.cohere_client import generate_response
from core.config import TEMPERATURE, MAX_TOKENS
from prompts.templates import (
    TASK_RETRIEVAL,
    TASK_EXPLANATION,
    TASK_COMPARISON,
    TASK_UNKNOWN,
    RAG_ANALYSIS_PROMPT_TEMPLATE,
    EXPLANATION_PROMPT_TEMPLATE,
    COMPARISON_PROMPT_TEMPLATE,
    NO_RESULTS_PROMPT_TEMPLATE,
    UNKNOWN_QUERY_RESPONSE,
    build_context_block,
    fill_prompt,
)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — RESPONSE VALIDATION
# ══════════════════════════════════════════════════════════════════════════════

def validate_response(response: str, task_type: str) -> dict:
    """
    Perform basic quality checks on the LLM response before returning it.

    Checks performed:
        - Response is not empty or whitespace only
        - Response meets a minimum length threshold (too short responses
          usually indicate the model refused or misunderstood the prompt)
        - Response contains expected section headers based on task type
          (confirms the model followed the structured output format)

    Args:
        response  : Raw string response from Cohere Command-R
        task_type : One of TASK_RETRIEVAL, TASK_EXPLANATION, TASK_COMPARISON

    Returns:
        A validation dict containing:
            - is_valid   : Boolean
            - warnings   : List of warning strings (empty if fully valid)
            - response   : The original response string (unchanged)
    """
    warnings = []

    # Check 1 — Not empty
    if not response or not response.strip():
        return {
            "is_valid": False,
            "warnings": ["Response was empty."],
            "response": response,
        }

    # Check 2 — Minimum length
    MIN_LENGTH = 100
    if len(response.strip()) < MIN_LENGTH:
        warnings.append(
            f"Response is unusually short ({len(response.strip())} chars). "
            f"The model may have misunderstood the prompt."
        )

    # Check 3 — Expected section headers by task type
    expected_headers = {
        TASK_RETRIEVAL: ["**Legal Analysis**", "**Disclaimer**"],
        TASK_EXPLANATION: ["**Plain Language Definition**", "**Disclaimer**"],
        TASK_COMPARISON: ["**Overview**", "**Key Differences**", "**Disclaimer**"],
    }

    headers = expected_headers.get(task_type, [])
    missing_headers = [h for h in headers if h not in response]

    if missing_headers:
        warnings.append(
            f"Response is missing expected sections: {missing_headers}. "
            f"Output formatting may be incomplete."
        )

    return {
        "is_valid": len(warnings) == 0,
        "warnings": warnings,
        "response": response,
    }


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — RETRIEVAL TASK HANDLER
# ══════════════════════════════════════════════════════════════════════════════

def handle_retrieval(
    query: str,
    retrieval_result: dict,
    temperature: float = TEMPERATURE,
) -> dict:
    """
    Handle a RETRIEVAL task by grounding the LLM response in retrieved chunks.

    This function is called when the Coordinator has classified the query
    as RETRIEVAL and has already run the Retrieval Agent to get context.

    Flow:
        1. Check if retrieval returned any results
        2. If no results → use NO_RESULTS_PROMPT_TEMPLATE
        3. If results found → build context block and fill RAG template
        4. Call Cohere Command-R with the filled prompt
        5. Validate and return structured response dict

    Args:
        query            : Original user query string
        retrieval_result : Result dict from agents/retrieval_agent.retrieve()
        temperature      : LLM temperature (default from config)

    Returns:
        Structured response dict (see build_response_dict() for structure).
    """
    has_results = retrieval_result.get("has_results", False)
    chunks = retrieval_result.get("chunks", [])
    sources = retrieval_result.get("sources", [])
    top_score = retrieval_result.get("top_score", 0.0)
    avg_score = retrieval_result.get("avg_score", 0.0)

    print(f"\n📝 Explainer Agent — Handling RETRIEVAL task")

    # ── No Results Path ───────────────────────────────────────────────────────
    if not has_results:
        print(f"⚠️  No relevant chunks found. Using fallback prompt.")
        prompt = fill_prompt(
            template=NO_RESULTS_PROMPT_TEMPLATE,
            query=query,
        )
        raw_response = generate_response(
            prompt=prompt,
            temperature=0.1,
            max_tokens=MAX_TOKENS,
        )
        return build_response_dict(
            response=raw_response,
            task_type=TASK_RETRIEVAL,
            sources=[],
            chunks_used=0,
            top_score=0.0,
            avg_score=0.0,
            used_fallback=True,
            validation={"is_valid": True, "warnings": []},
        )

    # ── RAG Path ──────────────────────────────────────────────────────────────
    context_block = build_context_block(chunks)

    prompt = fill_prompt(
        template=RAG_ANALYSIS_PROMPT_TEMPLATE,
        query=query,
        context_block=context_block,
    )

    print(f"🤖 Calling Cohere Command-R for legal analysis...")
    raw_response = generate_response(
        prompt=prompt,
        temperature=temperature,
        max_tokens=MAX_TOKENS,
    )

    validation = validate_response(raw_response, TASK_RETRIEVAL)

    if validation["warnings"]:
        for warning in validation["warnings"]:
            print(f"⚠️  Validation warning: {warning}")

    return build_response_dict(
        response=raw_response,
        task_type=TASK_RETRIEVAL,
        sources=sources,
        chunks_used=len(chunks),
        top_score=top_score,
        avg_score=avg_score,
        used_fallback=False,
        validation=validation,
    )


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — EXPLANATION TASK HANDLER
# ══════════════════════════════════════════════════════════════════════════════

def handle_explanation(
    query: str,
    retrieval_result: dict,
    temperature: float = 0.3,
) -> dict:
    """
    Handle an EXPLANATION task by explaining a legal term or concept.

    Unlike RETRIEVAL, this task can still produce a useful response even
    when no document chunks are retrieved, because legal terminology
    explanations can draw on the model's general legal knowledge.

    When chunks ARE available, they enrich the explanation with
    jurisdiction-specific or document-specific context.

    Flow:
        1. Build context block from retrieved chunks (may be empty)
        2. Fill EXPLANATION_PROMPT_TEMPLATE with query and context
        3. Call Cohere Command-R
        4. Validate and return structured response dict

    Args:
        query            : Original user query string
        retrieval_result : Result dict from agents/retrieval_agent.retrieve()
        temperature      : Slightly higher than RETRIEVAL for more natural
                           explanatory language (default 0.3)

    Returns:
        Structured response dict.
    """
    has_results = retrieval_result.get("has_results", False)
    chunks = retrieval_result.get("chunks", [])
    sources = retrieval_result.get("sources", [])
    top_score = retrieval_result.get("top_score", 0.0)
    avg_score = retrieval_result.get("avg_score", 0.0)

    print(f"\n📝 Explainer Agent — Handling EXPLANATION task")

    if has_results:
        print(f"📚 Enriching explanation with {len(chunks)} retrieved chunk(s).")
        context_block = build_context_block(chunks)
    else:
        print(f"ℹ️  No chunks found. Explanation will use general legal knowledge.")
        context_block = ""

    prompt = fill_prompt(
        template=EXPLANATION_PROMPT_TEMPLATE,
        query=query,
        context_block=context_block,
    )

    print(f"🤖 Calling Cohere Command-R for terminology explanation...")
    raw_response = generate_response(
        prompt=prompt,
        temperature=temperature,
        max_tokens=MAX_TOKENS,
    )

    validation = validate_response(raw_response, TASK_EXPLANATION)

    if validation["warnings"]:
        for warning in validation["warnings"]:
            print(f"⚠️  Validation warning: {warning}")

    return build_response_dict(
        response=raw_response,
        task_type=TASK_EXPLANATION,
        sources=sources,
        chunks_used=len(chunks),
        top_score=top_score,
        avg_score=avg_score,
        used_fallback=False,
        validation=validation,
    )


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — COMPARISON TASK HANDLER
# ══════════════════════════════════════════════════════════════════════════════

def handle_comparison(
    query: str,
    retrieval_result: dict,
    temperature: float = TEMPERATURE,
) -> dict:
    """
    Handle a COMPARISON task by comparing laws, policies, or legal concepts.

    Comparison tasks require the richest context because the model needs
    chunks from at least two different documents or sections to make a
    meaningful comparison. The function checks how many distinct source
    documents were retrieved and warns if only one source is available,
    since a single-source comparison will be one-sided.

    Flow:
        1. Check retrieved sources — warn if fewer than 2 distinct documents
        2. Build context block from all retrieved chunks
        3. Fill COMPARISON_PROMPT_TEMPLATE
        4. Call Cohere Command-R
        5. Validate and return structured response dict

    Args:
        query            : Original user query string
        retrieval_result : Result dict from agents/retrieval_agent.retrieve()
        temperature      : Low temperature for factual consistency (default
                           from config, typically 0.2)

    Returns:
        Structured response dict.
    """
    has_results = retrieval_result.get("has_results", False)
    chunks = retrieval_result.get("chunks", [])
    sources = retrieval_result.get("sources", [])
    top_score = retrieval_result.get("top_score", 0.0)
    avg_score = retrieval_result.get("avg_score", 0.0)

    print(f"\n📝 Explainer Agent — Handling COMPARISON task")

    # ── No Results Path ───────────────────────────────────────────────────────
    if not has_results:
        print(f"⚠️  No relevant chunks found. Using fallback prompt.")
        prompt = fill_prompt(
            template=NO_RESULTS_PROMPT_TEMPLATE,
            query=query,
        )
        raw_response = generate_response(
            prompt=prompt,
            temperature=0.1,
            max_tokens=MAX_TOKENS,
        )
        return build_response_dict(
            response=raw_response,
            task_type=TASK_COMPARISON,
            sources=[],
            chunks_used=0,
            top_score=0.0,
            avg_score=0.0,
            used_fallback=True,
            validation={"is_valid": True, "warnings": []},
        )

    # ── Single Source Warning ─────────────────────────────────────────────────
    if len(sources) < 2:
        print(
            f"⚠️  Comparison query but only 1 source document retrieved: "
            f"'{sources[0] if sources else 'unknown'}'. "
            f"Comparison may be one-sided. Consider uploading both documents."
        )

    context_block = build_context_block(chunks)

    prompt = fill_prompt(
        template=COMPARISON_PROMPT_TEMPLATE,
        query=query,
        context_block=context_block,
    )

    print(f"🤖 Calling Cohere Command-R for comparative analysis...")
    raw_response = generate_response(
        prompt=prompt,
        temperature=temperature,
        max_tokens=MAX_TOKENS,
    )

    validation = validate_response(raw_response, TASK_COMPARISON)

    if validation["warnings"]:
        for warning in validation["warnings"]:
            print(f"⚠️  Validation warning: {warning}")

    return build_response_dict(
        response=raw_response,
        task_type=TASK_COMPARISON,
        sources=sources,
        chunks_used=len(chunks),
        top_score=top_score,
        avg_score=avg_score,
        used_fallback=False,
        validation=validation,
    )


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — RESPONSE DICT BUILDER
# ══════════════════════════════════════════════════════════════════════════════

def build_response_dict(
    response: str,
    task_type: str,
    sources: list[str],
    chunks_used: int,
    top_score: float,
    avg_score: float,
    used_fallback: bool,
    validation: dict,
) -> dict:
    """
    Build a standardized response dictionary returned by all task handlers.

    Every handler — RETRIEVAL, EXPLANATION, COMPARISON — returns this exact
    same structure. This consistency means the Coordinator and the API router
    never need to handle different shapes of data depending on task type.

    Structure:
        - response      : The final LLM-generated answer string
        - task_type     : Which task type was handled
        - sources       : List of source document filenames cited
        - chunks_used   : How many ChromaDB chunks were used as context
        - top_score     : Highest retrieval similarity score
        - avg_score     : Average retrieval similarity score
        - used_fallback : True if the no-results fallback prompt was used
        - is_valid      : Whether the response passed validation checks
        - warnings      : List of any validation warning strings

    Args:
        All fields of the response dict (see above).

    Returns:
        Populated response dict.
    """
    return {
        "response": response.strip(),
        "task_type": task_type,
        "sources": sources,
        "chunks_used": chunks_used,
        "top_score": top_score,
        "avg_score": avg_score,
        "used_fallback": used_fallback,
        "is_valid": validation.get("is_valid", True),
        "warnings": validation.get("warnings", []),
    }


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — MAIN EXPLAINER ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def explain(
    query: str,
    task_type: str,
    retrieval_result: dict,
) -> dict:
    """
    Main entry point for the Explainer Agent.

    Routes to the correct task handler based on the task_type label
    provided by the Coordinator Agent. This is the only function the
    Coordinator calls on the Explainer Agent.

    Args:
        query            : Original user query string
        task_type        : Classification label from Coordinator
                           (TASK_RETRIEVAL, TASK_EXPLANATION, TASK_COMPARISON,
                            or TASK_UNKNOWN)
        retrieval_result : Result dict from agents/retrieval_agent.retrieve()
                           Pass an empty result dict for UNKNOWN tasks.

    Returns:
        Standardized response dict from build_response_dict().

    Raises:
        ValueError if task_type is not one of the recognized labels.
    """
    print(f"\n{'═' * 50}")
    print(f"🧠 Explainer Agent — Task type: {task_type}")
    print(f"{'═' * 50}")

    if task_type == TASK_RETRIEVAL:
        return handle_retrieval(query, retrieval_result)

    elif task_type == TASK_EXPLANATION:
        return handle_explanation(query, retrieval_result)

    elif task_type == TASK_COMPARISON:
        return handle_comparison(query, retrieval_result)

    elif task_type == TASK_UNKNOWN:
        print(f"🚫 Unknown task type — returning static off-topic response.")
        return build_response_dict(
            response=UNKNOWN_QUERY_RESPONSE,
            task_type=TASK_UNKNOWN,
            sources=[],
            chunks_used=0,
            top_score=0.0,
            avg_score=0.0,
            used_fallback=True,
            validation={"is_valid": True, "warnings": []},
        )

    else:
        raise ValueError(
            f"❌ Explainer Agent received unrecognized task_type: '{task_type}'. "
            f"Expected one of: RETRIEVAL, EXPLANATION, COMPARISON, UNKNOWN."
        )