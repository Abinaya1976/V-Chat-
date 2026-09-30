const Minio = require('minio');
require('dotenv').config();

const minioConfig = {
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
};

if (process.env.MINIO_PORT) {
  minioConfig.port = parseInt(process.env.MINIO_PORT, 10);
} else if (!process.env.MINIO_ENDPOINT || process.env.MINIO_ENDPOINT === 'localhost' || process.env.MINIO_ENDPOINT === '127.0.0.1') {
  minioConfig.port = 9000;
}

const minioClient = new Minio.Client(minioConfig);

module.exports = minioClient;
