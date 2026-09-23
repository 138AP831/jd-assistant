"""
Gemini embedding service.

Wraps google-generativeai's embed_content for both document (indexing)
and query (retrieval) use-cases using gemini-embedding-001 (dim=768).
"""

import os
from typing import List

import google.generativeai as genai


def _configure() -> None:
    """Configure the Gemini SDK once (idempotent)."""
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "GOOGLE_API_KEY environment variable is not set."
        )
    genai.configure(api_key=api_key)


_EMBEDDING_MODEL = "models/gemini-embedding-001"


def embed_documents(texts: List[str]) -> List[List[float]]:
    """
    Embed a list of document chunks for indexing.

    Uses task_type='retrieval_document' — optimised for storage-side embedding.

    Args:
        texts: Non-empty list of text strings to embed.

    Returns:
        List of 768-dimensional float vectors, one per input text.
    """
    _configure()
    if not texts:
        return []

    result = genai.embed_content(
        model=_EMBEDDING_MODEL,
        content=texts,
        task_type="retrieval_document",
    )
    # When content is a list, result["embedding"] is a list-of-lists
    embeddings = result["embedding"]
    return embeddings


def embed_query(text: str) -> List[float]:
    """
    Embed a single query string for retrieval.

    Uses task_type='retrieval_query' — optimised for query-side embedding.

    Args:
        text: The user's question or search string.

    Returns:
        A single 768-dimensional float vector.
    """
    _configure()
    result = genai.embed_content(
        model=_EMBEDDING_MODEL,
        content=text,
        task_type="retrieval_query",
    )
    # When content is a single string, result["embedding"] is a flat list
    return result["embedding"]
