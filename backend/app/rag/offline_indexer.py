import os
import json
import logging
import argparse
import sys
from typing import List, Dict, Any

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.app.rag.vector_store import ZeroHarmVectorStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zeroharm_ai.rag.offline_indexer")


class OfflineIndexer:
    """
    Implements Option B: Offline Indexing Pipeline.
    Decouples PDF/Text parsing and embedding generation from live RAG queries.
    Saves chunks and embeddings directly into the Qdrant cluster.
    """
    def __init__(self, manual_dir: str = "backend/data/manuals"):
        self.manual_dir = manual_dir
        os.makedirs(self.manual_dir, exist_ok=True)
        self.vector_store = ZeroHarmVectorStore()
        logger.info(f"Offline Indexer initialized in mode: {self.vector_store.mode}")

    def parse_txt_file(self, filepath: str) -> List[Dict[str, Any]]:
        """Parses plain text manual and splits into semantic chunks."""
        title = os.path.basename(filepath).replace(".txt", "")
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read()

        chunks = ZeroHarmVectorStore._chunk_text(text)
        logger.info(f"Split text file {filepath} into {len(chunks)} overlapping chunks.")
        
        parsed_docs = []
        for idx, chunk in enumerate(chunks):
            parsed_docs.append({
                "id": f"chunk_{title}_{idx}",
                "title": f"{title} - Part {idx+1}",
                "source": title,
                "content": chunk
            })
        return parsed_docs

    def run_indexing(self):
        """Scans the manual directory, processes all files, and upserts to vector DB."""
        logger.info(f"Scanning directory: {self.manual_dir} for compliance standard files...")
        
        all_new_docs = []
        
        # Scan files
        for filename in os.listdir(self.manual_dir):
            filepath = os.path.join(self.manual_dir, filename)
            if filename.endswith(".txt"):
                docs = self.parse_txt_file(filepath)
                all_new_docs.extend(docs)
            elif filename.endswith(".json"):
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        docs = json.load(f)
                        if isinstance(docs, list):
                            all_new_docs.extend(docs)
                            logger.info(f"Parsed JSON index file {filename} containing {len(docs)} documents.")
                except Exception as e:
                    logger.error(f"Failed to parse JSON file {filename}: {e}")
                    
        # Bootstrapping: If no files in data directory, seed Qdrant with default seeded documents
        if not all_new_docs:
            logger.warning("No new compliance manuals found. Bootstrapping with default documents.")
            self.vector_store.initialize_store()
            logger.info("Compliance vector database successfully bootstrapped.")
            return

        # Bulk upsert to Qdrant/Local store
        logger.info(f"Bulk indexing {len(all_new_docs)} new compliance records...")
        self.vector_store.add_documents(all_new_docs)
        logger.info("Offline compliance indexing pipeline execution completed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ZeroHarm AI Offline Compliance Vector Indexing Pipeline")
    parser.add_argument("--dir", default="backend/data/manuals", help="Path to industrial safety manuals directory")
    args = parser.parse_args()
    
    indexer = OfflineIndexer(args.dir)
    indexer.run_indexing()
