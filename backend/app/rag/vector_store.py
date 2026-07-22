import logging
import os
import json
from typing import List, Dict, Any
import numpy as np
from .documents import ALL_DOCUMENTS

logger = logging.getLogger("zeroharm_ai.rag.vector_store")

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except Exception as e:
    logger.warning(f"SentenceTransformers unavailable ({e}). Falling back to sklearn TF-IDF vectorizer.")
    SENTENCE_TRANSFORMERS_AVAILABLE = False

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except Exception as e:
    SKLEARN_AVAILABLE = False

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct
    HAS_QDRANT = True
except Exception as e:
    HAS_QDRANT = False

# Qdrant configurations
QDRANT_ENABLED = os.getenv("QDRANT_ENABLED", "false").lower() == "true"
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "zeroharm_compliance")


class ZeroHarmVectorStore:
    """
    Local & Dedicated Vector Store for RAG retrieval with semantic embeddings.
    Primary mode: Qdrant DB (Option A) if enabled and available.
    Fallback 1: sentence-transformers (all-MiniLM-L6-v2) for local memory semantic search.
    Fallback 2: scikit-learn TF-IDF if sentence-transformers is unavailable.
    """

    def __init__(self):
        self.documents: List[Dict[str, Any]] = list(ALL_DOCUMENTS)
        self.mode = "Lazy Initialization Pending"
        self._model = None
        self._embeddings = None
        self._vectorizer = None
        self._matrix = None
        self._sklearn_cosine = None
        self.qdrant_client = None
        self._initialized = False

    def _ensure_initialized(self):
        if self._initialized:
            return
        self._initialized = True
        self.initialize_store()

    def initialize_store(self):
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

        logger.info(f"Initializing vector store in mode: {self.mode}")
        
        # 1. Connect and initialize Qdrant if enabled (Option A)
        if QDRANT_ENABLED and HAS_QDRANT:
            try:
                self.qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, timeout=2.0)
                # Check connection
                self.qdrant_client.get_collections()
                
                # Check if collection exists
                collections = [c.name for c in self.qdrant_client.get_collections().collections]
                if QDRANT_COLLECTION not in collections:
                    logger.info(f"Creating Qdrant collection: {QDRANT_COLLECTION}")
                    # Dimension = 384 for all-MiniLM-L6-v2, or 1000/arbitrary for TF-IDF fallback dense matrix
                    dim = 384 if self._model is not None else 1000
                    self.qdrant_client.create_collection(
                        collection_name=QDRANT_COLLECTION,
                        vectors_config=VectorParams(size=dim, distance=Distance.COSINE)
                    )
                    self.mode = f"Qdrant DB ({QDRANT_COLLECTION})"
                    self.upload_all_to_qdrant()
                else:
                    self.mode = f"Qdrant DB ({QDRANT_COLLECTION})"
                    logger.info(f"Connected to existing Qdrant collection: {QDRANT_COLLECTION}")
                return
            except Exception as e:
                logger.error(f"Failed to connect to Qdrant: {e}. Falling back to local in-memory store.")
                self.qdrant_client = None

        # 2. Local Fallback initialization
        texts = [
            f"{doc['title']} {doc.get('source', '')} {doc['content']}"
            for doc in self.documents
        ]
        if self._model is not None:
            self._embeddings = self._model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        else:
            self._matrix = self._vectorizer.fit_transform(texts)
        logger.info(f"Vector store initialized with {len(self.documents)} documents.")

    def upload_all_to_qdrant(self):
        """Uploads all default documents to Qdrant collection."""
        if not self.qdrant_client:
            return
            
        texts = [
            f"{doc['title']} {doc.get('source', '')} {doc['content']}"
            for doc in self.documents
        ]
        
        if self._model is not None:
            embeddings = self._model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        else:
            # TF-IDF dense matrix fallback
            matrix = self._vectorizer.fit_transform(texts)
            embeddings = matrix.toarray()
            # If TF-IDF matrix has different shape, adjust it
            if embeddings.shape[1] != 1000:
                # pad or slice to match dimension 1000
                padded = np.zeros((embeddings.shape[0], 1000))
                col_limit = min(embeddings.shape[1], 1000)
                padded[:, :col_limit] = embeddings[:, :col_limit]
                embeddings = padded
            
        points = []
        for idx, doc in enumerate(self.documents):
            points.append(PointStruct(
                id=idx,
                vector=embeddings[idx].tolist(),
                payload={
                    "doc_id": doc["id"],
                    "title": doc["title"],
                    "source": doc["source"],
                    "content": doc["content"]
                }
            ))
            
        self.qdrant_client.upsert(
            collection_name=QDRANT_COLLECTION,
            points=points
        )
        logger.info(f"Uploaded {len(self.documents)} documents to Qdrant collection.")

    def add_documents(self, docs: List[Dict[str, Any]]):
        """Append new documents to the store and update the index."""
        if not docs:
            return
        self._ensure_initialized()

        # 1. Sync to Qdrant collection if active
        if self.qdrant_client:
            try:
                start_idx = len(self.documents)
                self.documents.extend(docs)
                
                texts = [
                    f"{doc['title']} {doc.get('source', '')} {doc['content']}"
                    for doc in docs
                ]
                
                if self._model is not None:
                    embeddings = self._model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
                else:
                    matrix = self._vectorizer.transform(texts)
                    embeddings = matrix.toarray()
                    if embeddings.shape[1] != 1000:
                        padded = np.zeros((embeddings.shape[0], 1000))
                        col_limit = min(embeddings.shape[1], 1000)
                        padded[:, :col_limit] = embeddings[:, :col_limit]
                        embeddings = padded
                    
                points = []
                for idx, doc in enumerate(docs):
                    points.append(PointStruct(
                        id=start_idx + idx,
                        vector=embeddings[idx].tolist(),
                        payload={
                            "doc_id": doc["id"],
                            "title": doc["title"],
                            "source": doc["source"],
                            "content": doc["content"]
                        }
                    ))
                self.qdrant_client.upsert(
                    collection_name=QDRANT_COLLECTION,
                    points=points
                )
                logger.info(f"Added {len(docs)} documents to Qdrant collection.")
                return
            except Exception as e:
                logger.error(f"Failed to add documents to Qdrant: {e}. Falling back to local add.")
                self.qdrant_client = None

        # 2. Local Fallback add
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

        logger.info(f"Added {len(docs)} documents to local vector store. Total: {len(self.documents)}")

    def search(self, query: str, k: int = 3) -> List[Dict[str, Any]]:
        self._ensure_initialized()
        if not query or len(self.documents) == 0:
            return []

        # 1. Search Qdrant if active (Option A)
        if self.qdrant_client:
            try:
                if self._model is not None:
                    query_embedding = self._model.encode([query], show_progress_bar=False, convert_to_numpy=True)[0]
                else:
                    query_vec = self._vectorizer.transform([query])
                    query_embedding = query_vec.toarray()[0]
                    if len(query_embedding) != 1000:
                        padded = np.zeros(1000)
                        col_limit = min(len(query_embedding), 1000)
                        padded[:col_limit] = query_embedding[:col_limit]
                        query_embedding = padded
                    
                search_results = self.qdrant_client.search(
                    collection_name=QDRANT_COLLECTION,
                    query_vector=query_embedding.tolist(),
                    limit=k
                )
                
                results = []
                for item in search_results:
                    score = float(item.score)
                    if score < 0.05:
                        continue
                    payload = item.payload
                    results.append({
                        "id": payload["doc_id"],
                        "title": payload["title"],
                        "source": payload["source"],
                        "content": payload["content"],
                        "score": round(score, 2)
                    })
                return results
            except Exception as e:
                logger.error(f"Failed to query Qdrant collection: {e}. Falling back to local search.")
                self.qdrant_client = None

        # 2. Local Fallback search
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
