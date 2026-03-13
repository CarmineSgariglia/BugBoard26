const KILOBYTE = 1024;
const MEGABYTE = 1024 * KILOBYTE;

export const PROFILE_IMAGE_MAX_BYTES = 2 * MEGABYTE;
export const ATTACHMENT_MAX_FILE_BYTES = 10 * MEGABYTE;
export const ATTACHMENT_MAX_VIDEO_BYTES = 50 * MEGABYTE;
export const ATTACHMENT_MAX_FILES = 10;
export const ATTACHMENT_FILE_INPUT_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  ".txt",
  ".log",
  ".md",
  ".csv",
  ".json",
  ".pdf",
  ".zip",
].join(",");
export const ATTACHMENT_INFO_SECTIONS = [
  {
    title: "Images",
    items: ["JPG", "PNG", "WEBP"],
  },
  {
    title: "Videos",
    items: ["MP4", "WEBM", "MOV"],
  },
  {
    title: "Files",
    items: ["TXT", "LOG", "MD", "CSV", "JSON", "PDF", "ZIP"],
  },
] as const;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const TEXT_ATTACHMENT_MIME_TYPES = new Set([
  "application/json",
  "text/csv",
  "text/markdown",
  "text/plain",
]);
const TEXT_ATTACHMENT_EXTENSIONS = new Set([".csv", ".json", ".log", ".md", ".txt"]);
const FILE_EXTENSION_TO_MIME: Record<string, string> = {
  ".csv": "text/csv",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".log": "text/plain",
  ".m4v": "video/mp4",
  ".md": "text/plain",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".zip": "application/zip",
};
const NON_MEDIA_MIME_TYPES = new Set([
  "application/json",
  "application/pdf",
  "application/zip",
  "text/csv",
  "text/plain",
]);

export type AttachmentPreviewKind = "image" | "video" | "pdf" | "text" | "file" | "unsupported";

type AttachmentDescriptor = {
  attachmentId?: number;
  mimeType?: string | null;
  originalName?: string | null;
  path?: string | null;
  url?: string | null;
};

let webpSupportPromise: Promise<boolean> | null = null;

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function getEffectiveMimeTypeFromParts(mimeType?: string | null, nameOrPath?: string | null): string {
  const normalizedMimeType = mimeType?.trim().toLowerCase();
  if (normalizedMimeType) {
    return normalizedMimeType;
  }
  return FILE_EXTENSION_TO_MIME[getFileExtension(nameOrPath ?? "")] ?? "";
}

function getEffectiveMimeType(file: File): string {
  return getEffectiveMimeTypeFromParts(file.type, file.name);
}

function replaceExtension(name: string, extension: string): string {
  const trimmedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  const dotIndex = name.lastIndexOf(".");
  const baseName = dotIndex >= 0 ? name.slice(0, dotIndex) : name;
  return `${baseName}${trimmedExtension}`;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to encode image"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read image"));
    };
    image.src = objectUrl;
  });
}

async function readExifOrientation(file: File): Promise<number> {
  if (getEffectiveMimeType(file) !== "image/jpeg") {
    return 1;
  }

  const buffer = await file.slice(0, 128 * KILOBYTE).arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) {
    return 1;
  }

  let offset = 2;
  while (offset + 1 < view.byteLength) {
    const marker = view.getUint16(offset, false);
    offset += 2;

    if (marker === 0xffe1) {
      if (offset + 2 > view.byteLength) return 1;
      const segmentLength = view.getUint16(offset, false);
      offset += 2;
      if (offset + segmentLength - 2 > view.byteLength) return 1;
      if (view.getUint32(offset, false) !== 0x45786966) return 1;

      const tiffOffset = offset + 6;
      const littleEndian = view.getUint16(tiffOffset, false) === 0x4949;
      const firstIfdOffset = view.getUint32(tiffOffset + 4, littleEndian);
      let entryOffset = tiffOffset + firstIfdOffset;
      const entries = view.getUint16(entryOffset, littleEndian);
      entryOffset += 2;

      for (let i = 0; i < entries; i += 1) {
        const tagOffset = entryOffset + i * 12;
        if (tagOffset + 12 > view.byteLength) {
          break;
        }
        if (view.getUint16(tagOffset, littleEndian) === 0x0112) {
          return view.getUint16(tagOffset + 8, littleEndian);
        }
      }
      return 1;
    }

    if ((marker & 0xff00) !== 0xff00 || offset + 2 > view.byteLength) {
      break;
    }
    offset += view.getUint16(offset, false);
  }

  return 1;
}

function drawImageWithOrientation(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  orientation: number,
) {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width);
      break;
    default:
      break;
  }

  ctx.drawImage(image, 0, 0, width, height);
}

function getTargetDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
  scaleFactor: number,
) {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1) * scaleFactor;
  const safeRatio = ratio > 0 ? ratio : 1;
  return {
    width: Math.max(1, Math.round(width * safeRatio)),
    height: Math.max(1, Math.round(height * safeRatio)),
  };
}

async function supportsWebP(): Promise<boolean> {
  if (!webpSupportPromise) {
    webpSupportPromise = Promise.resolve().then(() => {
      const canvas = document.createElement("canvas");
      return canvas.toDataURL("image/webp").startsWith("data:image/webp");
    });
  }
  return webpSupportPromise;
}

type CompressedImageOptions = {
  maxWidth: number;
  maxHeight: number;
  targetMaxBytes: number;
};

async function compressImageFile(file: File, options: CompressedImageOptions): Promise<File> {
  const image = await loadImage(file);
  const orientation = await readExifOrientation(file);
  const webpEnabled = await supportsWebP();
  const mimeCandidates = webpEnabled ? ["image/webp", "image/jpeg"] : ["image/jpeg"];
  const scaleSteps = [1, 0.85, 0.72, 0.6];
  const qualitySteps = [0.82, 0.74, 0.66, 0.58];

  let bestBlob: Blob | null = null;
  let bestMimeType = "";

  for (const scale of scaleSteps) {
    const { width, height } = getTargetDimensions(
      image.naturalWidth,
      image.naturalHeight,
      options.maxWidth,
      options.maxHeight,
      scale,
    );
    const swapAxis = orientation >= 5 && orientation <= 8;
    const canvas = document.createElement("canvas");
    canvas.width = swapAxis ? height : width;
    canvas.height = swapAxis ? width : height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas is not available");
    }

    drawImageWithOrientation(ctx, image, width, height, orientation);

    for (const mimeType of mimeCandidates) {
      for (const quality of qualitySteps) {
        const blob = await canvasToBlob(canvas, mimeType, quality);
        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob;
          bestMimeType = mimeType;
        }
        if (blob.size <= options.targetMaxBytes) {
          const extension = mimeType === "image/webp" ? ".webp" : ".jpg";
          return new File([blob], replaceExtension(file.name, extension), {
            type: mimeType,
            lastModified: file.lastModified,
          });
        }
      }
    }
  }

  if (bestBlob && bestBlob.size <= options.targetMaxBytes) {
    const extension = bestMimeType === "image/webp" ? ".webp" : ".jpg";
    return new File([bestBlob], replaceExtension(file.name, extension), {
      type: bestMimeType,
      lastModified: file.lastModified,
    });
  }

  throw new Error(`Image could not be compressed below ${formatBytes(options.targetMaxBytes)}`);
}

export function formatBytes(bytes: number): string {
  if (bytes >= MEGABYTE) {
    return `${(bytes / MEGABYTE).toFixed(bytes >= 10 * MEGABYTE ? 0 : 1)} MB`;
  }
  if (bytes >= KILOBYTE) {
    return `${Math.round(bytes / KILOBYTE)} KB`;
  }
  return `${bytes} B`;
}

export function getAttachmentDisplayName(attachment: AttachmentDescriptor): string {
  const preferredName = attachment.originalName?.trim();
  if (preferredName) {
    return preferredName;
  }
  const rawValue = attachment.path || attachment.url || "";
  const normalized = rawValue.split("?")[0].replace(/\\/g, "/");
  const lastSegment = normalized.split("/").filter(Boolean).pop();
  return lastSegment || `File #${attachment.attachmentId ?? "unknown"}`;
}

export function getAttachmentPreviewKind(attachment: AttachmentDescriptor): AttachmentPreviewKind {
  const effectiveMimeType = getEffectiveMimeTypeFromParts(
    attachment.mimeType,
    attachment.path || attachment.url || "",
  );
  const extension = getFileExtension(attachment.path || attachment.url || "");

  if (IMAGE_MIME_TYPES.has(effectiveMimeType)) {
    return "image";
  }

  if (VIDEO_MIME_TYPES.has(effectiveMimeType)) {
    return "video";
  }

  if (effectiveMimeType === "application/pdf" || extension === ".pdf") {
    return "pdf";
  }

  if (TEXT_ATTACHMENT_MIME_TYPES.has(effectiveMimeType) || TEXT_ATTACHMENT_EXTENSIONS.has(extension)) {
    return "text";
  }

  if (effectiveMimeType || extension) {
    return "file";
  }

  return "unsupported";
}

export function isAttachmentPreviewable(attachment: AttachmentDescriptor): boolean {
  const previewKind = getAttachmentPreviewKind(attachment);
  return previewKind === "image" || previewKind === "video" || previewKind === "pdf" || previewKind === "text";
}

export function getAttachmentKind(file: File): "image" | "video" | "file" | "unsupported" {
  const mimeType = getEffectiveMimeType(file);
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return "image";
  }
  if (VIDEO_MIME_TYPES.has(mimeType)) {
    return "video";
  }
  if (NON_MEDIA_MIME_TYPES.has(mimeType)) {
    return "file";
  }
  return "unsupported";
}

export async function prepareProfileImageUpload(file: File): Promise<File> {
  if (getAttachmentKind(file) !== "image") {
    throw new Error("Only JPEG, PNG, or WEBP images are supported.");
  }

  return compressImageFile(file, {
    maxWidth: 1024,
    maxHeight: 1024,
    targetMaxBytes: PROFILE_IMAGE_MAX_BYTES,
  });
}

export async function prepareAttachmentUpload(file: File): Promise<File> {
  const kind = getAttachmentKind(file);

  if (kind === "unsupported") {
    throw new Error("Supported files: images, MP4/WEBM/MOV videos, TXT/LOG/MD, CSV, JSON, PDF, ZIP.");
  }

  if (kind === "image") {
    return compressImageFile(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      targetMaxBytes: ATTACHMENT_MAX_FILE_BYTES,
    });
  }

  if (kind === "video") {
    if (file.size > ATTACHMENT_MAX_VIDEO_BYTES) {
      throw new Error(`Videos must be at most ${formatBytes(ATTACHMENT_MAX_VIDEO_BYTES)}.`);
    }
    return file;
  }

  if (file.size > ATTACHMENT_MAX_FILE_BYTES) {
    throw new Error(`Files must be at most ${formatBytes(ATTACHMENT_MAX_FILE_BYTES)}.`);
  }
  return file;
}
