"""
Cognee 1.0 API entrypoint.
Configures FalkorDB (graph + vector) and NVIDIA NIM (LLM + embeddings),
then starts the built-in FastAPI server.

Provider names verified against Cognee 1.0 docs:
  - Graph/Vector DB: "falkordb" (NOT "falkor")
  - Embedding: "custom" for any openai-compatible endpoint (NIM, Ollama, etc.)
  - LLM: "openai" works for NIM (openai-compatible protocol)
"""
import os
import cognee

# ── Register FalkorDB hybrid adapter (runs as import side-effect) ──────────────
# register.py calls use_vector_adapter("falkor", ...) and use_graph_adapter("falkor", ...)
# so the provider name in config must be "falkor" (NOT "falkordb").
import cognee_community_hybrid_adapter_falkor.register  # noqa: F401

# ── Environment ────────────────────────────────────────────────────────────────
FALKORDB_HOST = os.environ.get("FALKORDB_HOST", "falkordb")
FALKORDB_PORT = int(os.environ.get("FALKORDB_PORT", "6379"))
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
NVIDIA_EMBEDDING_MODEL = os.environ.get(
    "NVIDIA_EMBEDDING_MODEL", "nvidia/llama-3.2-nemoretriever-300m-embed-v1"
)
# kimi-k2.6 — 1M context, 446ms, reemplaza DeepSeek mientras esté caído en NIM
NVIDIA_CHAT_MODEL = os.environ.get("NVIDIA_DEEPSEEK_MODEL", "moonshotai/kimi-k2.6")
NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"

# ── Vector DB — provider "falkor" as registered by the adapter ────────────────
cognee.config.set_vector_db_config({
    "vector_db_provider": "falkor",
    "vector_db_url": FALKORDB_HOST,
    "vector_db_port": FALKORDB_PORT,
    "vector_db_key": "",
})

# ── Graph DB — provider "falkor" as registered by the adapter ─────────────────
cognee.config.set_graph_db_config({
    "graph_database_provider": "falkor",
    "graph_database_url": FALKORDB_HOST,
    "graph_database_port": FALKORDB_PORT,
    "graph_database_username": "",
    "graph_database_password": "",
})

# ── LLM (NVIDIA NIM — OpenAI-compatible, DeepSeek V4 Pro) ────────────────────
cognee.config.set_llm_config({
    "llm_provider": "openai",
    "llm_model": NVIDIA_CHAT_MODEL,
    "llm_endpoint": NVIDIA_BASE_URL,
    "llm_api_key": NVIDIA_API_KEY,
})

# ── Embeddings (NVIDIA NIM — use "custom" for openai-compatible endpoints) ────
cognee.config.set_embedding_config({
    "embedding_provider": "custom",
    "embedding_model": NVIDIA_EMBEDDING_MODEL,
    "embedding_endpoint": NVIDIA_BASE_URL,
    "embedding_api_key": NVIDIA_API_KEY,
    "embedding_dimensions": 2048,
})

print("[Cognee] ✓ Configuración aplicada")
print(f"[Cognee]   FalkorDB  : {FALKORDB_HOST}:{FALKORDB_PORT}")
print(f"[Cognee]   Embedding : {NVIDIA_EMBEDDING_MODEL}")
print(f"[Cognee]   LLM       : {NVIDIA_CHAT_MODEL}")

# ── Start API server ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    from cognee.api.client import app

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
