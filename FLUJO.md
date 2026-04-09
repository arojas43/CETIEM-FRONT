# CETIEM — Flujo del Sistema

Diagrama completo de los tres perfiles y el pipeline de IA.

---

```mermaid
flowchart TD

    %% ─────────────────────────── EMPRESA ────────────────────────────────
    subgraph EMP ["🏢 EMPRESA"]
        E1([Registro]) --> E2([Login])
        E2 --> E3[Dashboard]
        E3 --> E4["📤 Subir Documentos\n/upload"]
        E3 --> E5["📄 Mis Documentos"]
        E3 --> E6["🏆 Mi Certificado ESG"]
        E3 --> E7["⚠️ Tickets CAPA"]
        E7 --> E8{"¿Todos los tickets\ncerrados?"}
        E8 -->|"Sí"| E9["Notifica al Assessor"]
        E8 -->|"No"| E7
    end

    %% ─────────────────────────── PIPELINE IA ────────────────────────────
    subgraph PIPE ["⚙️  PIPELINE IA — Impulsado por NVIDIA"]
        P1["PDF recibido\nSHA-256 calculado"] --> P2["Worker IA"]
        P2 --> P3["Extracción de estructura\ny texto del documento"]
        P3 --> P4["Análisis semántico\nentidades + relaciones"]
        P4 --> P5["Grafo de conocimiento\npersistente"]
        P5 --> P6{"¿Análisis\ncompletado?"}
        P6 -->|"Sí"| P7(["✅ ANALYZED"])
        P6 -->|"Parcial"| P8(["⚠️  INDEXED"])
        P2 -->|"Error"| P9(["❌ FAILED"])
    end

    %% ─────────────────────────── ASSESSOR ───────────────────────────────
    subgraph ASS ["👤 ASSESSOR — solo empresas asignadas"]
        A1["Dashboard\nestadísticas asignadas"] --> A2["Cola de Revisión\n/queue"]
        A2 --> A3["Expediente de Empresa\n/review/company/id"]
        A3 --> A4["Visor PDF inline\nQ&A con IA"]
        A3 --> A5["Motor V.L.A.P.\nVigencia · Legibilidad · Autoría · Pertinencia"]
        A5 --> A6{"Hard Stop\nalgún criterio < 85%\nsin override?"}
        A6 -->|"Bloqueado 🔒"| A5
        A6 -->|"OK"| A7["Agregar Hallazgos\n+ Notas generales"]
        A7 --> A8{"Veredicto"}
        A8 -->|"Aprobar"| A9(["✅ APPROVED\nCert ESG · UUID · SHA-256"])
        A8 -->|"Cambios + NC"| A10(["⚠️  CAPA OPEN\nTickets 30 días por hallazgo"])
        A8 -->|"Rechazar"| A11(["❌ REJECTED"])
    end

    %% ─────────────────────────── ADMIN ──────────────────────────────────
    subgraph ADM ["🛡️  SUPER ADMIN — acceso global"]
        AD1["Dashboard\nglobal del sistema"] --> AD2["Gestionar Empresas\n/companies"]
        AD2 --> AD3["Asignar Assessor\na Empresa"]
        AD1 --> AD4["Gestionar Assessors\n/assessors"]
        AD4 --> AD5["Crear nuevo Assessor"]
        AD1 --> AD6["Audit Log\n/logs · Exportar CSV"]
        AD2 --> AD8["🔴 Kill-switch\nRevocar Certificado"]
        AD8 --> AD6
    end

    %% ─────────────────────────── CONEXIONES ─────────────────────────────
    E4 -->|"POST /api/documents"| P1
    P7 --> A2
    P8 --> A2
    A9 --> E6
    A10 --> E7
    A11 --> E5
    AD3 -.->|"assessorId asignado"| A1
    A9 --> AD6
    A10 --> AD6
    A11 --> AD6

    %% ─────────────────────────── ESTILOS ─────────────────────────────────
    style EMP  fill:#0d3b3b,stroke:#00c9a7,color:#fff
    style PIPE fill:#1a1a2e,stroke:#6366f1,color:#fff
    style ASS  fill:#3b2500,stroke:#f59e0b,color:#fff
    style ADM  fill:#1a0a2e,stroke:#84cc16,color:#fff

    style P7  fill:#14532d,stroke:#22c55e,color:#fff
    style P8  fill:#3b2500,stroke:#f59e0b,color:#fff
    style P9  fill:#450a0a,stroke:#ef4444,color:#fff
    style A9  fill:#14532d,stroke:#22c55e,color:#fff
    style A10 fill:#3b2500,stroke:#f59e0b,color:#fff
    style A11 fill:#450a0a,stroke:#ef4444,color:#fff
```

---

## Tabla de acceso por rol

| Acción | 🏢 Empresa | 👤 Assessor | 🛡️ Admin |
|--------|-----------|-------------|---------|
| Subir documentos | ✅ | ❌ | ❌ |
| Ver sus propios documentos | ✅ | — | ✅ |
| Ver documentos de empresas asignadas | ❌ | ✅ | ✅ |
| Reprocesar documentos | ❌ | ✅ (asignadas) | ✅ |
| Q&A / Grafo de conocimiento | ❌ | ✅ (asignadas) | ✅ |
| Emitir dictamen V.L.A.P. | ❌ | ✅ (asignadas) | ✅ |
| Gestionar Tickets CAPA | Solo propios | Asignadas | Todos |
| Dashboard con stats globales | Solo propios | Solo asignadas | Sistema completo |
| Exportar CSV | ❌ | ✅ (asignadas) | ✅ |
| Asignar assessors a empresas | ❌ | ❌ | ✅ |
| Revocar certificados (Kill-switch) | ❌ | ❌ | ✅ |
| Ver Audit Log | ❌ | ❌ | ✅ |
