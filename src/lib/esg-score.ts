/**
 * Shared ESG score calculation utilities.
 * Used by both /api/companies/[id]/certification and /api/documents/[id]/certifications
 * to guarantee consistent scoring regardless of which endpoint is called.
 */

export const VLAP_KEYS = ["vigencia", "legibilidad", "autoria", "pertinencia"] as const;
export type VlapKey = typeof VLAP_KEYS[number];

export const VLAP_HARD_STOP_THRESHOLD = 85;

export interface VlapEntry {
  value: boolean | null;
  confidence: number;
  override: boolean;
}
export type VlapMap = Record<string, VlapEntry>;

export interface ScoredFinding {
  type: string;
}

/**
 * Returns true when any VLAP dimension fails the hard stop:
 *   confidence < threshold  AND  value has been evaluated  AND  no override set
 */
export function hasVlapHardStop(vlap: VlapMap): boolean {
  return VLAP_KEYS.some(
    k =>
      vlap[k]?.value !== null &&
      vlap[k]?.confidence < VLAP_HARD_STOP_THRESHOLD &&
      !vlap[k]?.override
  );
}

/**
 * Calculates the V.L.A.P. score (0-100).
 * Formula: 70% based on pass ratio + 30% based on average confidence.
 * Returns null if no VLAP dimension has been evaluated.
 */
export function calcVlapScore(vlap: VlapMap): number | null {
  const evaluated = VLAP_KEYS.filter(k => vlap[k]?.value !== null);
  if (evaluated.length === 0) return null;

  const passed  = VLAP_KEYS.filter(k => vlap[k]?.value === true).length;
  const avgConf = VLAP_KEYS.reduce((sum, k) => sum + (vlap[k]?.confidence ?? 0), 0) / VLAP_KEYS.length;

  return (passed / VLAP_KEYS.length) * 0.7 * 100 + avgConf * 0.3;
}

/**
 * Calculates the findings score (0-100).
 * Returns null when no findings exist (avoids inflating the score artificially).
 * Formula: COMPLIANCE adds, NON_COMPLIANCE penalises ×2, OBSERVATION penalises ×0.5.
 */
export function calcFindingsScore(findings: ScoredFinding[]): number | null {
  if (findings.length === 0) return null;

  const comp = findings.filter(f => f.type === "COMPLIANCE").length;
  const nc   = findings.filter(f => f.type === "NON_COMPLIANCE").length;
  const obs  = findings.filter(f => f.type === "OBSERVATION").length;

  return Math.max(0, Math.min(100, ((comp - nc * 2 - obs * 0.5) / findings.length) * 100 + 50));
}

/**
 * Combines V.L.A.P. (50%) and findings (50%) into a single ESG score.
 * Falls back to whichever component is available when only one is present.
 */
export function calcEsgScore(
  vlap: VlapMap | null | undefined,
  findings: ScoredFinding[]
): number | null {
  const vlapScore     = vlap ? calcVlapScore(vlap) : null;
  const findingsScore = calcFindingsScore(findings);

  if (vlapScore !== null && findingsScore !== null)
    return Math.round(vlapScore * 0.5 + findingsScore * 0.5);
  if (vlapScore !== null) return Math.round(vlapScore);
  if (findingsScore !== null) return Math.round(findingsScore);
  return null;
}
