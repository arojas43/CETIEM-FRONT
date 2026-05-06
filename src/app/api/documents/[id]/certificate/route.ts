import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/documents/[id]/certificate
 * Generates an ESG certificate as HTML (printable as PDF via browser).
 * Returns HTML response directly.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true, companyName: true, track: true, rfc: true } },
        certifications: {
          where: { status: "APPROVED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { findings: false },
        },
      },
    });

    if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const cert = document.certifications[0];
    if (!cert) return NextResponse.json({ error: "No approved certification found" }, { status: 404 });

    const req = cert.requirements as any;
    const company = document.user.companyName || document.user.name || document.user.email;
    const track = document.user.track || "—";
    const trackLabel: Record<string, string> = { A: "Track A — Industria", B: "Track B — Construcción", C: "Track C — Tecnología / Servicios" };
    const score = cert.esgScore != null ? `${cert.esgScore.toFixed(1)}%` : "—";
    const hash = cert.sha256Hash || "—";
    const token = cert.publicToken || cert.id;
    const date = new Date(cert.createdAt).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Certificado ESG — ${company}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Noto+Sans:wght@400;500;600;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Noto Sans',sans-serif; background:#f8fafc; color:#161a1d; }
    .page { width:794px; min-height:1123px; margin:0 auto; background:#fff; padding:64px; position:relative; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:48px; }
    .logo { font-family:'Playfair Display',Georgia,serif; font-size:28px; font-weight:700; letter-spacing:-0.5px; color:#161a1d; }
    .logo span { color:#9b2247; }
    .badge { background:#9b2247; color:#fff; font-size:10px; font-weight:700; letter-spacing:2px; padding:6px 14px; border-radius:4px; text-transform:uppercase; }
    .title { text-align:center; margin-bottom:48px; }
    .title h1 { font-size:13px; font-weight:600; letter-spacing:3px; text-transform:uppercase; color:#98989a; margin-bottom:12px; }
    .title h2 { font-family:'Playfair Display',Georgia,serif; font-size:36px; font-weight:700; color:#161a1d; letter-spacing:-1px; }
    .company-box { background:#f1f5f9; border-radius:8px; padding:32px; margin-bottom:32px; }
    .company-box h3 { font-family:'Playfair Display',Georgia,serif; font-size:24px; font-weight:700; color:#161a1d; margin-bottom:6px; }
    .company-box p { font-size:13px; color:#98989a; }
    .grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:32px; }
    .kpi { background:#f1f5f9; border-radius:8px; padding:20px; }
    .kpi label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:1.5px; color:#98989a; display:block; margin-bottom:6px; }
    .kpi .value { font-size:22px; font-weight:700; color:#9b2247; }
    .kpi .sub { font-size:11px; color:#98989a; margin-top:2px; }
    .vlap { margin-bottom:32px; }
    .vlap h4 { font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#98989a; margin-bottom:12px; }
    .vlap-row { display:flex; justify-content:space-between; align-items:center; padding:10px 16px; background:#f8fafc; border-radius:4px; margin-bottom:6px; }
    .vlap-row span { font-size:12px; color:#161a1d; }
    .vlap-check { color:#1e5b4f; font-weight:700; font-size:13px; }
    .hash-box { background:#161a1d; border-radius:8px; padding:20px 24px; margin-bottom:32px; }
    .hash-box label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:1.5px; color:#98989a; display:block; margin-bottom:8px; }
    .hash-box code { font-family:monospace; font-size:11px; color:#e6d194; word-break:break-all; }
    .footer { border-top:1px solid #e2e8f0; padding-top:24px; display:flex; justify-content:space-between; align-items:flex-end; }
    .footer .seal { font-size:11px; color:#98989a; }
    .footer .issued { text-align:right; }
    .footer .issued strong { display:block; font-size:13px; color:#161a1d; font-weight:700; }
    .footer .issued span { font-size:11px; color:#98989a; }
    .watermark { position:absolute; bottom:80px; right:64px; opacity:0.04; font-size:80px; font-weight:900; color:#9b2247; transform:rotate(-15deg); pointer-events:none; }
    @media print { body{background:#fff;} .page{margin:0;padding:48px;} }
  </style>
</head>
<body>
<div class="page">
  <div class="watermark">ECONOMIA</div>

  <div class="header">
    <div class="logo">ECONOMIA<span>.</span>SC</div>
    <div class="badge">✓ Certificado ESG Verificado</div>
  </div>

  <div class="title">
    <h1>Constancia de Certificación</h1>
    <h2>Certificado ESG ${trackLabel[track] || track}</h2>
  </div>

  <div class="company-box">
    <h3>${company}</h3>
    <p>${document.user.rfc ? "RFC: " + document.user.rfc + " · " : ""}Correo: ${document.user.email}</p>
  </div>

  <div class="grid">
    <div class="kpi">
      <label>Score ESG</label>
      <div class="value">${score}</div>
      <div class="sub">Protocolo V.L.A.P.</div>
    </div>
    <div class="kpi">
      <label>Track Sectorial</label>
      <div class="value" style="font-size:16px">${trackLabel[track] || "—"}</div>
    </div>
    <div class="kpi">
      <label>Fecha de Emisión</label>
      <div class="value" style="font-size:16px">${date}</div>
    </div>
  </div>

  ${req?.vlap ? `
  <div class="vlap">
    <h4>Validación V.L.A.P.</h4>
    ${["vigencia", "legibilidad", "autoria", "pertinencia"].map(k => {
      const v = req.vlap[k];
      return `<div class="vlap-row">
        <span>${k.charAt(0).toUpperCase() + k.slice(1)}</span>
        <div style="display:flex;gap:16px;align-items:center;">
          <span style="font-size:11px;color:#94a3b8">${v?.confidence || 0}% confianza</span>
          <span class="vlap-check">${v?.value === true ? "✓ Cumple" : v?.value === false ? "✗ No cumple" : "—"}</span>
        </div>
      </div>`;
    }).join("")}
  </div>
  ` : ""}

  <div class="hash-box">
    <label>Sello de Integridad Forense (SHA-256)</label>
    <code>${hash}</code>
  </div>

  <div class="footer">
    <div class="seal">
      <div>ID de verificación: ${token}</div>
      <div>Documento: ${document.name}</div>
      <div>Assessor: ${req?.assessorEmail || "ECONOMIA"}</div>
    </div>
    <div class="issued">
      <strong>CETIEM S.C.</strong>
      <span>Agile Audit Hub · Certificación ESG</span>
    </div>
  </div>
</div>
<script>window.onload = () => window.print()</script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("certificate error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
