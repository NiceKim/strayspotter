jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn().mockResolvedValue({});
  const S3Client = jest.fn().mockImplementation(() => ({ send: mockSend }));
  S3Client.__mockSend = mockSend;
  return {
    S3Client,
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    ListObjectsV2Command: jest.fn()
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn()
}));

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3Service = require('../../../src/services/s3Service');

// mockSend is shared across all S3Client instances — access via the attached property
const mockSend = S3Client.__mockSend;

describe('s3Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  describe('uploadToCloud', () => {
    test('calls PutObjectCommand with correct key and sends it', async () => {
      const file = { buffer: Buffer.from('data'), mimetype: 'image/jpeg', uniquename: 'k1.jpg' };

      await s3Service.uploadToCloud(file);

      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Key: 'gallery/k1.jpg',
        Body: file.buffer,
        ContentType: 'image/jpeg'
      }));
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteFromCloud', () => {
    test('calls DeleteObjectCommand with correct key and sends it', async () => {
      await s3Service.deleteFromCloud('k1.jpg');

      expect(DeleteObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Key: 'gallery/k1.jpg'
      }));
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPresignedUrl', () => {
    test('calls getSignedUrl with GetObjectCommand for correct key and returns URL', async () => {
      getSignedUrl.mockResolvedValue('https://presigned.url/k1.jpg');

      const url = await s3Service.getPresignedUrl('k1.jpg');

      expect(GetObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Key: 'gallery/k1.jpg'
      }));
      expect(getSignedUrl).toHaveBeenCalledTimes(1);
      expect(url).toBe('https://presigned.url/k1.jpg');
    });
  });
});
