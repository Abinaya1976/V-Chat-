require('dotenv').config();
const storageService = require('./services/storageService');
const minioClient = require('./config/minio');

async function runTests() {
  console.log('--- Starting Storage Service Tests ---');
  
  const bucketName = process.env.MINIO_BUCKET || 'vchat-files';
  
  // 1. Verify MinIO connection & bucket
  console.log(`\n[1] Checking MinIO connection for bucket: ${bucketName}...`);
  try {
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      console.log(`⚠️ Warning: Bucket '${bucketName}' does not exist. Tests will fail.`);
      console.log(`Please create it in the MinIO Console.`);
      return;
    } else {
      console.log(`✅ Success: Connected to MinIO and bucket '${bucketName}' exists.`);
    }
  } catch (error) {
    console.error(`❌ Connection Failed:`, error.message);
    return;
  }

  // Sample data for testing
  const dummyFileBuffer = Buffer.from('Hello, MinIO Storage Service test file data!', 'utf-8');
  const orgId = 'test-org-123';
  const filename = 'hello-world.txt';
  const mimeType = 'text/plain';
  
  let uploadedObjectKey = null;

  // 2. Test uploadFile
  console.log('\n[2] Testing file upload...');
  try {
    const uploadResult = await storageService.uploadFile(dummyFileBuffer, filename, mimeType, orgId);
    console.log('✅ File uploaded successfully:');
    console.log(uploadResult);
    uploadedObjectKey = uploadResult.key;
  } catch (error) {
    console.error('❌ Upload Failed:', error.message);
    return;
  }

  // 3. Test fileExists (Should be true)
  console.log(`\n[3] Testing file existence for key: ${uploadedObjectKey}...`);
  try {
    const exists = await storageService.fileExists(uploadedObjectKey);
    if (exists) {
      console.log('✅ File successfully verified to exist in MinIO.');
    } else {
      console.log('❌ Error: fileExists returned false, but file should exist.');
    }
  } catch (error) {
    console.error('❌ Check Existence Failed:', error.message);
  }

  // 4. Test generateDownloadUrl
  console.log(`\n[4] Testing presigned download URL generation...`);
  try {
    const url = await storageService.generateDownloadUrl(uploadedObjectKey, 60); // 60 seconds expiry
    console.log('✅ URL generated successfully:');
    console.log(url);
  } catch (error) {
    console.error('❌ URL Generation Failed:', error.message);
  }

  // 5. Test deleteFile
  console.log(`\n[5] Testing file deletion...`);
  try {
    await storageService.deleteFile(uploadedObjectKey);
    console.log('✅ Delete command sent successfully.');
  } catch (error) {
    console.error('❌ Delete Failed:', error.message);
  }

  // 6. Test fileExists (Should be false)
  console.log(`\n[6] Verifying file was deleted...`);
  try {
    const exists = await storageService.fileExists(uploadedObjectKey);
    if (!exists) {
      console.log('✅ File successfully confirmed as deleted.');
    } else {
      console.log('❌ Error: fileExists returned true, but file should have been deleted.');
    }
  } catch (error) {
    console.error('❌ Verification Failed:', error.message);
  }

  console.log('\n--- Storage Service Tests Completed ---');
}

runTests();
