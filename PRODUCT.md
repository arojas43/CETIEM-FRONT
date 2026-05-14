# Product

## Register

product

## Users

Three distinct roles, each with a different context and stakes:

- **Empresa (Mexican SME)**: A compliance officer or mid-level manager at a small-to-medium business, uploading PDFs from a desktop in a Mexican office. Their corporate clients (supply chain, large corporates) require ESG certification as a procurement condition. High stakes: failure to certify means losing contracts. They need guidance, not complexity. The process is new to them.

- **Assessor ESG**: A certified professional reviewing documentation in the split-view console, often handling multiple companies in parallel. Precision-focused. Works in a professional setting during business hours. Needs high-density information presented without noise or clutter. The AI dictamen is their starting point, not their final word.

- **Admin (CETIEM / Cipre staff)**: Internal operator managing company queues, assessor assignments, certificates, audit logs, and the kill-switch. Power user. Expects the tool to be a reliable control plane. Wants to see the full system state at a glance.

## Product Purpose

CETIEM is Mexico's national AI-powered ESG certification platform for PyMEs. Companies upload compliance documents (PDFs: manuals, actas, procedures). The system processes them through PageIndex and OpenKB using NVIDIA NIM (Kimi K2.6 + Llama 3.1), producing a preliminary AI dictamen via the V.L.A.P. protocol. A certified Assessor then validates the dictamen in a human-in-the-loop review. Approved companies receive a verifiable digital certificate with legal standing, endorsed by SEMARNAT and Secretaría de Economía.

Success: a PyME obtaining certification in days instead of months, with a defensible, auditable paper trail.

## Brand Personality

Institucional, Riguroso, Tecnológico.

Voice: authoritative and clear, never casual. Always in Spanish. This is infrastructure — it speaks like a notary who also happens to understand distributed systems. No marketing fluff. Every word is precise.

Emotional goals: the Empresa should feel that a serious institution has their back. The Assessor should feel empowered, not burdened. The Admin should feel the system is in control.

## Anti-references

- **Generic SaaS green**: HubSpot, Intercom, Notion — friendly-corporate, rounded, warm. CETIEM is not a startup tool and should not feel like one.
- **Mexican government portal aesthetics**: SAT, IMSS, Gob.mx — bureaucratic gray, form-heavy, zero visual hierarchy. CETIEM modernizes the certification system; it must not look like what it replaces.
- **Crypto / Web3 neon-dark**: speculative energy, neon excess. CETIEM's dark theme is institutional command, not speculation.
- **Consumer-app warmth**: Duolingo, Airbnb — casual, approachable, playful. The stakes here are legal and commercial.

## Design Principles

1. **Infrastructure confidence**: Every visual decision should communicate that this system is reliable, auditable, and serious. Precision over flair. When in doubt, remove decoration.
2. **Role-aware density**: The Empresa view is calm, guided, and sparse; the Assessor console is information-dense and efficient. The same design language, two registers of complexity.
3. **Equal investment across surfaces**: The landing page and the product dashboard carry equal design commitment. The brand and the tool must feel like one system, not an afterthought bolted to a product.
4. **Status is the language**: The four-state system (Approved / In Progress / Review / Hard Stop) is the product's primary communication mechanism. Every element that touches document state must use the established chromatic code consistently.
5. **Dark as authority, not decoration**: The always-dark option is earned by the product's institutional gravity. It signals a serious control environment. Where light variants appear (onboarding, Empresa portal), they should feel equally authoritative, not softer by default.

## Accessibility & Inclusion

WCAG 2.1 AA minimum. Primary language: Spanish (Mexico). All UI copy, error messages, and system states in Spanish. Status colors must never rely on color alone: always pair with label, icon, or pattern. Assessor workflows involve extended screen time; eye strain is a first-class concern. Ensure sufficient contrast on dark surfaces at all text sizes.
