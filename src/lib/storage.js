/**
 * src/lib/storage.js
 * Universal Cloudinary Storage Provider for Mohalla Store
 *
 * Implements direct, unsigned browser uploads to Cloudinary:
 *   Endpoint: https://api.cloudinary.com/v1_1/<CLOUD_NAME>/image/upload
 *   Preset: mohalla_store
 *   Folder: mohalla-store (configured in preset)
 *
 * Preserves the storage provider interface (uploadImage, saveImage, deleteImage, getImageUrl).
 */

export const CLOUDINARY_PRESET = "mohalla_store";

/**
 * Retrieves the configured Cloudinary Cloud Name from environment variables.
 * @returns {string} Cloud Name
 */
export function getCloudinaryCloudName() {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) {
    return String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME).trim();
  }
  return "";
}

/**
 * Checks whether Cloudinary is configured.
 * @returns {boolean}
 */
export function isCloudinaryConfigured() {
  return Boolean(getCloudinaryCloudName());
}

/**
 * Uploads an image (File, Blob, or base64 Data URL) directly to Cloudinary using the unsigned preset.
 *
 * @param {File|Blob|string} file - The image File, Blob, or Data URL to upload
 * @param {object} [options] - Optional upload parameters
 * @returns {Promise<string>} The Cloudinary secure_url
 */
export async function uploadImage(file, options = {}) {
  if (!file) {
    throw new Error("No image file provided for upload.");
  }

  const cloudName = options.cloudName || getCloudinaryCloudName();
  if (!cloudName) {
    throw new Error(
      "Cloudinary Cloud Name is not configured. Please set VITE_CLOUDINARY_CLOUD_NAME in your .env file."
    );
  }

  const preset = options.preset || CLOUDINARY_PRESET;
  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", preset);

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      errorData.error?.message ||
      `Cloudinary upload failed (HTTP ${res.status}: ${res.statusText})`;
    console.error("[Storage] Cloudinary upload error:", message);
    throw new Error(message);
  }

  const data = await res.json();
  if (!data.secure_url) {
    throw new Error("Cloudinary response missing secure_url.");
  }

  return data.secure_url;
}

/**
 * Alias for uploadImage to maintain StorageProvider contract.
 */
export const saveImage = uploadImage;

/**
 * Client-safe deletion handler.
 * Unsigned upload presets do NOT permit client-side deletion (which requires an API Secret).
 * Preserves existing application behavior by acknowledging deletion and logging.
 *
 * @param {string} imageUrl - The image URL to delete
 * @returns {Promise<boolean>}
 */
export async function deleteImage(imageUrl) {
  // In Cloudinary unsigned architecture, client cannot delete assets directly.
  // The document reference in Firestore is removed by the application.
  return true;
}

/**
 * Returns the public image URL.
 * Passes through https:// Cloudinary URLs, or resolves local fallback URLs.
 *
 * @param {string} url - Image reference
 * @returns {string} Fully qualified image URL
 */
export function getImageUrl(url = "") {
  return url;
}

/**
 * StorageProvider class implementation providing the object-oriented interface.
 */
export class CloudinaryStorageProvider {
  constructor(cloudName) {
    this.cloudName = cloudName || getCloudinaryCloudName();
    this.preset = CLOUDINARY_PRESET;
  }

  async upload(file, options) {
    return uploadImage(file, { cloudName: this.cloudName, ...options });
  }

  async save(file, options) {
    return this.upload(file, options);
  }

  async delete(imageUrl) {
    return deleteImage(imageUrl);
  }

  getUrl(imageUrl) {
    return getImageUrl(imageUrl);
  }
}

export const storageProvider = new CloudinaryStorageProvider();
export default storageProvider;
