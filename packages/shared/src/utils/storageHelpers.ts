/**
 * Storage Helper Utilities
 * Handles authenticated downloads for private bucket access.
 */

import { supabase } from "@phinduloans/shared/integrations/supabase/client";

/**
 * Download a file with the caller's authenticated Supabase session and return
 * a short-lived browser object URL. This avoids the signed-object GET failure
 * seen in production while preserving the bucket's RLS checks.
 * @param filePath - The path to the file in the bucket
 * @param bucket - The bucket name (default: 'loan-documents')
 * @param expiresIn - Retained for API compatibility; object URLs expire locally
 * @returns A browser object URL or null if the authenticated download failed
 */
export async function getSignedUrl(
  filePath: string | null,
  bucket: string = 'loan-documents',
  _expiresIn: number = 3600
): Promise<string | null> {
  if (!filePath) return null;

  const storagePath = getStorageObjectPath(filePath, bucket);
  if (!storagePath) return filePath.startsWith('http') ? filePath : null;
  
  try {
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    
    if (error) {
      console.error('[Storage] Authenticated document download failed:', error);
      return null;
    }
    
    if (!data) return null;
    const objectUrl = URL.createObjectURL(data);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30 * 60 * 1000);
    return objectUrl;
  } catch (err) {
    console.error('[Storage] Error downloading document:', err);
    return null;
  }
}

function getStorageObjectPath(filePath: string, bucket: string): string | null {
  if (!/^https?:\/\//i.test(filePath)) return filePath;
  try {
    const parsed = new URL(filePath);
    const marker = `/storage/v1/object/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const rest = parsed.pathname.slice(markerIndex + marker.length);
    const bucketPrefix = `${bucket}/`;
    const bucketIndex = rest.indexOf(bucketPrefix);
    if (bucketIndex < 0) return null;
    const path = rest.slice(bucketIndex + bucketPrefix.length);
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

/**
 * Download multiple protected files in parallel
 * @param filePaths - Array of file paths
 * @param bucket - The bucket name
 * @param expiresIn - URL expiration time in seconds
 * @returns Object mapping file paths to temporary browser object URLs
 */
export async function getSignedUrls(
  filePaths: string[],
  bucket: string = 'loan-documents',
  expiresIn: number = 3600
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};
  
  await Promise.all(
    filePaths.map(async (path) => {
      results[path] = await getSignedUrl(path, bucket, expiresIn);
    })
  );
  
  return results;
}

/**
 * Check if a URL is a signed URL or a file path
 * File paths don't start with http
 */
export function isFilePath(url: string | null): boolean {
  if (!url) return false;
  return !url.startsWith('http');
}

/**
 * Get displayable URL - downloads storage URLs with the current authenticated session.
 */
export async function getDisplayableUrl(
  urlOrPath: string | null,
  bucket: string = 'loan-documents'
): Promise<string | null> {
  if (!urlOrPath) return null;
  
  // Storage URLs are converted to authenticated downloads; external URLs pass through.
  return getSignedUrl(urlOrPath, bucket);
}
