import logging
from typing import List, Dict, Any
from .documents import ALL_DOCUMENTS
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger("zeroharm_ai.rag.vector_store")

class ZeroHarmVectorStore:
    """
    Local, dependency-light Vector Store for RAG retrieval.

    Uses scikit-learn TF-IDF + Cosine Similarity for semantic retrieval.
    This runs fully offline with zero external API calls or downloads, so
    retrieval always works regardless of which LLM provider is configured.
    LLM answer generation is handled separately by the OpenRouter agent.
    """
    def __init__(self):
        self.documents = ALL_DOCUMENTS
        self.mode = "TF-IDF (Local Retrieval)"

        self._vectorizer = None
        self._matrix = None
        self.initialize_store()

    def initialize_store(self):
        logger.info("Initializing local TF-IDF vector store...")
        texts = [
            f"{doc['title']} {doc['source']} {doc['content']}"
            for doc in self.documents
        ]
        self._vectorizer = TfidfVectorizer(stop_words="english")
        self._matrix = self._vectorizer.fit_transform(texts)
        logger.info(f"Vector store successfully initialized in mode: {self.mode}")

    def search(self, query: str, k: int = 3) -> List[Dict[str, Any]]:
        """
        Query the vector store.
        Returns a list of documents matching the query sorted by relevance.
        """
        if not query or self._vectorizer is None:
            return []

        query_vec = self._vectorizer.transform([query])
        similarities = cosine_similarity(query_vec, self._matrix).flatten()

        # Sort documents by similarity score descending
        sorted_indices = similarities.argsort()[::-1]

        results = []
        for idx in sorted_indices[:k]:
            score = float(similarities[idx])
            doc = self.documents[idx]
            results.append({
                "id": doc["id"],
                "title": doc["title"],
                "source": doc["source"],
                "content": doc["content"],
                "score": round(score, 2)
            })

        return results
