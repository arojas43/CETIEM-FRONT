import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/companies/[id]/certificate
 * Genera el certificado ESG como HTML imprimible.
 * Solo disponible cuando status === APPROVED.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: companyId } = await params;
  const role = (session.user as any).role as string;

  // Company solo puede ver su propio certificado
  if (role === "COMPANY" && session.user.id !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [cert, company] = await Promise.all([
    prisma.companyCertification.findFirst({
      where: { companyId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: companyId },
      select: { companyName: true, name: true, email: true, rfc: true, track: true },
    }),
  ]);

  if (!cert) {
    return NextResponse.json({ error: "No hay certificado aprobado para esta empresa" }, { status: 404 });
  }

  const req = cert.requirements as any;
  const findings = (req?.findings ?? []) as any[];
  const assessedDate = req?.assessedAt
    ? new Date(req.assessedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : new Date(cert.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

  const companyName = company?.companyName || company?.name || company?.email || "—";
  const esgScore = cert.esgScore !== null && cert.esgScore !== undefined ? Math.round(cert.esgScore) : null;
  const trackMap: Record<string, string> = { A: "Industria", B: "Construcción", C: "Tecnología/Servicios" };
  const track = company?.track ? trackMap[company.track] ?? company.track : "—";

  const ncCount  = findings.filter(f => f.type === "NON_COMPLIANCE").length;
  const obsCount = findings.filter(f => f.type === "OBSERVATION").length;
  const compCount = findings.filter(f => f.type === "COMPLIANCE").length;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Certificado ESG — ${companyName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #f5f5f0; color: #1a1a1a; }
    .page { max-width: 820px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 40px rgba(0,0,0,0.12); }
    .header { background: linear-gradient(135deg, #0f1a0f 0%, #1a2e1a 100%); padding: 40px 48px; position: relative; }
    .header-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
    .logo-circle { width: 44px; height: 44px; border-radius: 50%; background: #9fc031; display: flex; align-items: center; justify-content: center; }
    .logo-circle svg { width: 22px; height: 22px; fill: black; }
    .logo-text { color: #9fc031; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .logo-sub { color: rgba(255,255,255,0.4); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 1px; }
    .seal { position: absolute; right: 48px; top: 40px; text-align: right; }
    .seal-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(159,192,49,0.15); border: 1px solid rgba(159,192,49,0.4); border-radius: 100px; padding: 6px 16px; }
    .seal-dot { width: 8px; height: 8px; border-radius: 50%; background: #9fc031; }
    .seal-text { color: #9fc031; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; }
    .header-title { color: white; font-size: 32px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
    .header-sub { color: rgba(255,255,255,0.45); font-size: 13px; }
    .body { padding: 40px 48px; }
    .company-name { font-size: 26px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
    .company-meta { font-size: 13px; color: #666; margin-bottom: 32px; }
    .score-row { display: flex; gap: 16px; margin-bottom: 32px; }
    .score-card { flex: 1; background: #f9fdf0; border: 1px solid #d4e89a; border-radius: 12px; padding: 20px; text-align: center; }
    .score-value { font-size: 36px; font-weight: 700; color: #5a8a00; }
    .score-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
    .info-card { background: #f8f8f8; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; display: block; margin-bottom: 3px; }
    .info-item span { font-size: 14px; font-weight: 500; color: #1a1a1a; }
    h3 { font-size: 13px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .findings-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .finding-pill { background: #f5f5f5; border-radius: 8px; padding: 12px; text-align: center; }
    .finding-count { font-size: 24px; font-weight: 700; margin-bottom: 2px; }
    .finding-label { font-size: 11px; color: #888; }
    .finding-nc  { color: #c94040; }
    .finding-obs { color: #cc8800; }
    .finding-comp{ color: #5a8a00; }
    .notes-box { background: #fffff8; border-left: 3px solid #cc8800; border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 20px; font-style: italic; color: #555; font-size: 14px; line-height: 1.6; }
    .token-box { background: #f0f0f0; border-radius: 8px; padding: 14px 18px; font-family: monospace; font-size: 12px; color: #444; word-break: break-all; margin-bottom: 20px; }
    .footer { border-top: 1px solid #eee; padding: 24px 48px; display: flex; justify-content: space-between; align-items: center; }
    .footer-left { font-size: 11px; color: #999; line-height: 1.5; }
    .footer-right { text-align: right; font-size: 11px; color: #999; }
    .nvidia-badge { display: inline-flex; align-items: center; gap: 6px; background: #f0f0f0; border-radius: 100px; padding: 4px 12px; font-size: 10px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 1px; }
    @media print { body { background: white; } .page { box-shadow: none; margin: 0; border-radius: 0; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-logo">
        <div class="logo-circle">
          <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <div>
          <div class="logo-text">CETIEM</div>
          <div class="logo-sub">Centro Tecnológico ESG</div>
        </div>
      </div>
      <div class="seal">
        <div class="seal-badge">
          <div class="seal-dot"></div>
          <div class="seal-text">Certificado Activo</div>
        </div>
      </div>
      <div class="header-title">Certificado ESG</div>
      <div class="header-sub">Sistema de Certificación Empresarial Sustentable</div>
    </div>

    <div class="body">
      <div class="company-name">${companyName}</div>
      <div class="company-meta">${company?.rfc ? `RFC: ${company.rfc} · ` : ""}${track} · Emitido el ${assessedDate}</div>

      ${esgScore !== null ? `
      <div class="score-row">
        <div class="score-card">
          <div class="score-value">${esgScore}%</div>
          <div class="score-label">Puntuación ESG</div>
        </div>
        <div class="score-card" style="background:#f8f8ff; border-color:#d0d0ff;">
          <div class="score-value" style="color:#3333aa;">${compCount}</div>
          <div class="score-label">Cumplimientos</div>
        </div>
        <div class="score-card" style="background:#fff8f0; border-color:#ffd090;">
          <div class="score-value" style="color:#cc7700;">${obsCount}</div>
          <div class="score-label">Observaciones</div>
        </div>
      </div>` : ""}

      <div class="info-card">
        <h3>Información de la Certificación</h3>
        <div class="info-grid">
          <div class="info-item"><label>Empresa</label><span>${companyName}</span></div>
          <div class="info-item"><label>Track Sectorial</label><span>${track}</span></div>
          <div class="info-item"><label>Fecha de Emisión</label><span>${assessedDate}</span></div>
          ${req?.assessorEmail ? `<div class="info-item"><label>Assessor ESG</label><span>${req.assessorEmail}</span></div>` : ""}
        </div>
      </div>

      ${req?.notes ? `
      <h3>Nota del Assessor ESG</h3>
      <div class="notes-box">"${req.notes}"</div>` : ""}

      ${cert.publicToken ? `
      <h3>Token de Verificación</h3>
      <div class="token-box">${cert.publicToken}</div>` : ""}

      <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
        <span class="nvidia-badge">Análisis IA · NVIDIA NIM</span>
        <span style="font-size:11px;color:#aaa;">Impulsado por inteligencia artificial</span>
      </div>
    </div>

    <div class="footer">
      <div class="footer-left">
        CETIEM — Certificación ESG<br/>
        Este documento tiene validez oficial y puede ser verificado.
      </div>
      <div class="footer-right">
        ${cert.sha256Hash ? `SHA-256: ${cert.sha256Hash.substring(0, 16)}...` : ""}
      </div>
    </div>
  </div>
  <script>window.print();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="certificado-esg-${companyId}.html"`,
    },
  });
}
