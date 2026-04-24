# backend/test_pipeline.py

from agents.coordinator import run

test_queries = [
    {
        "label": "RETRIEVAL query",
        "query": "What are the penalties under the cybercrime act?"
    },
    {
        "label": "EXPLANATION query",
        "query": "What does mens rea mean in criminal law?"
    },
    {
        "label": "COMPARISON query",
        "query": "How does this law compare to international standards?"
    },
    {
        "label": "UNKNOWN query",
        "query": "What is the weather today?"
    },
]
for test in test_queries:
    print(f"\n{'═' * 60}")
    print(f"Testing: {test['label']}")
    print(f"Query  : {test['query']}")
    print(f"{'═' * 60}")

    result = run(test["query"])

    print(f"\n  Task Type    : {result['task_type']}")
    print(f"  Chunks Used  : {result['chunks_used']}")
    print(f"  Sources      : {result['sources']}")
    print(f"  Top Score    : {result['top_score']}")
    print(f"  Used Fallback: {result['used_fallback']}")
    print(f"  Is Valid     : {result['is_valid']}")
    print(f"  Error        : {result['error']}")
    print(f"\n  Response Preview:")
    print(f"  {result['response'][:300]}...")