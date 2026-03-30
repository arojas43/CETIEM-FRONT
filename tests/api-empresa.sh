#!/usr/bin/env bash
# ============================================================
# CETIEM — Test suite API panel empresa
# Prueba todos los endpoints relevantes para el rol COMPANY
# Uso: bash tests/api-empresa.sh [BASE_URL]
# ============================================================

BASE="${1:-http://localhost:3000}"
COOKIE_JAR="$(mktemp /tmp/cetiem-cookies-XXXX.txt)"
PASS=0; FAIL=0; SKIP=0
DOC_ID=""

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; ((PASS++)); }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL++)); }
skip() { echo -e "  ${YELLOW}⊘${NC} $1"; ((SKIP++)); }
section() { echo -e "\n${CYAN}${BOLD}▶ $1${NC}"; }

assert_http() {
  local label="$1" expected="$2" got="$3"
  if [ "$got" = "$expected" ]; then ok "$label (HTTP $got)"
  else fail "$label — esperado HTTP $expected, recibido $got"; fi
}

assert_json_key() {
  local label="$1" key="$2" body="$3"
  if echo "$body" | grep -q "\"$key\""; then ok "$label (campo '$key' presente)"
  else fail "$label — campo '$key' no encontrado en: ${body:0:120}..."; fi
}

# ──────────────────────────────────────────────────────────────
section "1. Autenticación"
# ──────────────────────────────────────────────────────────────

# 1a. CSRF token
CSRF_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/auth/csrf")
CSRF_TOKEN=$(echo "$CSRF_RESP" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CSRF_TOKEN" ]; then
  ok "CSRF token obtenido"
else
  fail "CSRF token no obtenido — respuesta: $CSRF_RESP"
fi

# 1b. Login empresa1
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=empresa1@cetiem.mx" \
  --data-urlencode "password=cetiem2024" \
  --data-urlencode "csrfToken=$CSRF_TOKEN" \
  --data-urlencode "callbackUrl=$BASE/dashboard" \
  --data-urlencode "json=true" \
  -L)

# NextAuth redirige 302→200 en login exitoso
if [ "$LOGIN_STATUS" = "200" ] || [ "$LOGIN_STATUS" = "302" ]; then
  ok "Login empresa1@cetiem.mx"
else
  fail "Login fallido — HTTP $LOGIN_STATUS"
fi

# 1c. Verificar sesión activa
SESSION_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/auth/session")
SESSION_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/auth/session")

assert_http "Endpoint /api/auth/session responde" "200" "$SESSION_STATUS"
assert_json_key "Sesión contiene email" "email" "$SESSION_RESP"

USER_ROLE=$(echo "$SESSION_RESP" | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
if [ "$USER_ROLE" = "COMPANY" ]; then ok "Rol es COMPANY"
else fail "Rol incorrecto: '$USER_ROLE'"; fi

# ──────────────────────────────────────────────────────────────
section "2. Documentos — Listado"
# ──────────────────────────────────────────────────────────────

DOCS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/documents")
DOCS_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/documents")

assert_http "GET /api/documents accesible" "200" "$DOCS_STATUS"
assert_json_key "Respuesta contiene documentos" "data" "$DOCS_RESP"

DOC_COUNT=$(echo "$DOCS_RESP" | grep -o '"id":"[^"]*"' | wc -l)
ok "Documentos existentes: $DOC_COUNT"

# ──────────────────────────────────────────────────────────────
section "3. Documentos — Upload"
# ──────────────────────────────────────────────────────────────

# Crear PDF mínimo de prueba
TEST_PDF=$(mktemp /tmp/test-XXXX.pdf)
cat > "$TEST_PDF" << 'PDFEOF'
%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 120>>stream
BT /F1 12 Tf 72 720 Td (CETIEM - Documento de Prueba Automatizada) Tj 0 -20 Td (Certificacion ISO 9001 - Gestion de Calidad) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000438 00000 n
trailer<</Size 6/Root 1 0 R>>
startxref
520
%%EOF
PDFEOF

UPLOAD_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE/api/documents" \
  -F "file=@$TEST_PDF;type=application/pdf" \
  -F "name=Test Certificacion CETIEM" \
  -F "description=Documento de prueba automatizada" \
  -F "domain=legal")

UPLOAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE/api/documents" \
  -F "file=@$TEST_PDF;type=application/pdf" \
  -F "name=Test Certificacion CETIEM 2" \
  -F "description=Segundo documento de prueba" \
  -F "domain=technical" 2>/dev/null)

# Extraer ID del primer upload
DOC_ID=$(echo "$UPLOAD_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$DOC_ID" ]; then
  ok "Documento subido — ID: $DOC_ID"
else
  fail "Upload fallido — respuesta: ${UPLOAD_RESP:0:200}"
  # Intentar recuperar un ID existente para continuar
  DOC_ID=$(echo "$DOCS_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$DOC_ID" ]; then
    skip "Usando documento existente para continuar: $DOC_ID"
  fi
fi

rm -f "$TEST_PDF"

# ──────────────────────────────────────────────────────────────
section "4. Documentos — Operaciones individuales"
# ──────────────────────────────────────────────────────────────

if [ -z "$DOC_ID" ]; then
  skip "Sin documento ID, saltando operaciones individuales"
else
  # GET documento
  DOC_DETAIL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/documents/$DOC_ID")
  DOC_DETAIL=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/documents/$DOC_ID")
  assert_http "GET /api/documents/$DOC_ID" "200" "$DOC_DETAIL_STATUS"
  assert_json_key "Detalle contiene 'name'" "name" "$DOC_DETAIL"

  # GET progreso
  PROGRESS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/documents/$DOC_ID/progress")
  assert_http "GET /api/documents/$DOC_ID/progress" "200" "$PROGRESS_STATUS"

  # PUT domain update
  DOMAIN_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X PUT "$BASE/api/documents/$DOC_ID/domain" \
    -H "Content-Type: application/json" \
    -d '{"domain":"INDUSTRIA"}')
  DOMAIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X PUT "$BASE/api/documents/$DOC_ID/domain" \
    -H "Content-Type: application/json" \
    -d '{"domain":"INDUSTRIA"}')
  if [ "$DOMAIN_STATUS" = "200" ] || [ "$DOMAIN_STATUS" = "201" ]; then
    ok "PUT /api/documents/$DOC_ID/domain → legal"
  else
    fail "Domain update — HTTP $DOMAIN_STATUS — ${DOMAIN_RESP:0:120}"
  fi

  # PATCH documento (rename)
  PATCH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X PATCH "$BASE/api/documents/$DOC_ID" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test Certificacion CETIEM (actualizado)"}')
  if [ "$PATCH_STATUS" = "200" ] || [ "$PATCH_STATUS" = "201" ]; then
    ok "PATCH /api/documents/$DOC_ID (rename)"
  else
    fail "Rename documento — HTTP $PATCH_STATUS"
  fi

  # GET content
  CONTENT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/documents/$DOC_ID/content")
  if [ "$CONTENT_STATUS" = "200" ] || [ "$CONTENT_STATUS" = "404" ]; then
    ok "GET /api/documents/$DOC_ID/content — HTTP $CONTENT_STATUS (sin índice aún = normal)"
  else
    fail "Content — HTTP $CONTENT_STATUS"
  fi

  # POST process — iniciar procesamiento
  PROCESS_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "$BASE/api/documents/$DOC_ID/process" \
    -H "Content-Type: application/json" \
    -d '{}')
  PROCESS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "$BASE/api/documents/$DOC_ID/process" \
    -H "Content-Type: application/json" \
    -d '{}')
  if [ "$PROCESS_STATUS" = "200" ] || [ "$PROCESS_STATUS" = "201" ] || [ "$PROCESS_STATUS" = "202" ]; then
    ok "POST /api/documents/$DOC_ID/process — trabajo encolado"
  else
    fail "Iniciar proceso — HTTP $PROCESS_STATUS — ${PROCESS_RESP:0:120}"
  fi

  # GET progress después de encolar
  sleep 2
  PROGRESS2_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/documents/$DOC_ID/progress")
  PROGRESS2_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/documents/$DOC_ID/progress")
  assert_http "GET progress post-procesado" "200" "$PROGRESS2_STATUS"
  assert_json_key "Progress tiene campo status" "status" "$PROGRESS2_RESP"

  # GET certificate (puede ser 404 si no certificado aún)
  CERT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/documents/$DOC_ID/certificate")
  if [ "$CERT_STATUS" = "200" ] || [ "$CERT_STATUS" = "404" ]; then
    ok "GET /api/documents/$DOC_ID/certificate — HTTP $CERT_STATUS"
  else
    fail "Certificate endpoint — HTTP $CERT_STATUS"
  fi

  # POST search en documento
  SEARCH_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "$BASE/api/documents/$DOC_ID/search" \
    -H "Content-Type: application/json" \
    -d '{"query":"certificacion calidad","limit":5}')
  SEARCH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "$BASE/api/documents/$DOC_ID/search" \
    -H "Content-Type: application/json" \
    -d '{"query":"certificacion calidad","limit":5}')
  if [ "$SEARCH_STATUS" = "200" ] || [ "$SEARCH_STATUS" = "404" ]; then
    ok "POST /api/documents/$DOC_ID/search — HTTP $SEARCH_STATUS"
  else
    fail "Search — HTTP $SEARCH_STATUS — ${SEARCH_RESP:0:120}"
  fi

  # GET graph
  GRAPH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/documents/$DOC_ID/graph")
  if [ "$GRAPH_STATUS" = "200" ] || [ "$GRAPH_STATUS" = "404" ]; then
    ok "GET /api/documents/$DOC_ID/graph — HTTP $GRAPH_STATUS"
  else
    fail "Graph endpoint — HTTP $GRAPH_STATUS"
  fi
fi

# ──────────────────────────────────────────────────────────────
section "5. CAPA tickets"
# ──────────────────────────────────────────────────────────────

CAPA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/capa")
CAPA_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/capa")

assert_http "GET /api/capa — accesible empresa" "200" "$CAPA_STATUS"

# ──────────────────────────────────────────────────────────────
section "6. Graph stats"
# ──────────────────────────────────────────────────────────────

GSTATS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/graph/stats")
GSTATS_RESP=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/graph/stats")

if [ "$GSTATS_STATUS" = "200" ]; then
  ok "GET /api/graph/stats — HTTP 200"
elif [ "$GSTATS_STATUS" = "403" ]; then
  ok "GET /api/graph/stats — HTTP 403 (restringido a empresa, correcto)"
else
  fail "Graph stats — HTTP $GSTATS_STATUS"
fi

# ──────────────────────────────────────────────────────────────
section "7. Accesos denegados (seguridad)"
# ──────────────────────────────────────────────────────────────

# Empresa NO debe acceder a audit (admin only)
AUDIT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/audit")
if [ "$AUDIT_STATUS" = "401" ] || [ "$AUDIT_STATUS" = "403" ]; then
  ok "GET /api/audit — denegado correctamente (HTTP $AUDIT_STATUS)"
else
  fail "GET /api/audit — empresa tiene acceso indebido (HTTP $AUDIT_STATUS)"
fi

# Sin sesión → debe denegar
NOSESSION_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/documents")
if [ "$NOSESSION_STATUS" = "401" ] || [ "$NOSESSION_STATUS" = "403" ]; then
  ok "Sin sesión → GET /api/documents denegado (HTTP $NOSESSION_STATUS)"
else
  fail "Sin sesión → GET /api/documents retorna HTTP $NOSESSION_STATUS (debería ser 401/403)"
fi

# ──────────────────────────────────────────────────────────────
section "8. Export CSV"
# ──────────────────────────────────────────────────────────────

EXPORT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE/api/export/documents")
if [ "$EXPORT_STATUS" = "200" ] || [ "$EXPORT_STATUS" = "403" ]; then
  ok "GET /api/export/documents — HTTP $EXPORT_STATUS"
else
  fail "Export CSV — HTTP $EXPORT_STATUS"
fi

# ──────────────────────────────────────────────────────────────
section "9. Limpieza — Delete documento de prueba"
# ──────────────────────────────────────────────────────────────

if [ -n "$DOC_ID" ]; then
  DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X DELETE "$BASE/api/documents/$DOC_ID")
  if [ "$DELETE_STATUS" = "200" ] || [ "$DELETE_STATUS" = "204" ]; then
    ok "DELETE /api/documents/$DOC_ID — documento eliminado"
  else
    fail "Delete — HTTP $DELETE_STATUS"
  fi
else
  skip "Sin documento de prueba para eliminar"
fi

# ──────────────────────────────────────────────────────────────
# Resumen
# ──────────────────────────────────────────────────────────────
rm -f "$COOKIE_JAR"

TOTAL=$((PASS + FAIL + SKIP))
echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Resultados: $TOTAL pruebas${NC}"
echo -e "  ${GREEN}✓ Pasadas:  $PASS${NC}"
echo -e "  ${RED}✗ Fallidas: $FAIL${NC}"
echo -e "  ${YELLOW}⊘ Saltadas: $SKIP${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

exit $FAIL
