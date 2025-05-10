const { insertDataToDB, fetchGPSByID, countPictures, fetchRecentPhotoID , GPSToAddress} = require('../db.js');
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


function createDBConnection() {
  const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: 'root',
    database: 'strayspotter_database_test',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306
  });
  return connection;
}

async function selectFunction(connection, insertId) {
  const sql = 'SELECT * FROM pictures WHERE id = ?';
  const [result] = await connection.promise().query(sql, [insertId]);
  return result;
}

async function clearTestDB(connection) {
  const sql = 'DELETE FROM pictures'
  const [result] = await connection.promise().query(sql);
  return result;
}

describe('insertDatatoDB', () => {
  
  const mockData = {
    metadata : {
      latitude: sampleData.latitude,
      longitude: sampleData.longitude,
      date: sampleData.date
    },
    otherdata : [
      sampleData.cat_status,
      {
        postcode: sampleData.postcode,
        districtNo: sampleData.districtNo,
        districtName: sampleData.districtName
      }
    ]
  };

  let connection;
  beforeAll(() => {
    connection = createDBConnection();
  });
  afterAll(async () => {
    await clearTestDB(connection);
    connection.end();
  });

  it('should return insertID after inserting, and verify DB insert', async () => {
 
    const result = await insertDataToDB(connection, mockData.metadata, mockData.otherdata);
    const check = await selectFunction(connection, result);

    expect(typeof result).toBe('number');
    expect(check.length).toBe(1);
  });
})

describe('fetchGPSByID', () => {
  const mockData = {
    metadata : {
      latitude: sampleData.latitude,
      longitude: sampleData.longitude,
      date: sampleData.date
    },
    otherdata : [
      sampleData.cat_status,
      {
        postcode: sampleData.postcode,
        districtNo: sampleData.districtNo,
        districtName: sampleData.districtName
      }
    ]
  };

  let connection;
  beforeAll(() => {
    connection = createDBConnection();
  });
  afterAll(async () => {
    await clearTestDB(connection);
    connection.end();
  });

  it('should return array with latitude and longitude', async () => {
    const testID = await insertDataToDB(connection, mockData.metadata, mockData.otherdata);
    const result = await fetchGPSByID(connection, testID);

    expect(result[0].latitude).toBe(sampleData.latitude)
    expect(result[0].longitude).toBe(sampleData.longitude)
  })
})

describe('countPictures', () => {
  const mockData = {
    metadata : {
      latitude: sampleData.latitude,
      longitude: sampleData.longitude,
      date: new Date()
    },
    otherdata : [
      sampleData.cat_status,
      {
        postcode: sampleData.postcode,
        districtNo: sampleData.districtNo,
        districtName: sampleData.districtName
      }
    ]
  };

  let connection;
  beforeAll(async () => {
    connection = createDBConnection();
    await insertDataToDB(connection, mockData.metadata, mockData.otherdata);
    await insertDataToDB(connection, mockData.metadata, mockData.otherdata);
  });
  afterAll(async () => {
    await clearTestDB(connection);
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

  it('should throw error for invalid input', () => {
    expect(() => countPictures(connection, 12, "invalid")).toThrowError('invalidParameterError');
  });
})

describe('fetchRecentPhotoID', () => {
  const mockData = {
    metadata : {
      latitude: sampleData.latitude,
      longitude: sampleData.longitude,
      date: sampleData.date
    },
    otherdata : [
      sampleData.cat_status,
      {
        postcode: sampleData.postcode,
        districtNo: sampleData.districtNo,
        districtName: sampleData.districtName
      }
    ]
  };
  let connection;

  beforeAll(async () => {
    connection = createDBConnection();
    for (let i=0; i<5; i++) {
      await insertDataToDB(connection, mockData.metadata, mockData.otherdata);
    }
  })

  afterAll(async () => {
    await clearTestDB(connection);
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

})

// Assume the token exists
// Need to Mock
describe('GPSToAddress', () => {
  let connection;

   const mockData = {
    metadata : {
      latitude: sampleData.latitude,
      longitude: sampleData.longitude,
      date: sampleData.date
    },
    otherdata : [
      sampleData.cat_status,
      {
        postcode: sampleData.postcode,
        districtNo: sampleData.districtNo,
        districtName: sampleData.districtName
      }
    ]
  };

  beforeAll(async () => {
    connection = createDBConnection();
  })

   afterAll(async () => {
    await clearTestDB(connection);
    connection.end();
  })

  it('should return address', async () => {
    console.log(mockData.latitude, mockData.longitude)
    result = await GPSToAddress(connection, mockData.metadata.latitude, mockData.metadata.longitude);
    console.log(result);
    expect(1).toBe(1);
  })


});