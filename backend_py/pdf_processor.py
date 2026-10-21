import pymupdf


def extract_pages(pdf_bytes: bytes) -> list[dict]:
    """Extract text from a PDF and preserve the original 1-based page number."""
    try:
        with pymupdf.open(stream=pdf_bytes, filetype="pdf") as pdf:
            if pdf.page_count == 0:
                raise ValueError("The PDF contains no pages.")

            pages = []
            for page_number, page in enumerate(pdf, start=1):
                text = page.get_text("text").strip()
                if text:
                    pages.append({"page": page_number, "text": text})

    except pymupdf.FileDataError as exc:
        raise ValueError("The uploaded file is not a readable PDF.") from exc

    if not pages:
        raise ValueError(
            "No readable text was found in this PDF. It may be blank or scanned. "
            "This version supports text-based PDFs; OCR is not enabled."
        )
    return pages
