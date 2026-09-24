"""
Resume file parser.

Extracts plain text from uploaded PDF, DOCX, or TXT files.
Returns the extracted text as a string for downstream use.
"""

import io
from typing import Tuple


def extract_text(filename: str, file_bytes: bytes) -> Tuple[str, str]:
    """
    Extract text from a resume file.

    Args:
        filename:   Original filename (used to detect format).
        file_bytes: Raw file bytes.

    Returns:
        Tuple of (extracted_text, detected_format).

    Raises:
        ValueError: If the file type is unsupported or parsing fails.
    """
    name_lower = filename.lower()

    if name_lower.endswith(".pdf"):
        return _parse_pdf(file_bytes), "pdf"
    elif name_lower.endswith(".docx"):
        return _parse_docx(file_bytes), "docx"
    elif name_lower.endswith(".txt"):
        return _parse_txt(file_bytes), "txt"
    else:
        raise ValueError(
            f"Unsupported file type: '{filename}'. "
            "Please upload a PDF, DOCX, or TXT file."
        )


def _parse_pdf(data: bytes) -> str:
    try:
        import PyPDF2  # noqa: PLC0415
        reader = PyPDF2.PdfReader(io.BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages).strip()
        if not text:
            raise ValueError(
                "Could not extract text from this PDF. "
                "It may be image-based (scanned). Try a text-based PDF or DOCX."
            )
        return text
    except ImportError:
        raise ValueError("PDF parsing unavailable. Run install_resume_deps.bat first.")


def _parse_docx(data: bytes) -> str:
    try:
        from docx import Document  # noqa: PLC0415
        doc = Document(io.BytesIO(data))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        text = "\n".join(paragraphs).strip()
        if not text:
            raise ValueError("Could not extract text from this DOCX file.")
        return text
    except ImportError:
        raise ValueError("DOCX parsing unavailable. Run install_resume_deps.bat first.")


def _parse_txt(data: bytes) -> str:
    # Try UTF-8 first, fall back to latin-1
    try:
        return data.decode("utf-8").strip()
    except UnicodeDecodeError:
        return data.decode("latin-1").strip()
