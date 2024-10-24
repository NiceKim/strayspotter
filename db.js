

// Create the connection to database
const mysql = require('mysql2');
require('dotenv').config();

module.exports = {
  insert_data, select_data, createDBConnection 
}


// THE ADDRESS AND CAT STAUTS TO BE UPDATED
function insert_data(metadata) {

  let data = {
    latitude : metadata.latitude,
    longitude : metadata.longitude,
    date : metadata.CreateDate ?? "9999-12-30",
    postcode : 123,
    district_no : 12,
    district_name : 'TEST',
    cat_status : 1,
  };
  // if (metadata.GPSDateStamp) {
  //   data.date = metadata.GPSDateStamp.replaceAll(':','-');
  // } else if (metadata.CreateDate) {
  //   data.date = metadata.CreateDate;
  // }

  const connection = createDBConnection()
  // A query to insert data into table
  
  return new Promise((resolve, reject) => {
    connection.query(
      `INSERT INTO pictures (latitude, longitude, date_taken, postcode, 
      district_no, district_name, cat_status) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.latitude, data.longitude, data.date, data.postcode, data.district_no, data.district_name, data.cat_status]
      ,(err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results.insertId);
        }
        connection.end();
      })
  })
}

function select_data(limit) {
  const connection = createDBConnection()
  // A query to insert data into table
  connection.query(
    `SELECT * FROM pictures LIMIT ` + limit
    ,function (err, results) {
      if (err) { console.log(err) }
      console.log(results);
    }
  );
  // Ends the connection
  connection.end();
}

function createDBConnection() {
  const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'strayspotter_database',
    password: process.env.DB_PASSWORD,
  });
  return connection;
}