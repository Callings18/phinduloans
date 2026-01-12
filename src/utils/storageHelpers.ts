/**
 * Storage Helper Utilities
 * Handles signed URLs for private bucket access
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Get a signed URL for a file in a private bucket
 * @param filePath - The path to the file in the bucket
 * @param bucket - The bucket name (default: 'loan-documents')
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns The signed URL or null if failed
 */
export async function getSignedUrl(
  filePath: string,
  bucket: string = 'loan-documents',
  expiresIn: number = 3600
): Promise<string | null> {
  if (!filePath) return null;
  
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      console.error('[Storage] Failed to create signed URL:', error);
      return null;
    }
    
    return data?.signedUrl || null;
  } catch (err) {
    console.error('[Storage] Error creating signed URL:', err);
    return null;
  }
}

/**
 * Get multiple signed URLs in parallel
 * @param filePaths - Array of file paths
 * @param bucket - The bucket name
 * @param expiresIn - URL expiration time in seconds
 * @returns Object mapping file paths to signed URLs
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
 * Get displayable URL - returns signed URL for file paths, or original URL if already a URL
 */
export async function getDisplayableUrl(
  urlOrPath: string | null,
  bucket: string = 'loan-documents'
): Promise<string | null> {
  if (!urlOrPath) return null;
  
  // If it's already a URL, return as is
  if (urlOrPath.startsWith('http')) {
    return urlOrPath;
  }
  
  // Otherwise, get a signed URL
  return getSignedUrl(urlOrPath, bucket);
}
