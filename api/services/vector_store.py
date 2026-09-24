"""
In-memory vector store backed by numpy cosine similarity.

A single module-level singleton is used so all routes share the same store.
Calling reset() clears it — done on each /api/ingest call so a fresh JD
always starts clean.
"""

from typing import List, Dict
import numpy as np


class VectorStore:
    def __init__(self) -> None:
        self._chunks: List[str] = []
        self._matrix: np.ndarray | None = None  # shape (n, 768)

    # ── Mutators ─────────────────────────────────────────────────────────────

    def reset(self) -> None:
        """Clear all stored chunks and embeddings."""
        self._chunks = []
        self._matrix = None

    def add(self, chunks: List[str], embeddings: List[List[float]]) -> None:
        """
        Add chunks and their corresponding embedding vectors.

        Args:
            chunks:     Raw text chunks.
            embeddings: Parallel list of 768-dim float vectors.
        """
        if not chunks:
            return

        new_matrix = np.array(embeddings, dtype=np.float32)

        if self._matrix is None:
            self._matrix = new_matrix
        else:
            self._matrix = np.vstack([self._matrix, new_matrix])

        self._chunks.extend(chunks)

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
    ) -> List[Dict]:
        """
        Return the top-k most similar chunks to *query_embedding*.

        Uses cosine similarity (dot product of L2-normalised vectors).

        Args:
            query_embedding: 768-dim float vector from embed_query().
            top_k:           Number of results to return.

        Returns:
            List of {"chunk": str, "score": float} dicts, best first.
        """
        if self._matrix is None or len(self._chunks) == 0:
            return []

        q = np.array(query_embedding, dtype=np.float32)

        # L2-normalise
        doc_norms = np.linalg.norm(self._matrix, axis=1, keepdims=True)
        doc_norms = np.where(doc_norms == 0, 1e-10, doc_norms)
        q_norm = np.linalg.norm(q)
        if q_norm == 0:
            q_norm = 1e-10

        normalised_docs = self._matrix / doc_norms
        normalised_q = q / q_norm

        scores: np.ndarray = normalised_docs @ normalised_q  # (n,)

        k = min(top_k, len(self._chunks))
        top_indices = np.argsort(scores)[::-1][:k]

        return [
            {"chunk": self._chunks[i], "score": float(scores[i])}
            for i in top_indices
        ]

    def get_all_chunks(self) -> List[str]:
        """Return all stored chunk texts (used for interview prep / weak spots)."""
        return list(self._chunks)

    @property
    def size(self) -> int:
        return len(self._chunks)


# Module-level singleton shared across the FastAPI process
store = VectorStore()
