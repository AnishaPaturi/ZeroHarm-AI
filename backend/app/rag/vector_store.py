import logging
from typing import List, Dict, Any
import numpy as np
from .documents import ALL_DOCUMENTS

logger = logging.getLogger("zeroharm_ai.rag.vector_store")

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class ZeroHarmVectorStore:
    """
    Local Vector Store for RAG retrieval with semantic embeddings.

    Primary mode: sentence-transformers (all-MiniLM-L6-v2) for true semantic search.
    Fallback mode: scikit-learn TF-IDF if sentence-transformers is unavailable.
    """

    def __init__(self):
        self.documents: List[Dict[str, Any]] = list(ALL_DOCUMENTS)
        self.mode = "TF-IDF (Local Retrieval)"
        self._model = None
        self._embeddings = None
        self._vectorizer = None
        self._matrix = None
        self._sklearn_cosine = None

        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                self._model = SentenceTransformer("all-MiniLM-L6-v2")
                self.mode = "Semantic Embeddings (all-MiniLM-L6-v2)"
                logger.info("Loaded sentence-transformers model for semantic retrieval.")
            except Exception as e:
                logger.warning(f"Failed to load sentence-transformers model: {e}. Falling back to TF-IDF.")
                self._model = None

        if self._model is None:
            if not SKLEARN_AVAILABLE:
                raise ImportError("Neither sentence-transformers nor scikit-learn is available for the vector store.")
            self.mode = "TF-IDF (Local Retrieval - Fallback)"
            self._vectorizer = TfidfVectorizer(stop_words="english")
            self._sklearn_cosine = cosine_similarity

        self.initialize_store()

    def initialize_store(self):
        logger.info(f"Initializing vector store in mode: {self.mode}")
        texts = [
            f"{doc['title']} {doc.get('source', '')} {doc['content']}"
            for doc in self.documents
        ]
        if self._model is not None:
            self._embeddings = self._model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        else:
            self._matrix = self._vectorizer.fit_transform(texts)
        logger.info(f"Vector store initialized with {len(self.documents)} documents.")

    def add_documents(self, docs: List[Dict[str, Any]]):
        """Append new documents to the store and update the index."""
        if not docs:
            return

        self.documents.extend(docs)
        texts = [
            f"{doc['title']} {doc.get('source', '')} {doc['content']}"
            for doc in docs
        ]

        if self._model is not None:
            new_embeddings = self._model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
            if self._embeddings is not None:
                self._embeddings = np.vstack([self._embeddings, new_embeddings])
            else:
                self._embeddings = new_embeddings
        else:
            all_texts = [
                f"{doc['title']} {doc.get('source', '')} {doc['content']}"
                for doc in self.documents
            ]
            self._matrix = self._vectorizer.fit_transform(all_texts)

        logger.info(f"Added {len(docs)} documents to vector store. Total: {len(self.documents)}")

    def search(self, query: str, k: int = 3) -> List[Dict[str, Any]]:
        if not query or len(self.documents) == 0:
            return []

        if self._model is not None:
            query_embedding = self._model.encode([query], show_progress_bar=False, convert_to_numpy=True)
            query_norm = np.linalg.norm(query_embedding)
            docs_norm = np.linalg.norm(self._embeddings, axis=1)
            similarities = np.dot(self._embeddings, query_embedding.T).flatten() / (docs_norm * query_norm + 1e-8)
        else:
            query_vec = self._vectorizer.transform([query])
            similarities = self._sklearn_cosine(query_vec, self._matrix).flatten()

        sorted_indices = np.argsort(similarities)[::-1]
        results = []
        for idx in sorted_indices[:k]:
            score = float(similarities[idx])
            if score < 0.05:
                continue
            doc = self.documents[idx]
            results.append({
                "id": doc["id"],
                "title": doc["title"],
                "source": doc["source"],
                "content": doc["content"],
                "score": round(score, 2)
            })
        return results

    @staticmethod
    def _chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> List[str]:
        """Split text into overlapping chunks for better retrieval."""
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        chunks = []
        current_chunk = ""

        for para in paragraphs:
            if len(current_chunk) + len(para) + 2 > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                if overlap > 0 and len(current_chunk) > overlap:
                    current_chunk = current_chunk[-overlap:] + "\n\n" + para
                else:
                    current_chunk = para
            else:
                current_chunk = current_chunk + "\n\n" + para if current_chunk else para

        if current_chunk:
            chunks.append(current_chunk.strip())

        final_chunks = []
        for chunk in chunks:
            if len(chunk) <= chunk_size:
                final_chunks.append(chunk)
            else:
                sentences = chunk.replace('. ', '.\n').split('\n')
                sub_chunk = ""
                for sent in sentences:
                    if len(sub_chunk) + len(sent) + 1 > chunk_size and sub_chunk:
                        final_chunks.append(sub_chunk.strip())
                        sub_chunk = sent
                    else:
                        sub_chunk = sub_chunk + " " + sent if sub_chunk else sent
                if sub_chunk:
                    final_chunks.append(sub_chunk.strip())

        return final_chunks
