# backend/check_chunks.py
from core.chroma_client import collection

results = collection.get(limit=5, include=["documents", "metadatas"])

print("Sample chunks from your document:\n")
for i, doc in enumerate(results["documents"]):
    print(f"--- Chunk {i+1} ---")
    print(doc[:300])
    print()