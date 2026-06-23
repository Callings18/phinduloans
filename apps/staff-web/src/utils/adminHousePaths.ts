/** Canonical admin paths for product-house workflows. */

export function normalizeProductCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return normalized || null;
}

export function houseRootPath(productCode: string): string {
  return `/admin/houses/${encodeURIComponent(normalizeProductCode(productCode) ?? productCode)}`;
}

export function houseLoanDetailPath(productCode: string, loanId: string): string {
  return `${houseRootPath(productCode)}/loans/${encodeURIComponent(loanId)}`;
}

export function houseLoanEditPath(productCode: string, loanId: string): string {
  return `${houseLoanDetailPath(productCode, loanId)}/edit`;
}

export function houseDisbursementsPath(productCode: string): string {
  return `${houseRootPath(productCode)}/disbursements`;
}

export function houseCollectionsPath(productCode: string): string {
  return `${houseRootPath(productCode)}/collections`;
}

export function resolveProductCodeFromId(
  products: Array<{ id: string; product_code?: string | null }> | undefined,
  loanProductId: string | null | undefined,
): string | null {
  if (!loanProductId || !products?.length) return null;
  const match = products.find((p) => p.id === loanProductId);
  return normalizeProductCode(match?.product_code ?? null);
}
