const db = require('../db');
const pool = db.pool;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
  ValidationError,
  UnauthorizedError,
  NotFoundError
} = require('../../errors/CustomError');
require('dotenv').config();

/**
 * @typedef {Object} RegisterBody
 * @property {string} accountId - Unique account identifier for the user.
 * @property {string} password - Plain-text password to be hashed and stored.
 * @property {string} email - User email address.
 */

/**
 * @typedef {Object} LoginBody
 * @property {string} accountId - Account identifier used for login.
 * @property {string} password - Plain-text password for authentication.
 */

/**
 * Registers a new user with account ID, password, and email, and issues access/refresh tokens.
 *
 * Request:
 * - Body: {@link RegisterBody}
 *
 * Response:
 * - 201 Created: JSON containing access token and basic user info
 * - 400 Bad Request: Missing fields or duplicate email/accountId
 * - 500 Internal Server Error: Any unexpected error during registration
 *
 * @param {RegisterBody} req.body
 * @returns {Promise<void>}
 */
async function register (req, res, next) {
    try {
        const {accountId, password, email} = req.body;

        if (!accountId || !password || !email) {
            throw new ValidationError('All fields are required');
        }

        const userByEmail = await db.fetchUserByEmail(pool, email);
        const userByAccountId = await db.fetchUserByAccountId(pool, accountId);
        if (userByEmail || userByAccountId) {
            throw new ValidationError('Email or account ID already exists');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const userId = await db.insertUser(pool, accountId, hashedPassword, email);

        const refreshToken = jwt.sign(
            { userId: userId },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        const accessToken = jwt.sign(
            { userId: userId },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );
        res.status(201).json({
            token: accessToken,
            user: {
                userId: userId,
                accountId: accountId,
                email: email
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Authenticates a user by account ID and password, then issues access/refresh tokens.
 *
 * Request:
 * - Body: {@link LoginBody}
 *
 * Response:
 * - 200 OK: JSON containing access token and user info
 * - 400 Bad Request: Missing accountId or password
 * - 401 Unauthorized: Invalid accountId or password
 *
 * @param {LoginBody} req.body
 * @returns {Promise<void>}
 */
async function login (req, res, next) {
    try {
        const { accountId, password } = req.body;

        if (!accountId || !password) {
            throw new ValidationError('Account ID and password are required');
        }

        const user = await db.fetchUserByAccountId(pool, accountId);
        if (!user) {
            throw new UnauthorizedError('Invalid account ID or password');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            throw new UnauthorizedError('Invalid account ID or password');
        }

        const refreshToken = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        const accessToken = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );
        res.status(200).json({
            token: accessToken,
            user: {
                userId: user.id,
                accountId: user.account_id,
                email: user.email
            }
        });
    }   catch (error) {
        next(error);
    }
}

/**
 * Retrieves details of the currently authenticated user.
 *
 * Request:
 * - `req.userId` must be populated by authentication middleware.
 *
 * Response:
 * - 200 OK: { accountId, email, joinedDate }
 * - 404 Not Found: When the user does not exist
 *
 * @returns {Promise<void>}
 */
async function getUserDetails (req, res, next) {
    try {
        const userId = req.userId;
        const user = await db.fetchUserById(pool, userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        res.status(200).json({
            accountId: user.account_id,
            email: user.email,
            joinedDate: user.joined_date
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Issues a new short-lived access token for the authenticated user.
 *
 * Request:
 * - `req.userId` must be populated by authentication middleware.
 *
 * Response:
 * - 200 OK: { token: string }
 *
 * @returns {Promise<void>}
 */
async function refreshToken (req, res, next) {
    try {
        const userId = req.userId;
        const token = jwt.sign(
            { userId: userId},
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );
        res.status(200).json({ token: token });
    } catch (error) {
        next(error);
    }
}

/**
 * Changes the password of the authenticated user.
 *
 * Request:
 * - `req.userId` must be populated by authentication middleware.
 * - Body: {@link ChangePasswordBody} (oldPassword: string, newPassword: string)
 *
 * Response:
 * - 200 OK: { message: string }
 * - 400 Bad Request: Missing old password or new password
 * - 401 Unauthorized: Invalid old password
 * - 404 Not Found: User not found
 *
 * @param {ChangePasswordBody} req.body
 * @returns {Promise<void>}
 */
async function changePassword (req, res, next) {
    try {
        const userId = req.userId;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            throw new ValidationError('Old password and new password are required');
        }

        const user = await db.fetchUserById(pool, userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const isPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isPasswordValid) {
            throw new UnauthorizedError('Invalid old password');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await db.updateUserPassword(pool, userId, hashedPassword);
        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    register,
    login,
    getUserDetails,
    refreshToken,
    changePassword
}