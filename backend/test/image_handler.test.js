const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
process.env.IS_TEST = true;
console.log('testing with', process.env.IS_TEST ? 'test' : 'real' , "image_handler");

const { processImageUpload } = require('../src/image_handler');
const db = require('../src/db');
const helper = require('../src/helper');
const exifr = require('exifr');


jest.mock('../src/db', () => {
    const originalModule = jest.requireActual('../src/db');
    return {
        ...originalModule,
        insertDataToDb: jest.fn(),
        reverseGeocode: jest.fn()
    }
});

jest.mock('../src/helper', () => ({
  uploadToCloud: jest.fn()
}));

jest.mock('exifr');

async function clearTestDb(connection) {
  const sql = 'DELETE FROM pictures'
  const [result] = await connection.query(sql);
  return result;
}

const sampleFile = {
    originalname: 'test.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake image data'),
    size: 1024,
    path: '/tmp/test.jpg',
    filename: 'test-filename.jpg'
};

describe('processImageUpload', () => {
    let connection;
  
    const mockID = 1;
    const mockAddress = {
        postcode: 123,
        districtName: "test",
        districtNo:12,
    };
    const mockMetadata = {
        latitude : 1,
        longitude : 2,
        DateTimeOriginal : new Date()
    };
    
    const mockData = {
        latitude : mockMetadata.latitude,
        longitude : mockMetadata.longitude,
        date : mockMetadata.DateTimeOriginal,
        postcode : mockAddress.postcode, 
        districtNo : mockAddress.districtNo,
        districtName : mockAddress.districtName,
        catStatus : "happy"
    };

    beforeAll(() => {
        connection = db.pool;
    });

    afterAll(async () => {
        await clearTestDb(connection);
        await db.pool.end();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should handle picture upload with EXIF data correctly', async () => {
        db.insertDataToDb.mockResolvedValue(mockID);
        db.reverseGeocode.mockResolvedValue(mockAddress);
        exifr.parse.mockResolvedValue(mockMetadata);
        
        expect(await processImageUpload(connection, sampleFile, "happy")).toBe(mockID);
        expect(exifr.parse).toHaveBeenCalledWith(sampleFile.buffer);
        expect(db.insertDataToDb).toHaveBeenCalledWith(connection, mockData);
        expect(db.reverseGeocode).toHaveBeenCalledWith(connection, mockMetadata.latitude, mockMetadata.longitude);
        expect(helper.uploadToCloud).toHaveBeenCalledWith(
            expect.objectContaining({
                buffer: expect.any(Buffer),
                mimetype: 'image/jpeg',
                originalname: 'test.jpg',
                uniquename: 'k' + mockID + '.jpg',
            })
        );
    });

     it('should handle picture upload without EXIF data correctly', async () => {
        db.insertDataToDb.mockResolvedValue(mockID);
        db.reverseGeocode.mockResolvedValue(mockAddress);
        exifr.parse.mockResolvedValue(null);
 
        expect(await processImageUpload(connection, sampleFile, "happy")).toBe(mockID);
        expect(exifr.parse).toHaveBeenCalledWith(sampleFile.buffer);
        expect(db.insertDataToDb).toHaveBeenCalledWith(connection, {
            latitude: null,
            longitude: null,
            date: expect.any(Date),
            postcode: null,
            districtNo: null,
            districtName: null,
            catStatus: "happy"
        });
        expect(db.reverseGeocode).toBeCalledTimes(0);
        expect(helper.uploadToCloud).toHaveBeenCalledWith(
            expect.objectContaining({
                buffer: expect.any(Buffer),
                mimetype: 'image/jpeg',
                originalname: 'test.jpg',
                uniquename: 'k' + mockID + '.jpg',
            })
        );
    })

    it('should throw error for invalid file format', async () => {
        db.insertDataToDb.mockResolvedValue(mockID);
        db.reverseGeocode.mockResolvedValue(mockAddress);
        exifr.parse.mockResolvedValue(mockMetadata);
        const invalidFile = {
            originalname: 'test.pdf',
            mimetype: 'application/pdf',
            buffer: Buffer.from('fake data'),
            size: 1024,
            path: '/tmp/test.pdf',
            filename: 'test-filename.pdf'
        };
        await expect(processImageUpload(connection, invalidFile, "happy")).rejects.toThrowError("Not an accepted Image format");
    });
})