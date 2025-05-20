const { createDbConnection, insertDataToDb, fetchByID, countPictures, fetchRecentPhotoID , reverseGeocode, deleteByID} = require('../db.js');
const mysql = require('mysql2');
require('dotenv').config();

const sampleData = {
  latitude : 1.31576,
  longitude : 103.914,
  date : '2024-01-01',
  postcode : '123456', 
  districtNo : '12',
  districtName : 'TestDistrict',
  catStatus : 'happy'
};

async function selectFunction(connection, insertId) {
  const sql = 'SELECT * FROM pictures WHERE id = ?';
  const [result] = await connection.promise().query(sql, [insertId]);
  return result;
}

async function clearTestDb(connection) {
  const sql = 'DELETE FROM pictures'
  const [result] = await connection.promise().query(sql);
  return result;
}

describe('insertDatatoDb', () => {
  const emptyData = {};

  let connection;
  beforeAll(() => {
    connection = createDbConnection(true);
  });
  afterAll(async () => {
    await clearTestDb(connection);
    connection.end();
  });

  it('should return insertID after inserting, and verify DB insert', async () => {
    const result = await insertDataToDb(connection, sampleData);
    const check = await selectFunction(connection, result);

    expect(typeof result).toBe('number');
    expect(check.length).toBe(1);
  });

  it('should handle empty data', async () => {
    const result = await insertDataToDb(connection, emptyData);
    const check = await selectFunction(connection, result);
    expect(check[0].date_taken).toBeInstanceOf(Date);
    expect(check[0].latitude).toBe(null);
    expect(check[0].longitude).toBe(null);
    expect(check[0].cat_status).toBe(null);
  });
})

describe('fetchByID', () => {
  let connection;
  beforeAll(() => {
    connection = createDbConnection(true);
  });
  afterAll(async () => {
    await clearTestDb(connection);
    connection.end();
  });

  it('should return object with valid information', async () => {
    const testID = await insertDataToDb(connection, sampleData);
    const {latitude, longitude} = await fetchByID(connection, testID);
    expect(latitude).toBe(sampleData.latitude);
    expect(longitude).toBe(sampleData.longitude);
  })

  it('should throw error with invalid ID', async () => {
    const invalidID = "?"
    await expect(fetchByID(connection, invalidID)).rejects.toThrowError('No data found for the given ID');
  })
})

describe('countPictures', () => {
  let mockData = {
    date: new Date(),
    districtNo: 12
  };
  let connection;
  beforeAll(async () => {
    connection = createDbConnection(true);
    await insertDataToDb(connection, mockData);
    await insertDataToDb(connection, mockData);
    mockData.districtNo = 11;
    await insertDataToDb(connection, mockData);
  });
  afterAll(async () => {
    await clearTestDb(connection);
    connection.end();
  });

  it('should return the number of pictures that is taken today', async () => {
    expect(await countPictures(connection, 12, "day")).toBe(2);
  })
  
  it('should return the number of pictures that is taken this week', async () => {
    expect(await countPictures(connection, 12, "week")).toBe(2);
  })
  
  it('should return the number of pictures that is taken this month', async () => {
    expect(await countPictures(connection, 12, "month")).toBe(2);
  })

  it('should throw error for invalid range', async () => {
     await expect(countPictures(connection, 12, "invalid")).rejects.toThrowError('Invalid range parameter given');
  });

   it('should return 0 for invalid district', async () => {
    expect(await countPictures(connection, -1, "day")).toBe(0);
   });

    it('should return total number of pictures if district is 0', async () => {
    expect(await countPictures(connection, 0, "day")).toBe(3);
  })
})

describe('fetchRecentPhotoID', () => {
  let connection;
  const insertIds = [];

  beforeAll(async () => {
    connection = createDbConnection(true);
    
    for (let i=0; i<5; i++) {
      let insertId = await insertDataToDb(connection, sampleData);
      insertIds.push(insertId);
    }
  })
  afterAll(async () => {
    await clearTestDb(connection);
    connection.end();
  })

  it('should return 3 ids with parameter 3', async () => {
    const result = await fetchRecentPhotoID(connection, 3);
    expect(result.length).toBe(3);
  })

  it('should return max num ids with parameter bigger than length', async () => {
    const result = await fetchRecentPhotoID(connection, 10);
    expect(result.length).toBe(5);
  })

  it('should return 4, default number of ids with no parameter', async () => {
    const result = await fetchRecentPhotoID(connection);
    expect(result.length).toBe(4);
  })

  it('should skip recent photos based on the parameter', async () => {
    const result = await fetchRecentPhotoID(connection, 2, 1);
    expect(result[0].id).toBe(insertIds[3]);
    expect(result[1].id).toBe(insertIds[2]);
  })

})

describe('Reverse Geocode', () => {
  let connection;
  beforeAll(() => {
    // To fetch the token & refresh, use the actual token
    connection = createDbConnection(false);
  })
  afterAll(() => {
    connection.end();
  })

  it('should convert GPS coordinates to the correct address', async () => {
    result = await reverseGeocode(connection, sampleData.latitude, sampleData.longitude);
    expect(result.districtNo).toBe(15);
    expect(result.postcode).toBe(428074);
    expect(result.districtName).toBe('Katong, Joo Chiat, Amber Road');
  })
});

describe('deleteByID function', () => {
  let connection;
  beforeAll(() => {
    connection = createDbConnection(true);
  })
  afterAll(async () => {
    await clearTestDb(connection);
    connection.end();
  })

  it('should delete the record by ID and return the number of affected rows', async () => {
    const insertedID = await insertDataToDb(connection, sampleData);
    const result = await deleteByID(connection, insertedID);
    expect(result).toBe(1);
  });
});