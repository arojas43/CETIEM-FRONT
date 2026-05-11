"""
OpenKB API — knowledge base por empresa para CETIEM.

Endpoints:
  POST   /api/v1/add                          — indexar documento en el KB de la empresa
  POST   /api/v1/search                       — Q&A sobre el KB de la empresa
  DELETE /api/v1/documents/{document_id}      — eliminar documento del KB
  GET    /health                              — healthcheck

LLM: NVIDIA NIM via LiteLLM (openai-compatible).
KB: /data/kb/<datasetName>/ (volume persistente, un directorio por empresa).
"""
import asyncio
import json
import os
import shutil
import tempfile
import traceback
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ── Env ──────────────────────────────────────────────────────────────────────

KB_ROOT = Path(os.environ.get("OPENKB_DATA_DIR", "/data/kb"))
KB_ROOT.mkdir(parents=True, exist_ok=True)

# LiteLLM routes "openai/<model>" through OPENAI_API_BASE / OPENAI_API_KEY.
# We set them from NVIDIA env vars so OpenKB's LiteLLM calls hit NIM.
_nvidia_key = os.environ.get("NVIDIA_API_KEY", "")
_nvidia_base = os.environ.get("NVIDIA_API_BASE", "https://integrate.api.nvidia.com/v1")
_raw_model = os.environ.get("NVIDIA_DEEPSEEK_MODEL", "moonshotai/kimi-k2.6")

# LiteLLM openai-compatible routing: prefix with "openai/" if not already there
OPENKB_MODEL = _raw_model if _raw_model.startswith("openai/") else f"openai/{_raw_model}"

os.environ.setdefault("OPENAI_API_KEY", _nvidia_key)
os.environ.setdefault("OPENAI_API_BASE", _nvidia_base)

print(f"[OpenKB] KB root : {KB_ROOT}")
print(f"[OpenKB] Model   : {OPENKB_MODEL}")
print(f"[OpenKB] NIM base: {_nvidia_base}")

# ── FastAPI ───────────────────────────────────────────────────────────────────

app = FastAPI(title="OpenKB API", version="0.2.0")


def _kb_dir(dataset_name: str) -> Path:
    kb = KB_ROOT / dataset_name
    kb.mkdir(parents=True, exist_ok=True)
    return kb


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": OPENKB_MODEL}


# ── Add ───────────────────────────────────────────────────────────────────────

@app.post("/api/v1/add")
async def add_document(
    data: UploadFile = File(...),
    datasetName: str = Form(...),
):
    """
    Indexa un documento en el KB de la empresa.
    Preserva el filename original (ej: <documentId>.txt) para que OpenKB
    use el documentId como doc_name en wiki/summaries/ y wiki/sources/.
    Esto hace posible la eliminación posterior y evita acumulación de nombres random.
    """
    from openkb.cli import add_single_file

    kb_dir = _kb_dir(datasetName)
    # Usar el filename original para que wiki/sources/<documentId>.* sea determinístico
    original_name = data.filename or "document.txt"
    tmp_dir = tempfile.mkdtemp()
    try:
        contents = await data.read()
        file_path = Path(tmp_dir) / original_name
        file_path.write_bytes(contents)

        loop = asyncio.get_running_loop()
        # add_single_file es síncrono — ejecutar en thread pool con timeout
        await asyncio.wait_for(
            loop.run_in_executor(None, add_single_file, file_path, kb_dir),
            timeout=280.0,
        )
        return JSONResponse({"status": "ok", "dataset": datasetName, "bytes": len(contents)})
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="OpenKB indexing timed out after 280s")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ── Delete ────────────────────────────────────────────────────────────────────

@app.delete("/api/v1/documents/{document_id}")
async def delete_document(document_id: str, datasetName: str):
    """
    Elimina un documento del KB de la empresa.
    Borra wiki/sources/<documentId>.*, wiki/summaries/<documentId>.md
    y la entrada en .openkb/hashes.json para permitir re-indexación futura.
    Los wiki/concepts/ que referenciaban el doc quedan (se actualizarán en el próximo add).
    """
    kb_dir = _kb_dir(datasetName)
    removed = []

    # Eliminar sources (puede ser .json para docs largos o .md/.txt para cortos)
    sources_dir = kb_dir / "wiki" / "sources"
    if sources_dir.exists():
        for ext in [".json", ".md", ".txt"]:
            f = sources_dir / f"{document_id}{ext}"
            if f.exists():
                f.unlink()
                removed.append(f"sources/{document_id}{ext}")

    # Eliminar summary
    summary_file = kb_dir / "wiki" / "summaries" / f"{document_id}.md"
    if summary_file.exists():
        summary_file.unlink()
        removed.append(f"summaries/{document_id}.md")

    # Eliminar entrada en hashes.json para que se pueda re-indexar
    hashes_file = kb_dir / ".openkb" / "hashes.json"
    if hashes_file.exists():
        try:
            hashes = json.loads(hashes_file.read_text())
            # La metadata puede contener file_path o doc_name con el document_id
            to_remove = [
                h for h, meta in hashes.items()
                if document_id in str(meta)
            ]
            for h in to_remove:
                del hashes[h]
            hashes_file.write_text(json.dumps(hashes, indent=2))
            if to_remove:
                removed.append(f"hashes.json ({len(to_remove)} entries)")
        except Exception:
            pass  # hashes.json corrupto o formato inesperado — no bloquear

    return JSONResponse({"status": "ok", "dataset": datasetName, "removed": removed})


# ── Search / Q&A ──────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    datasets: list[str] = []
    top_k: int = 10


@app.post("/api/v1/search")
async def search(req: SearchRequest):
    """
    Q&A sobre el KB de la empresa (cross-documento).
    Lanza HTTP 500 en caso de error para que el cliente Next.js
    active el fallback a qaService (PageIndex + NIM directo).
    """
    from openkb.agent.query import run_query

    if not req.datasets:
        raise HTTPException(status_code=400, detail="datasets list is empty")

    dataset_name = req.datasets[0]
    kb_dir = _kb_dir(dataset_name)

    wiki_dir = kb_dir / "wiki"
    if not wiki_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No hay documentos indexados para el dataset '{dataset_name}'"
        )

    try:
        answer = await run_query(
            question=req.query,
            kb_dir=kb_dir,
            model=OPENKB_MODEL,
            stream=False,
            raw=True,
        )
        return JSONResponse([{
            "search_result": answer,
            "dataset_id": dataset_name,
            "dataset_name": dataset_name,
        }])
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
