import numpy as np
from sentence_transformers import SentenceTransformer


# The model is downloaded the first time the backend starts.
_embedding_model = None


def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    return _embedding_model


def create_chunks(pages: list[dict], chunk_size: int = 1000, overlap: int = 150) -> list[dict]:
    chunks = []
    for page in pages:
        text = page["text"]
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            content = text[start:end].strip()
            if content:
                chunks.append({"page": page["page"], "text": content})
            if end >= len(text):
                break
            start = end - overlap
    return chunks


def retrieve_chunks(chunks: list[dict], question: str, top_k: int = 4) -> list[dict]:
    if not chunks or not question.strip():
        return []

    model = get_embedding_model()
    texts = [chunk["text"] for chunk in chunks]
    document_vectors = model.encode(
        texts, normalize_embeddings=True, convert_to_numpy=True
    )
    query_vector = model.encode(
        [question], normalize_embeddings=True, convert_to_numpy=True
    )[0]

    # Normalized embeddings mean dot product is cosine similarity.
    scores = np.dot(document_vectors, query_vector)
    best_indices = np.argsort(scores)[::-1][:top_k]

    results = []
    for idx in best_indices:
        result = dict(chunks[int(idx)])
        result["score"] = float(scores[int(idx)])
        results.append(result)
    return results
