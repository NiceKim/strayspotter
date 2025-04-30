const axios = require('axios');
const db = require("../db.js");

jest.mock('axios');
jest.spyOn(db, 'reverseGeocoding').mockImplementation(() => {});
jest.spyOn(db, 'createDBConnection').mockImplementation(() => {});

describe('GPSToAddress', () => {
  const mockLatitude = 1.3521;
  const mockLongitude = 103.8198;
  const mockPostcode = '123456';
  const mockDistrictData = {
    postcode: mockPostcode,
    districtNo: 1,
    districtName: 'Central District',
  };
  const mockConnection = { end: jest.fn() };

  beforeEach(() => {
    // Mock the reverseGeocoding function to return the mock postcode
    db.reverseGeocoding.mockResolvedValue(mockPostcode);
    db.createDBConnection.mockReturnValue(mockConnection);
  });

  // initialize the data
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return postcode, districtNo, and districtName when reverseGeocoding is successful', async () => {
    const result = await db.GPSToAddress(mockLatitude, mockLongitude);

    // Test that reverseGeocoding was called with the correct parameters
    expect(db.reverseGeocoding).toHaveBeenCalledWith(mockConnection, mockLatitude, mockLongitude);
    // Test that the result is as expected
    expect(result).toEqual({
      postcode: mockPostcode,
      districtNo: mockDistrictData.districtNo,
      districtName: mockDistrictData.districtName,
    });
    // Test that connection.end() was called
    expect(mockConnection.end).toHaveBeenCalled()
  });

})