# backend/test_ingestion.py

from pathlib import Path
from pipeline.ingestion import ingest_document, ingest_all
from core.chroma_client import get_collection_stats, list_documents

print("Running ingestion test...\n")

# Test single document ingestion
# Replace with the actual filename you dropped in data/raw/
test_file = Path("data/raw/test_data.pdf")

if not test_file.exists():
    print(f"❌ Test file not found: {test_file}")
    print("   Drop a PDF into data/raw/ first.")
else:
    result = ingest_document(test_file)
    print(f"\nIngestion result: {result}")

    stats = get_collection_stats()
    print(f"\nChromaDB stats after ingestion: {stats}")

    documents = list_documents()
    print(f"\nDocuments in collection: {documents}")