/**
 * Client-side resume text extraction.
 *
 * - TXT  → FileReader (instant, no deps)
 * - DOCX → unzip the .docx and pull text from word/document.xml
 * - PDF  → send to backend /api/extract-resume (requires python-multipart)
 *
 * This way TXT and DOCX work instantly with no backend deps.
 * PDF falls back to the backend.
 */

export interface ExtractionResult {
  text: string;
  format: string;
  length: number;
}

export async function extractResumeClient(file: File): Promise<ExtractionResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt")) {
    const text = await readAsText(file);
    return { text: text.trim(), format: "txt", length: text.length };
  }

  if (name.endsWith(".docx")) {
    const text = await extractDocx(file);
    return { text: text.trim(), format: "docx", length: text.length };
  }

  if (name.endsWith(".pdf")) {
    return await extractPdfViaBackend(file);
  }

  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT.");
}

/* ── TXT ─────────────────────────────────────────────────────────────────── */
function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file, "utf-8");
  });
}

/* ── DOCX ────────────────────────────────────────────────────────────────── */
async function extractDocx(file: File): Promise<string> {
  // A .docx is just a zip. We unzip it in-browser and grab word/document.xml.
  const buffer = await file.arrayBuffer();

  // Dynamically import fflate only if available, otherwise fall back to backend
  try {
    // Use DecompressionStream API (available in all modern browsers)
    const entries = await unzipBuffer(buffer);
    const xmlEntry = entries["word/document.xml"];
    if (!xmlEntry) throw new Error("Invalid DOCX: missing word/document.xml");

    const xml   = new TextDecoder().decode(xmlEntry);
    const text  = stripXmlTags(xml);
    if (!text.trim()) throw new Error("No readable text found in the DOCX.");
    return text;
  } catch (e) {
    // Fall back to backend if client unzip fails
    const backendResult = await extractPdfViaBackend(file);
    return backendResult.text;
  }
}

/** Unzip a buffer using the browser's native DecompressionStream (ZIP support via fetch trick) */
async function unzipBuffer(buffer: ArrayBuffer): Promise<Record<string, Uint8Array>> {
  // We use a known-working approach: parse the ZIP central directory manually
  const bytes = new Uint8Array(buffer);
  const files: Record<string, Uint8Array> = {};

  let i = 0;
  while (i < bytes.length - 4) {
    // Local file header signature: PK\x03\x04
    if (bytes[i] === 0x50 && bytes[i+1] === 0x4b && bytes[i+2] === 0x03 && bytes[i+3] === 0x04) {
      const compression  = bytes[i+8]  | (bytes[i+9]  << 8);
      const compSize     = bytes[i+18] | (bytes[i+19] << 8) | (bytes[i+20] << 16) | (bytes[i+21] << 24);
      const nameLen      = bytes[i+26] | (bytes[i+27] << 8);
      const extraLen     = bytes[i+28] | (bytes[i+29] << 8);
      const nameBytes    = bytes.slice(i + 30, i + 30 + nameLen);
      const name         = new TextDecoder().decode(nameBytes);
      const dataStart    = i + 30 + nameLen + extraLen;
      const compData     = bytes.slice(dataStart, dataStart + compSize);

      if (compression === 0) {
        // Stored (no compression)
        files[name] = compData;
      } else if (compression === 8) {
        // Deflate — use DecompressionStream
        try {
          const ds     = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          const reader = ds.readable.getReader();
          writer.write(compData);
          writer.close();
          const chunks: Uint8Array[] = [];
          let done = false;
          while (!done) {
            const { value, done: d } = await reader.read();
            if (value) chunks.push(value);
            done = d;
          }
          const total = chunks.reduce((n, c) => n + c.length, 0);
          const out   = new Uint8Array(total);
          let offset  = 0;
          for (const c of chunks) { out.set(c, offset); offset += c.length; }
          files[name] = out;
        } catch {
          // skip this entry if decompression fails
        }
      }

      i = dataStart + compSize;
    } else {
      i++;
    }
  }

  return files;
}

function stripXmlTags(xml: string): string {
  // Remove XML tags and decode basic entities
  return xml
    .replace(/<\/w:p>/gi, "\n")   // paragraph breaks
    .replace(/<[^>]+>/g, " ")     // all other tags
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")      // collapse spaces
    .replace(/\n{3,}/g, "\n\n")   // collapse blank lines
    .trim();
}

/* ── PDF via backend ─────────────────────────────────────────────────────── */
async function extractPdfViaBackend(file: File): Promise<ExtractionResult> {
  const BASE_URL = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${BASE_URL}/api/extract-resume`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? "Backend extraction failed");
    }

    return res.json() as Promise<ExtractionResult>;
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        "PDF extraction timed out. Make sure the backend is running and python-multipart is installed.\n\nRun install_resume_deps.bat then restart the backend."
      );
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
