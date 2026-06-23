const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const PDF_MIME = "application/pdf";

export const BORROWER_RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const BORROWER_CONTRACT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

function extFromName(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() || "" : "";
}

export function validateBorrowerReceiptFile(file: File): string | null {
  if (file.size > BORROWER_RECEIPT_MAX_BYTES) {
    return `Receipt must be ${BORROWER_RECEIPT_MAX_BYTES / (1024 * 1024)}MB or smaller.`;
  }
  const ext = extFromName(file.name);
  const okExt = ext === "pdf" || ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp" || ext === "gif";
  const mime = (file.type || "").toLowerCase();
  const okMime = mime === PDF_MIME || IMAGE_MIME.has(mime);
  if (!okExt && !okMime) {
    return "Receipt must be a PDF or image (JPG, PNG, WEBP, GIF).";
  }
  if (mime && !(mime === PDF_MIME || IMAGE_MIME.has(mime))) {
    return "Receipt file type is not allowed.";
  }
  return null;
}

/** Signed contract upload: PDF or images, larger cap than receipts. */
export function validateBorrowerContractUploadFile(file: File): string | null {
  if (file.size > BORROWER_CONTRACT_UPLOAD_MAX_BYTES) {
    return `Contract file must be ${BORROWER_CONTRACT_UPLOAD_MAX_BYTES / (1024 * 1024)}MB or smaller.`;
  }
  const ext = extFromName(file.name);
  const okExt = ext === "pdf" || ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp";
  const mime = (file.type || "").toLowerCase();
  const okMime = mime === PDF_MIME || IMAGE_MIME.has(mime);
  if (!okExt && !okMime) {
    return "Contract must be a PDF or image (JPG, PNG, WEBP).";
  }
  if (mime && !(mime === PDF_MIME || IMAGE_MIME.has(mime))) {
    return "Contract file type is not allowed.";
  }
  return null;
}
