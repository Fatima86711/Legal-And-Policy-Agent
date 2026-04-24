# agents/coordinator.py

from core.cohere_client import classify_query
from core.config import SIMILARITY_THRESHOLD
from agents.retrieval_agent import retrieve
from agents.explainer_agent import explain
from prompts.templates import (
    ROUTING_PROMPT_TEMPLATE,
    TASK_RETRIEVAL,
    TASK_EXPLANATION,
    TASK_COMPARISON,
    TASK_UNKNOWN,
    ALL_TASK_TYPES,
    fill_prompt,
)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — QUERY CLASSIFICATION
# ══════════════════════════════════════════════════════════════════════════════

def classify(query: str) -> str:
    """
    Classify the user's query into one of the four task types using
    Cohere Command-R with the ROUTING_PROMPT_TEMPLATE.

    The classification runs at temperature=0.0 and max_tokens=20 to ensure
    deterministic, single-label output. The raw response is stripped,
    uppercased, and validated against ALL_TASK_TYPES before being returned.

    Fallback behavior:
        - If the model returns an unrecognized label, defaults to TASK_UNKNOWN
        - If the API call fails entirely, defaults to TASK_UNKNOWN and logs
          the error rather than crashing the entire pipeline

    Args:
        query : Preprocessed user query string

    Returns:
        One of: TASK_RETRIEVAL, TASK_EXPLANATION, TASK_COMPARISON, TASK_UNKNOWN
    """
    print(f"\n🧭 Coordinator — Classifying query...")

    try:
        routing_prompt = fill_prompt(
            template=ROUTING_PROMPT_TEMPLATE,
            query=query,
        )

        raw_label = classify_query(routing_prompt)
        label = raw_label.strip().upper()

        # Clean common model artifacts
        # e.g. "RETRIEVAL." or "**RETRIEVAL**" or "Label: RETRIEVAL"
        for task in ALL_TASK_TYPES:
            if task in label:
                print(f"✅ Classification result: {task}")
                return task

        # If no recognized label found in response
        print(
            f"⚠️  Unrecognized classification label: '{raw_label}'. "
            f"Defaulting to UNKNOWN."
        )
        return TASK_UNKNOWN

    except Exception as e:
        print(f"❌ Classification failed: {e}. Defaulting to UNKNOWN.")
        return TASK_UNKNOWN


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — RETRIEVAL DECISION LOGIC
# ══════════════════════════════════════════════════════════════════════════════

def should_retrieve(task_type: str) -> bool:
    """
    Determine whether the Retrieval Agent should be called for a given
    task type.

    All three active task types require retrieval because even EXPLANATION
    tasks benefit from document-grounded context when chunks are available.
    Only UNKNOWN tasks skip retrieval entirely since they return a static
    response without any LLM call.

    Args:
        task_type : Classified task type string

    Returns:
        True if retrieval should run, False if it should be skipped.
    """
    return task_type in [TASK_RETRIEVAL, TASK_EXPLANATION, TASK_COMPARISON]


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — RETRIEVAL CONFIGURATION PER TASK
# ══════════════════════════════════════════════════════════════════════════════

def get_retrieval_config(task_type: str) -> dict:
    """
    Return task-specific retrieval configuration parameters.

    Different task types have different retrieval needs:

    RETRIEVAL tasks:
        - top_k=5         : Standard retrieval, need enough chunks to cover
                            the specific provision asked about
        - use_expansion=True : Expand informal terms to legal vocabulary

    EXPLANATION tasks:
        - top_k=3         : Fewer chunks needed, explanation is concept-focused
                            not provision-focused
        - use_expansion=False : User is asking about a specific term, expansion
                                might dilute the embedding signal

    COMPARISON tasks:
        - top_k=8         : Need more chunks to cover both sides of comparison
                            from potentially two different documents
        - use_expansion=True : Broader retrieval improves coverage of both
                               subjects being compared

    Args:
        task_type : Classified task type string

    Returns:
        Dict with 'top_k' and 'use_expansion' keys.
    """
    configs = {
        TASK_RETRIEVAL: {
            "top_k": 5,
            "use_expansion": True,
        },
        TASK_EXPLANATION: {
            "top_k": 3,
            "use_expansion": False,
        },
        TASK_COMPARISON: {
            "top_k": 8,
            "use_expansion": True,
        },
    }

    return configs.get(task_type, {"top_k": 5, "use_expansion": True})


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — EMPTY RETRIEVAL RESULT BUILDER
# ══════════════════════════════════════════════════════════════════════════════

def empty_retrieval_result() -> dict:
    """
    Build a standardized empty retrieval result dict.

    Used when the Coordinator decides to skip retrieval for UNKNOWN tasks.
    Passed directly to the Explainer Agent so it always receives a consistent
    retrieval result structure regardless of whether retrieval actually ran.

    Returns:
        Empty retrieval result dict matching the structure returned by
        agents/retrieval_agent.retrieve().
    """
    return {
        "chunks": [],
        "total_found": 0,
        "sources": [],
        "has_results": False,
        "top_score": 0.0,
        "avg_score": 0.0,
    }


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — PIPELINE LOGGING
# ══════════════════════════════════════════════════════════════════════════════

def log_pipeline_summary(
    query: str,
    task_type: str,
    retrieval_result: dict,
    explainer_result: dict,
) -> None:
    """
    Print a structured summary of the full pipeline execution to the console.

    Useful during development to trace exactly what happened at each stage
    for any given query. Includes query preview, task type, retrieval stats,
    and response validation status.

    Args:
        query            : Original user query
        task_type        : Classified task type
        retrieval_result : Result dict from retrieval agent
        explainer_result : Result dict from explainer agent
    """
    print(f"\n{'═' * 60}")
    print(f"📊 PIPELINE SUMMARY")
    print(f"{'═' * 60}")
    print(f"  Query      : {query[:80]}{'...' if len(query) > 80 else ''}")
    print(f"  Task Type  : {task_type}")
    print(f"  Retrieved  : {retrieval_result.get('total_found', 0)} chunk(s)")
    print(f"  Sources    : {', '.join(retrieval_result.get('sources', [])) or 'None'}")
    print(f"  Top Score  : {retrieval_result.get('top_score', 0.0)}")
    print(f"  Avg Score  : {retrieval_result.get('avg_score', 0.0)}")
    print(f"  Fallback   : {explainer_result.get('used_fallback', False)}")
    print(f"  Valid      : {explainer_result.get('is_valid', False)}")

    warnings = explainer_result.get("warnings", [])
    if warnings:
        print(f"  Warnings   :")
        for w in warnings:
            print(f"    ⚠️  {w}")

    print(f"{'═' * 60}\n")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — QUERY VALIDATION
# ══════════════════════════════════════════════════════════════════════════════

def validate_query(query: str) -> tuple[bool, str]:
    """
    Validate the raw user query before it enters the pipeline.

    Checks performed:
        - Query is not None or empty
        - Query meets minimum length (3 characters)
        - Query does not exceed maximum length (2000 characters)
        - Query is a string type

    Args:
        query : Raw input from the user

    Returns:
        Tuple of (is_valid: bool, error_message: str).
        error_message is an empty string if is_valid is True.
    """
    if not query:
        return False, "Query cannot be empty."

    if not isinstance(query, str):
        return False, "Query must be a string."

    if len(query.strip()) < 3:
        return False, "Query is too short. Please provide more detail."

    if len(query) > 2000:
        return False, (
            "Query is too long. Please limit your query to 2000 characters."
        )

    return True, ""


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 7 — MAIN COORDINATOR ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def run(query: str) -> dict:
    """
    Main entry point for the Coordinator Agent.

    Orchestrates the full ReAct-inspired pipeline:

        Step 1 — Validate the raw query
        Step 2 — Classify the query into a task type (Reason)
        Step 3 — Decide whether retrieval is needed
        Step 4 — Run the Retrieval Agent with task-specific config (Act)
        Step 5 — Run the Explainer Agent with task type and context (Reason)
        Step 6 — Log the pipeline summary
        Step 7 — Return the final structured response

    This is the single function called by routers/chat.py.
    Nothing outside this module needs to know about classification,
    retrieval configuration, or agent internals.

    Args:
        query : Raw user query string from the API request

    Returns:
        Final response dict containing:
            - response      : The LLM-generated legal analysis string
            - task_type     : Which task type was executed
            - sources       : List of cited source document filenames
            - chunks_used   : Number of chunks used as context
            - top_score     : Highest retrieval similarity score
            - avg_score     : Average retrieval similarity score
            - used_fallback : Whether the no-results fallback was triggered
            - is_valid      : Whether the response passed validation
            - warnings      : Any validation warnings
            - error         : None if successful, error message string if not

    Raises:
        Does not raise. All exceptions are caught and returned in the
        'error' field of the response dict so the API layer never crashes.
    """
    print(f"\n{'█' * 60}")
    print(f"  COORDINATOR — New Query Received")
    print(f"{'█' * 60}")
    print(f"  {query[:100]}{'...' if len(query) > 100 else ''}")
    print(f"{'█' * 60}\n")

    # ── Step 1 — Validate Query ───────────────────────────────────────────────
    is_valid, error_message = validate_query(query)

    if not is_valid:
        print(f"❌ Query validation failed: {error_message}")
        return {
            "response": error_message,
            "task_type": TASK_UNKNOWN,
            "sources": [],
            "chunks_used": 0,
            "top_score": 0.0,
            "avg_score": 0.0,
            "used_fallback": True,
            "is_valid": False,
            "warnings": [error_message],
            "error": error_message,
        }

    try:
        # ── Step 2 — Classify ─────────────────────────────────────────────────
        task_type = classify(query)

        # ── Step 3 — Decide Retrieval ─────────────────────────────────────────
        if should_retrieve(task_type):
            retrieval_config = get_retrieval_config(task_type)

            print(
                f"⚙️  Retrieval config for {task_type}: "
                f"top_k={retrieval_config['top_k']}, "
                f"use_expansion={retrieval_config['use_expansion']}"
            )

            # ── Step 4 — Retrieve ─────────────────────────────────────────────
            retrieval_result = retrieve(
                query=query,
                top_k=retrieval_config["top_k"],
                use_expansion=retrieval_config["use_expansion"],
            )

        else:
            # UNKNOWN task — skip retrieval entirely
            print(f"⏭️  Skipping retrieval for task type: {task_type}")
            retrieval_result = empty_retrieval_result()

        # ── Step 5 — Explain ──────────────────────────────────────────────────
        explainer_result = explain(
            query=query,
            task_type=task_type,
            retrieval_result=retrieval_result,
        )

        # ── Step 6 — Log Summary ──────────────────────────────────────────────
        log_pipeline_summary(
            query=query,
            task_type=task_type,
            retrieval_result=retrieval_result,
            explainer_result=explainer_result,
        )

        # ── Step 7 — Return Final Response ───────────────────────────────────
        return {
            **explainer_result,
            "error": None,
        }

    except Exception as e:
        error_msg = f"Pipeline execution failed: {str(e)}"
        print(f"\n❌ COORDINATOR ERROR: {error_msg}")

        return {
            "response": (
                "I encountered an unexpected error while processing your query. "
                "Please try again. If the problem persists, check the server logs."
            ),
            "task_type": TASK_UNKNOWN,
            "sources": [],
            "chunks_used": 0,
            "top_score": 0.0,
            "avg_score": 0.0,
            "used_fallback": True,
            "is_valid": False,
            "warnings": [],
            "error": error_msg,
        }