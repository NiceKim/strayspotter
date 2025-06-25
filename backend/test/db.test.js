require('dotenv').config();
console.log('testing with', process.env.DB_NAME, "db");

const { pool, insertDataToDb, fetchByID, getCurrentPictureCount, fetchRecentPhotoID , reverseGeocode, deleteByID, fetchGPSByID} = require('../src/db.js');
const { CustomError } = require('../errors/CustomError')

const sampleData = {
  latitude : 1.31576,
  longitude : 103.914,
  date : '2024-01-01',
  postcode : '123456', 
  districtNo : '12',
  districtName : 'TestDistrict',
  catStatus : 'happy'
};

async function selectFunction(insertId) {
  const sql = 'SELECT * FROM pictures WHERE id = ?';
  const [result] = await pool.query(sql, [insertId]);
  return result;
}

async function clearTestDb() {
  const sql = 'DELETE FROM pictures'
  const [result] = await pool.query(sql);
  return result;
}

describe('insertDatatoDb', () => {
  const emptyData = {};

  afterAll(async () => {
    await clearTestDb();
  });

  it('should return insertID after inserting, and verify DB insert', async () => {
    const result = await insertDataToDb(pool, sampleData);
    const check = await selectFunction(result);

    expect(typeof result).toBe('number');
    expect(check.length).toBe(1);
  });

  it('should handle empty data', async () => {
    const result = await insertDataToDb(pool, emptyData);
    const check = await selectFunction(result);
    expect(check[0].date_taken).toBeInstanceOf(Date);
    expect(check[0].latitude).toBe(null);
    expect(check[0].longitude).toBe(null);
    expect(check[0].cat_status).toBe(null);
  });
})

describe('fetchByID', () => {
  afterAll(async () => {
    await clearTestDb();
  });

  it('should return object with valid information', async () => {
    const testID = await insertDataToDb(pool, sampleData);
    const {latitude, longitude} = await fetchByID(pool, testID);
    expect(latitude).toBe(sampleData.latitude);
    expect(longitude).toBe(sampleData.longitude);
  })

  it('should throw error with invalid ID', async () => {
    const invalidID = "?"
    await expect(fetchByID(pool, invalidID)).rejects.toThrowError('No data found for the given ID');
  })
})

describe('getCurrentPictureCount', () => {
  let mockData = {
    date: new Date(),
    districtNo: 12
  };
  beforeAll(async () => {
    await insertDataToDb(pool, mockData);
    await insertDataToDb(pool, mockData);
    mockData.districtNo = 11;
    await insertDataToDb(pool, mockData);
  });
  afterAll(async () => {
    await clearTestDb();
  });

  it('should return counts for all time periods for a specific district', async () => {
    const result = await getCurrentPictureCount(pool, 12);
    expect(result).toEqual({
      day: 2,
      week: 2,
      month: 2
    });
  });

  it('should return 0 for all periods for invalid district', async () => {
    const result = await getCurrentPictureCount(pool, -1);
    expect(result).toEqual({
      day: 0,
      week: 0,
      month: 0
    });
  });

  it('should return total counts for all districts if district is 0', async () => {
    const result = await getCurrentPictureCount(pool, 0);
    expect(result).toEqual({
      day: 3,
      week: 3,
      month: 3
    });
  });
})

describe('fetchRecentPhotoID', () => {
  const insertIds = [];

  beforeAll(async () => {
    for (let i=0; i<5; i++) {
      let insertId = await insertDataToDb(pool, sampleData);
      insertIds.push(insertId);
    }
  })
  afterAll(async () => {
    await clearTestDb();
  })

  it('should return 3 ids with parameter 3', async () => {
    const result = await fetchRecentPhotoID(pool, 3);
    expect(result.length).toBe(3);
  })

  it('should return max num ids with parameter bigger than length', async () => {
    const result = await fetchRecentPhotoID(pool, 10);
    expect(result.length).toBe(5);
  })

  it('should return 4, default number of ids with no parameter', async () => {
    const result = await fetchRecentPhotoID(pool);
    expect(result.length).toBe(4);
  })

  it('should skip recent photos based on the parameter', async () => {
    const result = await fetchRecentPhotoID(pool, 2, 1);
    expect(result[0].id).toBe(insertIds[3]);
    expect(result[1].id).toBe(insertIds[2]);
  })

})

describe('Reverse Geocode', () => {
  it('should convert GPS coordinates to the correct address', async () => {
    result = await reverseGeocode(pool, sampleData.latitude, sampleData.longitude);
    expect(result.districtNo).toBe(15);
    expect(result.postcode).toBe(428074);
    expect(result.districtName).toBe('Katong, Joo Chiat, Amber Road');
  })
});

describe('deleteByID function', () => {
  afterAll(async () => {
    await clearTestDb();
  })

  it('should delete the record by ID and return the number of affected rows', async () => {
    const insertedID = await insertDataToDb(pool, sampleData);
    const result = await deleteByID(pool, insertedID);
    expect(result).toBe(1);
  });
});

describe('fetchGPSByID',  () => {
  afterAll(async () => {
    await clearTestDb();
  })

  it('should throw error if id is missing', async () => {
    await expect(fetchGPSByID(pool, null)).rejects.toThrow(CustomError)
    await expect(fetchGPSByID(pool, undefined)).rejects.toThrow("ID parameter missing")
  })
  it('should throw error if id is not a number or numeric string', async () => {
    await expect(fetchGPSByID(pool, 'abc')).rejects.toThrow("ID must be a number")
    await expect(fetchGPSByID(pool, {})).rejects.toThrow("ID must be a number")
  })
  it('should throw error if no record found', async () => {
    await expect(fetchGPSByID(pool, -1)).rejects.toThrow("Invalid ID")
  })
  it('should return gps data when record found', async () => {
    const id = await insertDataToDb(pool, sampleData);
    const result = await fetchGPSByID(pool, id);
    expect(result).toEqual({
      latitude: sampleData.latitude,
      longitude: sampleData.longitude
    });
  })

})

afterAll(async () => {
  await pool.end();
});