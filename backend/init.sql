CREATE DATABASE IF NOT EXISTS strayspotter_database;
USE strayspotter_database;

CREATE TABLE IF NOT EXISTS pictures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    latitude FLOAT,
    longitude FLOAT,
    date_taken DATE,
    postcode INT,
    district_no INT,
    district_name VARCHAR(50),
    cat_status VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS post_anonymous (
    post_id INT PRIMARY KEY,
    anonymous_nickname VARCHAR(50),
    anonymous_password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens(
    token_name VARCHAR(10) PRIMARY KEY,
    access_token TEXT,
    expire_date INT
);