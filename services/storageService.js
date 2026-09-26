const crypto = require('crypto');
const path = require('path');
const minioClient = require('../config/minio');

const bucketName = process.env.MINIO_BUCKET || 'vchat-files';

/**
 * Generate a unique object key based on organization ID and original filename
 */
function generateObjectKey(organizationId, originalFilename) {
  const ext = path.extname(originalFilename);
  const baseName = path.basename(originalFilename, ext);
  // Add 8 random bytes to make the filename practically unique to prevent overwriting
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const uniqueFileName = `${baseName}-${uniqueId}${ext}`;
  return `organizations/${organizationId}/files/${uniqueFileName}`;
}

/**
 * Upload a file to MinIO
 * @param {Buffer} fileBuffer - The file data
 * @param {string} originalFilename - Original name of the file
 * @param {string} mimeType - MIME type of the file
 * @param {string} organizationId - The organization ID
 * @returns {Promise<Object>} - The uploaded file details
 */
async function uploadFile(fileBuffer, originalFilename, mimeType, organizationId) {
  try {
    const objectKey = generateObjectKey(organizationId, originalFilename);
    const metaData = {
      'Content-Type': mimeType,
    };
    
    // Upload the file data to the MinIO bucket
    await minioClient.putObject(bucketName, objectKey, fileBuffer, fileBuffer.length, metaData);
    
    return {
      success: true,
      bucket: bucketName,
      key: objectKey,
      originalFilename,
      mimeType,
      size: fileBuffer.length
    };
  } catch (error) {
    console.error('StorageService - uploadFile error:', error);
    throw new Error(`Failed to upload file to storage: ${error.message}`);
  }
}

/**
 * Check if a file exists in MinIO
 * @param {string} objectKey - The exact path/key of the file
 * @returns {Promise<boolean>}
 */
async function fileExists(objectKey) {
  try {
    // statObject throws an error if the object does not exist
    await minioClient.statObject(bucketName, objectKey);
    return true;
  } catch (error) {
    // Treat "NotFound" or "NoSuchKey" as a normal false response
    if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
      return false;
    }
    console.error('StorageService - fileExists error:', error);
    throw new Error(`Failed to check if file exists: ${error.message}`);
  }
}

/**
 * Generate a presigned URL to download a file securely
 * @param {string} objectKey - The exact path/key of the file
 * @param {number} expiryInSeconds - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>}
 */
async function generateDownloadUrl(objectKey, expiryInSeconds = 3600) {
  try {
    const url = await minioClient.presignedGetObject(bucketName, objectKey, expiryInSeconds);
    return url;
  } catch (error) {
    console.error('StorageService - generateDownloadUrl error:', error);
    throw new Error(`Failed to generate download URL: ${error.message}`);
  }
}

/**
 * Delete a file from MinIO
 * @param {string} objectKey - The exact path/key of the file
 * @returns {Promise<boolean>}
 */
async function deleteFile(objectKey) {
  try {
    await minioClient.removeObject(bucketName, objectKey);
    return true;
  } catch (error) {
    console.error('StorageService - deleteFile error:', error);
    throw new Error(`Failed to delete file from storage: ${error.message}`);
  }
}

module.exports = {
  uploadFile,
  fileExists,
  generateDownloadUrl,
  deleteFile
};
