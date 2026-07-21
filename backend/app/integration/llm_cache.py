import os
import hashlib
import json
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger("zeroharm_ai.llm_cache")

# Try importing redis
try:
    import redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

# Enable cache configuration
LLM_CACHE_ENABLED = os.getenv("LLM_CACHE_ENABLED", "true").lower() == "true"
SEMANTIC_MATCH_THRESHOLD = float(os.getenv("SEMANTIC_MATCH_THRESHOLD", "0.70"))
DISTRIBUTED_STORAGE_ENABLED = os.getenv("DISTRIBUTED_STORAGE_ENABLED", "false").lower() == "true"


class LLMSemanticCache:
    """
    Implements Option C: Semantic LLM Caching (GPTCache / Redis).
    Saves LLM API prompts and OISD safety standard definitions.
    Features:
      - Exact SHA-256 prompt hashing for instantaneous cache hits.
      - Semantic token-based Jaccard similarity match for near-identical queries.
      - Redis cluster storage when distributed mode is active, falling back to local memory.
    """
    def __init__(self):
        self.enabled = LLM_CACHE_ENABLED
        self.client = None
        self.local_cache: Dict[str, Dict[str, Any]] = {} # schema: {prompt_hash: {"prompt": str, "response": str}}

        # Connect to Redis if configured
        if self.enabled and DISTRIBUTED_STORAGE_ENABLED and HAS_REDIS:
            try:
                self.client = redis.Redis(
                    host=os.getenv("REDIS_HOST", "localhost"),
                    port=int(os.getenv("REDIS_PORT", 6379)),
                    password=os.getenv("REDIS_PASSWORD", None),
                    decode_responses=True,
                    socket_timeout=1.5
                )
                self.client.ping()
                logger.info("Successfully connected to Redis for LLM semantic caching.")
            except Exception as e:
                logger.error(f"Failed to connect to Redis for cache: {e}. Falling back to in-memory LLM cache.")

    def _hash_prompt(self, prompt: str) -> str:
        """Returns SHA-256 checksum of the prompt."""
        return hashlib.sha256(prompt.strip().encode("utf-8")).hexdigest()

    def _tokenize(self, text: str) -> set:
        """Tokenize and lowercase text for lightweight word Jaccard similarity."""
        # Simple split removing common punctuation
        words = text.lower().replace("\n", " ").replace(".", " ").replace(",", " ").replace("?", " ").replace("!", " ").split()
        # Filter out minor stopwords to keep semantic tokens
        stopwords = {"the", "a", "an", "is", "are", "of", "and", "in", "to", "for", "with", "at", "on", "by", "from"}
        return {w for w in words if w not in stopwords and len(w) > 1}

    def _jaccard_similarity(self, set_a: set, set_b: set) -> float:
        """Computes Jaccard Similarity index between two token sets."""
        if not set_a or not set_b:
            return 0.0
        return len(set_a & set_b) / len(set_a | set_b)

    def get_cached_response(self, prompt: str) -> Optional[str]:
        """
        Retrieves cached LLM response for a prompt.
        First attempts exact match lookup, then falls back to semantic similarity scanning.
        """
        if not self.enabled:
            return None

        clean_prompt = prompt.strip()
        prompt_hash = self._hash_prompt(clean_prompt)

        # 1. Exact Match Check
        if self.client:
            try:
                exact_response = self.client.get(f"zeroharm:llmcache:exact:{prompt_hash}")
                if exact_response:
                    logger.info("Semantic LLM Cache: Exact SHA-256 Hit.")
                    return exact_response
            except Exception as e:
                logger.error(f"Redis exact cache read failed: {e}")
        elif prompt_hash in self.local_cache:
            logger.info("Semantic LLM Cache: In-Memory Exact SHA-256 Hit.")
            return self.local_cache[prompt_hash]["response"]

        # 2. Semantic Match Check (Jaccard Similarity)
        tokens_input = self._tokenize(clean_prompt)
        if not tokens_input:
            return None

        # Fetch all cache entries
        all_entries: List[Dict[str, str]] = []
        if self.client:
            try:
                keys = self.client.keys("zeroharm:llmcache:semantic:*")
                for key in keys:
                    raw = self.client.get(key)
                    if raw:
                        all_entries.append(json.loads(raw))
            except Exception as e:
                logger.error(f"Redis semantic keys lookup failed: {e}")
        else:
            all_entries = list(self.local_cache.values())

        # Scan for semantic overlap
        best_similarity = 0.0
        best_response = None
        best_matched_prompt = ""

        for entry in all_entries:
            tokens_cached = self._tokenize(entry["prompt"])
            similarity = self._jaccard_similarity(tokens_input, tokens_cached)
            
            if similarity > best_similarity:
                best_similarity = similarity
                best_response = entry["response"]
                best_matched_prompt = entry["prompt"]

        # Return cached match if similarity threshold is met
        if best_similarity >= SEMANTIC_MATCH_THRESHOLD:
            logger.info(f"Semantic LLM Cache: Semantic Hit (Similarity: {best_similarity:.2f} >= Threshold: {SEMANTIC_MATCH_THRESHOLD:.2f})")
            logger.debug(f"Matched prompt: {best_matched_prompt[:100]}...")
            return best_response

        return None

    def set_cached_response(self, prompt: str, response: str):
        """Caches a prompt-response pair."""
        if not self.enabled or not response:
            return

        clean_prompt = prompt.strip()
        prompt_hash = self._hash_prompt(clean_prompt)
        payload = {"prompt": clean_prompt, "response": response}

        if self.client:
            try:
                # Store exact match
                self.client.set(f"zeroharm:llmcache:exact:{prompt_hash}", response, ex=86400 * 7) # 7-day TTL
                # Store semantic lookup record
                self.client.set(f"zeroharm:llmcache:semantic:{prompt_hash}", json.dumps(payload), ex=86400 * 7)
            except Exception as e:
                logger.error(f"Redis cache write failed: {e}")
        else:
            self.local_cache[prompt_hash] = payload


# Singleton instance
llm_cache = LLMSemanticCache()
