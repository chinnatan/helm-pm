/** Max edge lengths — Full HD fit (keep aspect, never upscale). */
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
/** JPEG / WebP encoding quality (0–1). */
const JPEG_WEBP_QUALITY = 0.82;

const SKIP_TYPES = new Set(["image/svg+xml", "image/gif"]);

function replaceExtension(filename: string, ext: string): string {
  const base = filename.replace(/\.[^/.]+$/, "") || filename;
  return `${base}.${ext}`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  // Sample a grid so we don't scan every pixel on large images.
  const stepX = Math.max(1, Math.floor(width / 48));
  const stepY = Math.max(1, Math.floor(height / 48));
  const { data } = ctx.getImageData(0, 0, width, height);

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      if (data[(y * width + x) * 4 + 3]! < 255) return true;
    }
  }
  return false;
}

/**
 * Shrink oversized images to Full HD and compress before upload.
 * Non-images and skipped types (SVG, GIF) are returned unchanged.
 * On failure, returns the original file so uploads are never blocked.
 */
export async function optimizeUploadFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || SKIP_TYPES.has(file.type)) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const preserveAlpha = hasTransparency(ctx, targetW, targetH);

    let blob: Blob | null = null;
    let outType: string;
    let outExt: string;

    if (preserveAlpha) {
      blob = await canvasToBlob(canvas, "image/png");
      outType = "image/png";
      outExt = "png";
    } else {
      blob = await canvasToBlob(canvas, "image/webp", JPEG_WEBP_QUALITY);
      if (blob) {
        outType = "image/webp";
        outExt = "webp";
      } else {
        blob = await canvasToBlob(canvas, "image/jpeg", JPEG_WEBP_QUALITY);
        outType = "image/jpeg";
        outExt = "jpg";
      }
    }

    if (!blob) return file;

    // Prefer the optimized file when it is smaller (or we resized).
    if (blob.size >= file.size && scale === 1 && file.type === outType) {
      return file;
    }

    return new File([blob], replaceExtension(file.name, outExt), {
      type: outType,
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn("optimizeUploadFile failed, using original:", err);
    return file;
  }
}
