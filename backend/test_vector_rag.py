import asyncio
import sys
import os
import json
import logging
import shutil

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.rag.vector_store import ZeroHarmVectorStore
from backend.app.rag.offline_indexer import OfflineIndexer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_vector_rag")

def test_vector_store():
    logger.info("--- Testing ZeroHarmVectorStore (Option A: Qdrant / Fallback Store) ---")
    store = ZeroHarmVectorStore()
    
    # Assert initialized with default documents
    assert len(store.documents) > 0, "No seeded documents found in vector store"
    logger.info(f"Vector store initialized in mode: {store.mode} with {len(store.documents)} documents.")
    
    # Test query
    query = "What is the spacing requirements for Gas Storage?"
    results = store.search(query, k=2)
    
    logger.info(f"Search results for query '{query}':")
    for r in results:
        logger.info(f" - [{r['source']}] (Score: {r['score']}): {r['title']}")
        
    assert len(results) > 0, "Search query returned 0 documents"
    assert results[0]["score"] > 0.0, "Top search hit had invalid/zero similarity score"
    
    # Test adding documents
    new_docs = [{
        "id": "PTW-SOP",
        "title": "PTW Hot Work SOP Revision 2",
        "source": "Plant-SOP",
        "content": "Gas monitoring must be performed every 30 minutes in zone Coke Oven Battery 1 when welding is active."
    }]
    
    store.add_documents(new_docs)
    
    # Search for new content
    results_new = store.search("welding Coke Oven Battery 1", k=1)
    assert len(results_new) > 0, "Failed to search new added documents"
    assert results_new[0]["id"] == "PTW-SOP", "Incorrect top result returned after add_documents"
    
    logger.info("ZeroHarmVectorStore tests completed successfully!\n")


def test_offline_indexer():
    logger.info("--- Testing OfflineIndexer (Option B: Offline Pipeline) ---")
    test_manuals_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "data", "test_manuals"
    )
    
    os.makedirs(test_manuals_dir, exist_ok=True)
    
    # Create mock safety manual file
    mock_file = os.path.join(test_manuals_dir, "OISD-STD-117.txt")
    with open(mock_file, "w", encoding="utf-8") as f:
        f.write(
            "OISD-STD-117 is the standard for pressure relief device calibration and maintenance.\n\n"
            "All process unit relief valves must be calibrated at least once every 12 months.\n\n"
            "Documented records must be cataloged in the asset registry database."
        )
        
    indexer = OfflineIndexer(manual_dir=test_manuals_dir)
    indexer.run_indexing()
    
    # Verify the indexed standard is searchable
    results = indexer.vector_store.search("relief valves calibration interval OISD-STD-117", k=1)
    
    logger.info("Search results for indexed standard:")
    for r in results:
        logger.info(f" - [{r['source']}] (Score: {r['score']}): {r['content']}")
        
    assert len(results) > 0, "Indexed manual was not searchable"
    assert "OISD-STD-117" in results[0]["source"], "Source name mismatch"
    
    # Clean up test directories
    if os.path.exists(test_manuals_dir):
        shutil.rmtree(test_manuals_dir)
        
    logger.info("OfflineIndexer tests completed successfully!\n")


def main():
    logger.info("Starting Vector Search & RAG Scaling Unit Tests...")
    try:
        test_vector_store()
        test_offline_indexer()
        logger.info("ALL VECTOR SEARCH & RAG SCALING TESTS PASSED SUCCESSFULLY!")
    except AssertionError as e:
        logger.error(f"TEST ASSERTION FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"An unexpected error occurred during vector testing: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
