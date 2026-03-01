const db = require('../db');
const pool = db.pool;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function register (req, res, next) {
    try {
        const {accountId, password, email} = req.body;

        if (!accountId || !password || !email) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const userByEmail = await db.fetchUserByEmail(pool, email);
        const userByAccountId = await db.fetchUserByAccountId(pool, accountId);
        if (userByEmail || userByAccountId) {
            return res.status(400).json({ message: 'Email or account ID already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const userId = await db.insertUser(pool, accountId, hashedPassword, email);

        const token = jwt.sign(
            { userId: userId},
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );
        res.status(201).json({
            token: token,
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

async function login (req, res, next) {
    try {
        const { accountId, password } = req.body;

        if (!accountId || !password) {
            return res.status(400).json({ message: 'Account ID and password are required' });
        }

        const user = await db.fetchUserByAccountId(pool, accountId);
        if (!user) {
            return res.status(401).json({ message: 'Invalid account ID or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid account ID or password' });
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.status(200).json({
            token: token,
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

async function getUserDetails (req, res, next) {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const user = await db.fetchUserById(pool, userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
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

module.exports = {
    register,
    login,
    getUserDetails
}