jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

jest.mock('../../../src/lib/postalData.js', () => ({
  postNumberToDistrictNo: { '01': 1, '10': 10 }
}));

const axios = require('axios');
const { reverseGeocode } = require('../../../src/lib/oneMap');

describe('oneMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reverseGeocode', () => {
    test('null latitude: throws error', async () => {
      await expect(reverseGeocode('tok', null, 103.8)).rejects.toThrow('Error reverseGeocoding: Null value');
    });

    test('null longitude: throws error', async () => {
      await expect(reverseGeocode('tok', 1.3, null)).rejects.toThrow('Error reverseGeocoding: Null value');
    });

    test('success: calls axios.get with correct URL and returns district number', async () => {
      axios.get.mockResolvedValue({
        data: { GeocodeInfo: [{ POSTALCODE: '018935' }] }
      });

      const result = await reverseGeocode('my-token', 1.3, 103.8);

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('1.3,103.8'),
        expect.objectContaining({ headers: { Authorization: 'my-token' } })
      );
      expect(result).toBe(1);
    });

    test('API error: propagates the error', async () => {
      axios.get.mockRejectedValue(new Error('network error'));
      await expect(reverseGeocode('tok', 1.3, 103.8)).rejects.toThrow('network error');
    });
  });
});
