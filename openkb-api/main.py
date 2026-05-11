"""
OpenKB API — reemplazo de Cognee para CETIEM.

Expone la misma API surface que usaba cognee-client.ts:
  POST /api/v1/add      — indexar documento (form: data + datasetName)
  POST /api/v1/cognify  — no-op (OpenKB indexa en /add); devuelve éxito
  POST /api/v1/search   — Q&A sobre el dataset usando OpenKB + LLM
  GET  /health          — healthcheck

LLM: NVIDIA NIM via LiteLLM (openai-compatible).
Rutas de KB: /data/kb/<datasetName>/ (volume montado desde Docker).
"""
import asyncio
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

# Forward NVIDIA creds to LiteLLM's OpenAI provider
os.environ.setdefault("OPENAI_API_KEY", _nvidia_key)
os.environ.setdefault("OPENAI_API_BASE", _nvidia_base)

print(f"[OpenKB] KB root : {KB_ROOT}")
print(f"[OpenKB] Model   : {OPENKB_MODEL}")
print(f"[OpenKB] NIM base: {_nvidia_base}")

# ── FastAPI ───────────────────────────────────────────────────────────────────

app = FastAPI(title="OpenKB API", version="0.1.0")


def _kb_dir(dataset_name: str) -> Path:
    """Devuelve la ruta del KB para el dataset, creándola si no existe."""
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
    Recibe un archivo (texto o PDF) y lo indexa en el KB del dataset.
    Compatible con el formato que usa cognee-client.ts.
    """
    from openkb.cli import add_single_file

    kb_dir = _kb_dir(datasetName)
    suffix = Path(data.filename or "document.txt").suffix or ".txt"

    # Guardar en archivo temporal para que add_single_file lo procese
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        contents = await data.read()
        tmp.write(contents)
        tmp.close()

        file_path = Path(tmp.name)
        # add_single_file es síncrono — correrlo en thread pool para no bloquear
        await asyncio.get_event_loop().run_in_executor(
            None, add_single_file, file_path, kb_dir
        )
        return JSONResponse({"status": "ok", "dataset": datasetName, "bytes": len(contents)})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


# ── Cognify (no-op) ───────────────────────────────────────────────────────────

class CognifyRequest(BaseModel):
    datasets: list[str] = []


@app.post("/api/v1/cognify")
async def cognify(req: CognifyRequest):
    """
    En Cognee este endpoint construía el grafo de conocimiento.
    En OpenKB la indexación ocurre durante /add, así que esto es un no-op.
    Devuelve éxito para que cognee-client.ts no falle.
    """
    return JSONResponse({"status": "ok", "datasets": req.datasets, "entities_count": 0})


# ── Search / Q&A ──────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    datasets: list[str] = []
    search_type: str = "GRAPH_COMPLETION"
    top_k: int = 10


@app.post("/api/v1/search")
async def search(req: SearchRequest):
    """
    Responde una pregunta usando OpenKB sobre el primer dataset.
    Devuelve List[SearchResult] compatible con Cognee 1.0.
    """
    from openkb.agent.query import run_query

    if not req.datasets:
        raise HTTPException(status_code=400, detail="datasets list is empty")

    dataset_name = req.datasets[0]
    kb_dir = _kb_dir(dataset_name)

    # Verificar que el KB tiene documentos indexados
    wiki_dir = kb_dir / "wiki"
    if not wiki_dir.exists():
        return JSONResponse([{
            "search_result": (
                "No hay documentos indexados para este dataset. "
                "Sube y procesa el documento primero."
            ),
            "dataset_id": dataset_name,
            "dataset_name": dataset_name,
        }])

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
        # Devolver mensaje de error como respuesta (no 500) para que
        # cognee-client.ts pueda degradar a qaService
        return JSONResponse([{
            "search_result": f"Error en OpenKB: {str(e)[:300]}",
            "dataset_id": dataset_name,
            "dataset_name": dataset_name,
        }])


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
