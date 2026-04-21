/**
 * OneMap SG API - authentication and reverse geocoding.
 */
const axios = require('axios');
const { postNumberToDistrictNo } = require('./postalData.js');

/**
 * Requests a new authentication token from the OneMap API.
 * @returns {Promise<{access_token: string, expiry_timestamp: number}>}
 */
async function requestOneMapToken() {
  const response = await axios.post(
    'https://www.onemap.gov.sg/api/auth/post/getToken',
    {
      email: process.env.ONEMAP_API_EMAIL,
      password: process.env.ONEMAP_API_PASSWORD
    }
  );
  return response.data;
}

/**
 * Converts GPS coordinates to district number via OneMap reverse geocoding.
 * @param {string} accessToken - OneMap API access token
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<number>} District number
 */
async function reverseGeocode(accessToken, latitude, longitude) {
  if (!latitude || !longitude) {
    throw new Error('Error reverseGeocoding: Null value');
  }

  const requestURL = `https://www.onemap.gov.sg/api/public/revgeocode?location=${latitude},${longitude}&buffer=100&addressType=All&otherFeatures=N`;
  const response = await axios.get(requestURL, {
    headers: { Authorization: accessToken }
  });

  const postcode = response.data.GeocodeInfo[0].POSTALCODE;
  return postNumberToDistrictNo[postcode.substring(0, 2)];
}

module.exports = {
  requestOneMapToken,
  reverseGeocode
};
