import logging
import uuid
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

from backend.pdf_processor import extract_pages
from backend.retriever import create_chunks
from backend.qa_service import answer_question

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Document Q&A Chatbot API",
    description="Upload PDFs and ask questions grounded in their contents.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024
documents: dict[str, dict[str, Any]] = {}


class QuestionRequest(BaseModel):
    document_id: str
    question: str = Field(min_length=1, max_length=2000)


@app.get("/")
def health():
    return {"status": "ok", "message": "Document Q&A API is running"}


@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    filename = file.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    try:
        data = await file.read(MAX_FILE_SIZE + 1)
        if not data:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="PDF is too large. Maximum size is 10 MB.")
        if not data.startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail="The file does not appear to be a valid PDF.")

        pages = extract_pages(data)
        chunks = create_chunks(pages)
        if not chunks:
            raise HTTPException(
                status_code=400,
                detail="No readable text was found. The PDF may be empty or scanned; OCR is not enabled.",
            )

        document_id = str(uuid.uuid4())
        documents[document_id] = {
            "filename": filename,
            "pages_with_text": len(pages),
            "chunks": chunks,
        }
        return {
            "document_id": document_id,
            "filename": filename,
            "pages_with_text": len(pages),
            "chunks_created": len(chunks),
            "message": "PDF uploaded and processed successfully.",
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("PDF upload failed")
        raise HTTPException(status_code=500, detail="Could not process this PDF.") from exc
    finally:
        await file.close()


@app.post("/api/ask")
def ask(request: QuestionRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Please enter a question.")

    document = documents.get(request.document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document session not found. Please upload the PDF again.")

    try:
        result = answer_question(document["chunks"], question)
        return {"filename": document["filename"], **result}
    except RuntimeError as exc:
        logger.exception("AI question answering failed")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected question answering error")
        raise HTTPException(status_code=500, detail="Something went wrong while answering. Please try again.") from exc
