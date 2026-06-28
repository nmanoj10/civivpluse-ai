import { imageKit, isImageKitConfigured } from '../../config/imagekit';
import fs from 'fs';
import path from 'path';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';

// Allowed MIME types for civic issue uploads
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// Size limits (bytes)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 25 * 1024 * 1024; // 25 MB (ImageKit free tier limit)

export interface ImageKitUploadResult {
  fileId: string;
  url: string;
  thumbnailUrl: string;
  fileType: string;
  size: number;
  width?: number;
  height?: number;
  uploadedAt: Date;
  name: string;
}

/**
 * Validate a file's MIME type and size before uploading.
 */
const validateFile = (mimetype: string, size: number): void => {
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    throw new ApiError(400, `Unsupported file type: ${mimetype}. Allowed: images (jpeg, png, webp, gif) and videos (mp4, mov)`);
  }
  const isVideo = ALLOWED_VIDEO_TYPES.includes(mimetype);
  const limit = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (size > limit) {
    const limitMB = limit / (1024 * 1024);
    throw new ApiError(400, `File too large. Maximum size is ${limitMB}MB for ${isVideo ? 'videos' : 'images'}`);
  }
};

/**
 * Safely delete a local temp file (non-throwing).
 */
const cleanupTempFile = async (filePath: string): Promise<void> => {
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // Ignore — temp file may already be deleted or never existed
  }
};

/**
 * Upload a Multer file to ImageKit.
 *
 * @param file        Multer file object (path, originalname, mimetype, size)
 * @param folder      ImageKit folder (e.g. 'civicpulse/issues')
 * @param tags        Array of string tags for ImageKit metadata
 * @returns           Structured upload result with CDN URL and metadata
 */
export const uploadToImageKit = async (
  file: { path: string; originalname: string; mimetype: string; size: number },
  folder: string = 'civicpulse/issues',
  tags: string[] = []
): Promise<ImageKitUploadResult> => {
  if (!isImageKitConfigured()) {
    throw new ApiError(500, 'ImageKit is not configured. Check server/.env for IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT.');
  }

  // Validate before reading file
  validateFile(file.mimetype, file.size);

  logger.info('ImageKit', 'Upload Started', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    sizeBytes: file.size,
    folder
  });

  let fileData: Buffer;
  try {
    fileData = await fs.promises.readFile(file.path);
  } catch (err: any) {
    await cleanupTempFile(file.path);
    throw new ApiError(500, `Failed to read temporary file: ${err.message}`);
  }

  // Generate a clean filename: timestamp-originalname (sanitized)
  const sanitizedName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueFileName = `${Date.now()}-${sanitizedName}`;

  try {
    const uploadResponse = await imageKit.upload({
      file: fileData,
      fileName: uniqueFileName,
      folder,
      tags,
      useUniqueFileName: true,
    });

    // Always clean up the local temp file after successful upload
    await cleanupTempFile(file.path);

    const result: ImageKitUploadResult = {
      fileId: uploadResponse.fileId,
      url: uploadResponse.url,
      thumbnailUrl: uploadResponse.thumbnailUrl || uploadResponse.url,
      fileType: uploadResponse.fileType || file.mimetype,
      size: uploadResponse.size || file.size,
      width: uploadResponse.width,
      height: uploadResponse.height,
      uploadedAt: new Date(),
      name: uploadResponse.name
    };

    logger.success('ImageKit', 'Upload Success', {
      fileId: result.fileId,
      url: result.url,
      folder
    });

    return result;
  } catch (err: any) {
    // Always clean up even on failure
    await cleanupTempFile(file.path);

    logger.error('ImageKit', 'Upload Failed', {
      originalname: file.originalname,
      error: err?.message || 'Unknown error'
    });

    // Pass through ApiErrors from validation
    if (err instanceof ApiError) throw err;

    throw new ApiError(500, `Failed to upload media to ImageKit: ${err?.message || 'Unknown error'}`);
  }
};

/**
 * Upload multiple Multer files to ImageKit with rollback on partial failure.
 * If any upload fails, attempts to delete already-uploaded files from ImageKit.
 *
 * @param files   Array of Multer file objects
 * @param folder  ImageKit folder
 * @param tags    Tags to apply to all uploads
 * @returns       Array of upload results
 */
export const uploadMultipleToImageKit = async (
  files: { path: string; originalname: string; mimetype: string; size: number }[],
  folder: string = 'civicpulse/issues',
  tags: string[] = []
): Promise<ImageKitUploadResult[]> => {
  const results: ImageKitUploadResult[] = [];
  const uploadedFileIds: string[] = [];

  for (const file of files) {
    try {
      const result = await uploadToImageKit(file, folder, tags);
      results.push(result);
      uploadedFileIds.push(result.fileId);
    } catch (err: any) {
      // Rollback: delete already-uploaded files from ImageKit
      logger.warn('ImageKit', `Upload failed for ${file.originalname}, rolling back ${uploadedFileIds.length} already-uploaded file(s)`);

      for (const fileId of uploadedFileIds) {
        try {
          await imageKit.deleteFile(fileId);
          logger.info('ImageKit', `Rollback: deleted file ${fileId}`);
        } catch (deleteErr: any) {
          logger.error('ImageKit', `Rollback failed for fileId ${fileId}`, { error: deleteErr?.message });
        }
      }

      // Clean up remaining local temp files
      for (const remainingFile of files.slice(results.length)) {
        await cleanupTempFile(remainingFile.path);
      }

      throw err instanceof ApiError ? err : new ApiError(500, `Media upload failed: ${err?.message}`);
    }
  }

  return results;
};
