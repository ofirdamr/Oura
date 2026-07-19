/**
 * Browser-side ZIP extraction — never uploads the .zip to any server.
 * Returns individual image File objects ready to feed into ResilientUploadManager.
 *
 * Only entries whose names end in a common image extension are yielded;
 * macOS __MACOSX metadata files and dotfiles are silently skipped.
 */

import JSZip from "jszip";

export type ExtractProgress = {
  extracted: number;
  total: number;
  currentFileName: string;
};

const IMAGE_EXTS = /\.(jpe?g|png|webp|heic|heif|tiff?|bmp)$/i;
const SKIP_PREFIX = /^(__MACOSX|\.)/;

export async function extractZipLocally(
  zipFile: File,
  onProgress?: (progress: ExtractProgress) => void,
): Promise<File[]> {
  const zip = await JSZip.loadAsync(zipFile);

  const imageEntries = Object.values(zip.files).filter((entry) => {
    if (entry.dir) return false;
    const name = entry.name.split("/").pop() ?? entry.name;
    if (SKIP_PREFIX.test(name)) return false;
    return IMAGE_EXTS.test(name);
  });

  const total = imageEntries.length;
  const files: File[] = [];

  for (let i = 0; i < imageEntries.length; i++) {
    const entry = imageEntries[i];
    const blob = await entry.async("blob");
    const baseName = entry.name.split("/").pop() ?? entry.name;
    const mimeType = guessMime(baseName);
    files.push(new File([blob], baseName, { type: mimeType }));

    onProgress?.({ extracted: i + 1, total, currentFileName: baseName });
  }

  return files;
}

function guessMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    tiff: "image/tiff",
    tif: "image/tiff",
    bmp: "image/bmp",
  };
  return map[ext] ?? "image/jpeg";
}
