"""
coach_knowledge.py — ThePnLab
Système RAG (Retrieval Augmented Generation) :
- Indexe le PDF du livre de finance en chunks vectorisés
- Récupère les passages pertinents selon la question
- Injecte dans le prompt du coach
"""
from __future__ import annotations

import os
import logging
import pickle
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Chemins
DATA_DIR    = Path(__file__).parent / "data"
PDF_PATH    = DATA_DIR / "finance_book.pdf"
INDEX_PATH  = DATA_DIR / "finance_index.pkl"

CHUNK_SIZE  = 400   # mots par chunk
CHUNK_OVERLAP = 50  # overlap entre chunks
TOP_K       = 3     # nombre de chunks à injecter


# ── Extraction PDF ────────────────────────────────────────────────────────────
def _extract_pdf_text(pdf_path: Path) -> str:
    try:
        import PyPDF2
        text = []
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            total = len(reader.pages)
            logger.info(f"PDF: {total} pages à indexer...")
            for i, page in enumerate(reader.pages):
                t = page.extract_text()
                if t:
                    text.append(t)
                if i % 100 == 0:
                    logger.info(f"  {i}/{total} pages traitées...")
        return "\n".join(text)
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return ""


# ── Découpage en chunks ───────────────────────────────────────────────────────
def _chunk_text(text: str) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + CHUNK_SIZE])
        if len(chunk.strip()) > 100:  # ignorer les chunks trop courts
            chunks.append(chunk)
        i += CHUNK_SIZE - CHUNK_OVERLAP
    logger.info(f"Chunking: {len(chunks)} chunks générés")
    return chunks


# ── Index vectoriel ───────────────────────────────────────────────────────────
class FinanceKnowledgeBase:
    def __init__(self):
        self.chunks: list[str] = []
        self.embeddings = None
        self._model = None
        self._ready = False

    def _get_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer("all-MiniLM-L6-v2")
                logger.info("SentenceTransformer chargé")
            except Exception as e:
                logger.error(f"SentenceTransformer error: {e}")
        return self._model

    def build_index(self) -> bool:
        """Construit l'index vectoriel depuis le PDF."""
        if not PDF_PATH.exists():
            logger.warning(f"PDF non trouvé: {PDF_PATH}")
            return False

        logger.info("Construction de l'index RAG...")
        text = _extract_pdf_text(PDF_PATH)
        if not text:
            return False

        self.chunks = _chunk_text(text)
        if not self.chunks:
            return False

        model = self._get_model()
        if not model:
            return False

        try:
            import numpy as np
            logger.info(f"Vectorisation de {len(self.chunks)} chunks...")
            self.embeddings = model.encode(self.chunks, show_progress_bar=True, batch_size=32)
            # Normaliser pour cosine similarity
            norms = np.linalg.norm(self.embeddings, axis=1, keepdims=True)
            self.embeddings = self.embeddings / (norms + 1e-9)
            self._ready = True
            # Sauvegarder l'index
            self._save_index()
            logger.info("Index RAG construit et sauvegardé ✅")
            return True
        except Exception as e:
            logger.error(f"Vectorisation error: {e}")
            return False

    def _save_index(self):
        try:
            DATA_DIR.mkdir(exist_ok=True)
            with open(INDEX_PATH, "wb") as f:
                pickle.dump({"chunks": self.chunks, "embeddings": self.embeddings}, f)
        except Exception as e:
            logger.error(f"Save index error: {e}")

    def load_index(self) -> bool:
        """Charge l'index depuis le cache si disponible."""
        if not INDEX_PATH.exists():
            return False
        try:
            with open(INDEX_PATH, "rb") as f:
                data = pickle.load(f)
            self.chunks    = data["chunks"]
            self.embeddings = data["embeddings"]
            self._ready    = True
            logger.info(f"Index RAG chargé ({len(self.chunks)} chunks) ✅")
            return True
        except Exception as e:
            logger.error(f"Load index error: {e}")
            return False

    def search(self, query: str, top_k: int = TOP_K) -> list[str]:
        """Retourne les chunks les plus pertinents pour la question."""
        if not self._ready or self.embeddings is None:
            return []

        model = self._get_model()
        if not model:
            return []

        try:
            import numpy as np
            q_emb = model.encode([query])
            q_emb = q_emb / (np.linalg.norm(q_emb) + 1e-9)
            scores = (self.embeddings @ q_emb.T).flatten()
            top_idx = scores.argsort()[-top_k:][::-1]
            return [self.chunks[i] for i in top_idx if scores[i] > 0.3]
        except Exception as e:
            logger.error(f"Search error: {e}")
            return []

    def initialize(self):
        """Charge l'index existant ou en construit un nouveau."""
        if not self.load_index():
            if PDF_PATH.exists():
                self.build_index()
            else:
                logger.warning("Pas de PDF trouvé — RAG désactivé")


# Singleton
knowledge_base = FinanceKnowledgeBase()


def get_relevant_context(question: str) -> str:
    """Interface publique — retourne le contexte pertinent pour une question."""
    if not knowledge_base._ready:
        return ""

    chunks = knowledge_base.search(question)
    if not chunks:
        return ""

    context = "\n---\n".join(chunks)
    return f"EXTRAITS PERTINENTS DU LIVRE DE FINANCE :\n{context}\n"