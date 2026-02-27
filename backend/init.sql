CREATE DATABASE IF NOT EXISTS strayspotter_database;
USE strayspotter_database;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_id VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    joined_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS pictures (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    latitude FLOAT,
    longitude FLOAT,
    date_taken DATETIME,
    cat_status TINYINT(3),
    district_no INT
);

CREATE TABLE  IF NOT EXISTS posts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    picture_id BIGINT NOT NULL,
    user_id BIGINT DEFAULT NULL,
    body TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_posts_users
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

     CONSTRAINT fk_posts_pictures
        FOREIGN KEY (picture_id)
        REFERENCES pictures(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS anonymous_posts (
    post_id BIGINT PRIMARY KEY,
    anonymous_nickname VARCHAR(20) NOT NULL,
    anonymous_password_hash VARCHAR(255) NOT NULL,

    CONSTRAINT fk_anonymous_post
        FOREIGN KEY (post_id)
        REFERENCES posts(id)
        ON DELETE CASCADE
);

-- CREATE TABLE IF NOT EXISTS comments (
--     id BIGINT AUTO_INCREMENT PRIMARY KEY,
--     user_id BIGINT NOT NULL,
--     post_id BIGINT NOT NULL,
--     body TEXT NOT NULL,
--     created_at TIMESTAMP NOT NULL,

--     CONSTRAINT fk_comments_user
--         FOREIGN KEY (user_id)
--         REFERENCES users(id)
--         ON DELETE CASCADE,

--     CONSTRAINT fk_comments_post
--         FOREIGN KEY (post_id)
--         REFERENCES posts(id)
--         ON DELETE CASCADE
-- );


-- CREATE TABLE IF NOT EXISTS likes (
--     user_id BIGINT NOT NULL,
--     post_id BIGINT NOT NULL,

--     PRIMARY KEY (user_id, post_id),

--     CONSTRAINT fk_likes_user
--         FOREIGN KEY (user_id)
--         REFERENCES users(id)
--         ON DELETE CASCADE,

--     CONSTRAINT fk_likes_post
--         FOREIGN KEY (post_id)
--         REFERENCES posts(id)
--         ON DELETE CASCADE
-- );

CREATE TABLE IF NOT EXISTS tokens(
    token_name VARCHAR(10) PRIMARY KEY,
    access_token TEXT,
    expire_date INT
);