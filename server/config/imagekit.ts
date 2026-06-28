import ImageKit from 'imagekit';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config({ path: './server/.env' });

// Trim whitespace to prevent subtle auth failures (e.g. trailing space in .env values)
const publicKey = process.env.IMAGEKIT_PUBLIC_KEY?.trim();
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT?.trim();

const configured = !!(publicKey && privateKey && urlEndpoint);

if (!configured) {
  logger.error('ImageKit', 'Configuration missing — IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT must all be set in server/.env');
} else {
  logger.success('ImageKit', 'Initialized successfully', { urlEndpoint });
}

/**
 * Returns true if all required ImageKit env vars are present and non-empty.
 * Use this before performing uploads to give clear error messages.
 */
export const isImageKitConfigured = (): boolean => configured;

export const imageKit = new ImageKit({
  publicKey: publicKey || '',
  privateKey: privateKey || '',
  urlEndpoint: urlEndpoint || ''
});
