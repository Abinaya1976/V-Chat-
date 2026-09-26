require('dotenv').config();
const minioClient = require('./config/minio');

async function testMinio() {
  const bucketName = process.env.MINIO_BUCKET || 'vchat-files';
  
  try {
    console.log(`Attempting to connect to MinIO at ${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}...`);
    
    // Check if the bucket exists
    const exists = await minioClient.bucketExists(bucketName);
    
    if (exists) {
      console.log(`✅ Success: Connected to MinIO and bucket '${bucketName}' exists.`);
    } else {
      console.log(`⚠️ Warning: Connected to MinIO, but bucket '${bucketName}' does NOT exist.`);
      console.log(`Please create it in the MinIO Console or using the MinIO CLI.`);
    }
  } catch (err) {
    console.error(`❌ Error connecting to MinIO:`, err.message);
  }
}

testMinio();
