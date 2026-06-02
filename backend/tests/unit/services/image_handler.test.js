jest.mock('../../../src/db', () => ({
  getValidToken: jest.fn(),
  insertPictureToDb: jest.fn()
}));

jest.mock('../../../src/services/s3Service', () => ({
  uploadToCloud: jest.fn()
}));

jest.mock('../../../src/lib/oneMap', () => ({
  reverseGeocode: jest.fn()
}));

jest.mock('exifr', () => ({
  parse: jest.fn()
}));

jest.mock('heic-convert', () => jest.fn());

const db = require('../../../src/db');
const s3Service = require('../../../src/services/s3Service');
const oneMap = require('../../../src/lib/oneMap');
const exifr = require('exifr');
const heicConvert = require('heic-convert');
const { ValidationError, PayloadTooLargeError } = require('../../../errors/CustomError');
const { processImageUpload } = require('../../../src/services/image_handler');

const connection = {};
const validFile = { buffer: Buffer.alloc(100), mimetype: 'image/jpeg', originalname: 'test.jpg' };

describe('image_handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    exifr.parse.mockResolvedValue(null);
    db.insertPictureToDb.mockResolvedValue({ pictureKey: 'k1.jpg', pictureId: 1 });
    s3Service.uploadToCloud.mockResolvedValue(undefined);
  });

  describe('validateFile (via processImageUpload)', () => {
    test('missing file: rejects with ValidationError', async () => {
      await expect(processImageUpload(connection, null, 0)).rejects.toThrow(ValidationError);
    });

    test('missing buffer: rejects with ValidationError', async () => {
      await expect(processImageUpload(connection, { mimetype: 'image/jpeg' }, 0)).rejects.toThrow(ValidationError);
    });

    test('non-image mimetype: rejects with ValidationError', async () => {
      const file = { buffer: Buffer.alloc(10), mimetype: 'text/plain', originalname: 'a.txt' };
      await expect(processImageUpload(connection, file, 0)).rejects.toThrow(ValidationError);
    });

    test('file over 10 MB: rejects with PayloadTooLargeError', async () => {
      const file = { buffer: Buffer.alloc(10 * 1024 * 1024 + 1), mimetype: 'image/jpeg', originalname: 'big.jpg' };
      await expect(processImageUpload(connection, file, 0)).rejects.toThrow(PayloadTooLargeError);
    });
  });

  describe('processImageUpload', () => {
    test('EXIF parse fails: continues with null coords, does not throw', async () => {
      exifr.parse.mockRejectedValue(new Error('bad exif'));

      const result = await processImageUpload(connection, validFile, 0);

      expect(db.insertPictureToDb).toHaveBeenCalledWith(
        connection,
        expect.objectContaining({ latitude: null, longitude: null }),
        '.jpg'
      );
      expect(result).toEqual({ pictureKey: 'k1.jpg', pictureId: 1 });
    });

    test('EXIF returns coords: reverseGeocode called with lat/lng', async () => {
      exifr.parse.mockResolvedValue({ latitude: 1.3, longitude: 103.8, DateTimeOriginal: new Date() });
      db.getValidToken.mockResolvedValue({ access_token: 'tok' });
      oneMap.reverseGeocode.mockResolvedValue(14);

      await processImageUpload(connection, validFile, 0);

      expect(oneMap.reverseGeocode).toHaveBeenCalledWith('tok', 1.3, 103.8);
      expect(db.insertPictureToDb).toHaveBeenCalledWith(
        connection,
        expect.objectContaining({ latitude: 1.3, longitude: 103.8, districtNo: 14 }),
        '.jpg'
      );
    });

    test('HEIC by extension: heicConvert called, uploaded as JPEG', async () => {
      const jpgBuffer = Buffer.from('jpg-data');
      heicConvert.mockResolvedValue(jpgBuffer);
      const heicFile = { buffer: Buffer.alloc(100), mimetype: 'image/heic', originalname: 'photo.heic' };

      await processImageUpload(connection, heicFile, 0);

      expect(heicConvert).toHaveBeenCalledWith({ buffer: heicFile.buffer, format: 'JPEG' });
      expect(db.insertPictureToDb).toHaveBeenCalledWith(connection, expect.any(Object), '.jpg');
      expect(s3Service.uploadToCloud).toHaveBeenCalledWith(
        expect.objectContaining({ mimetype: 'image/jpeg' })
      );
    });

    test('HEIC by mimetype: heicConvert called', async () => {
      heicConvert.mockResolvedValue(Buffer.from('jpg-data'));
      const heicFile = { buffer: Buffer.alloc(100), mimetype: 'image/heic', originalname: 'photo.jpg' };

      await processImageUpload(connection, heicFile, 0);

      expect(heicConvert).toHaveBeenCalled();
    });

    test('non-HEIC: heicConvert not called', async () => {
      await processImageUpload(connection, validFile, 0);
      expect(heicConvert).not.toHaveBeenCalled();
    });

    test('S3 upload fails: error is re-thrown', async () => {
      s3Service.uploadToCloud.mockRejectedValue(new Error('upload failed'));
      await expect(processImageUpload(connection, validFile, 0)).rejects.toThrow('upload failed');
    });

    test('success: returns pictureKey and pictureId', async () => {
      db.insertPictureToDb.mockResolvedValue({ pictureKey: 'gallery/k99.jpg', pictureId: 99 });

      const result = await processImageUpload(connection, validFile, 1);

      expect(result).toEqual({ pictureKey: 'gallery/k99.jpg', pictureId: 99 });
    });
  });
});
