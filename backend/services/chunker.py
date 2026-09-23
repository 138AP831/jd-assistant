"""
Sliding-window text chunker.

Splits text by word count with configurable overlap so no context is lost
at chunk boundaries.
"""

from typing import List


def chunk_text(
    text: str,
    chunk_size: int = 150,
    overlap: int = 30,
) -> List[str]:
    """
    Split *text* into overlapping chunks of approximately *chunk_size* words.

    Args:
        text:       Raw text to split.
        chunk_size: Target number of words per chunk.
        overlap:    Number of words to repeat at the start of the next chunk.

    Returns:
        A list of text chunks. Returns a single-element list when the text
        is shorter than one full chunk. Returns an empty list for blank input.
    """
    if not text or not text.strip():
        return []

    words = text.split()
    if len(words) == 0:
        return []

    # If the whole text fits in one chunk, return it as-is
    if len(words) <= chunk_size:
        return [" ".join(words)]

    chunks: List[str] = []
    start = 0
    step = chunk_size - overlap  # how far to advance each iteration

    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += step

    return chunks
