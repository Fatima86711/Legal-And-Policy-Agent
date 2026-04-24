# backend/test_core.py

print("Testing config...")
from core.config import COHERE_API_KEY, COHERE_MODEL, CHROMA_COLLECTION_NAME
print(f"  API Key loaded: {'✅' if COHERE_API_KEY else '❌ MISSING'}")
print(f"  Model: {COHERE_MODEL}")
print(f"  Collection: {CHROMA_COLLECTION_NAME}")

print("\nTesting Cohere client...")
from core.cohere_client import generate_response, embed_query
response = generate_response("Say the word HELLO only, nothing else.")
print(f"  Generation: ✅ Got response → {response}")

embedding = embed_query("What are GDPR penalties?")
print(f"  Embedding: ✅ Vector length → {len(embedding)}")

print("\nTesting ChromaDB client...")
from core.chroma_client import get_collection_stats
stats = get_collection_stats()
print(f"  Stats: ✅ {stats}")

print("\n✅ All core clients working.")