const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.cookie = jest.fn(() => res);
  return res;
};

jest.mock('../../../src/db', () => ({
  pool: {},
  fetchUserByEmail: jest.fn(),
  fetchUserByAccountId: jest.fn(),
  fetchUserById: jest.fn(),
  insertUser: jest.fn(),
  updateUserPassword: jest.fn()
}));

jest.mock('bcrypt', () => ({
  genSalt: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn()
}));

const db = require('../../../src/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { ValidationError, UnauthorizedError, NotFoundError } = require('../../../errors/CustomError');
const { register, login, getUserDetails, refreshToken, changePassword } = require('../../../src/controllers/userController');

describe('userController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    test('missing accountId: calls next with ValidationError', async () => {
      const req = { body: { password: 'pw', email: 'a@b.com' } };
      const next = jest.fn();
      await register(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('missing password: calls next with ValidationError', async () => {
      const req = { body: { accountId: 'user1', email: 'a@b.com' } };
      const next = jest.fn();
      await register(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('missing email: calls next with ValidationError', async () => {
      const req = { body: { accountId: 'user1', password: 'pw' } };
      const next = jest.fn();
      await register(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('duplicate email: calls next with ValidationError', async () => {
      db.fetchUserByEmail.mockResolvedValue({ id: 1 });
      db.fetchUserByAccountId.mockResolvedValue(null);
      const req = { body: { accountId: 'user1', password: 'pw', email: 'a@b.com' } };
      const next = jest.fn();
      await register(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('duplicate accountId: calls next with ValidationError', async () => {
      db.fetchUserByEmail.mockResolvedValue(null);
      db.fetchUserByAccountId.mockResolvedValue({ id: 1 });
      const req = { body: { accountId: 'user1', password: 'pw', email: 'a@b.com' } };
      const next = jest.fn();
      await register(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('success: responds 201 with token and user, sets refreshToken cookie', async () => {
      db.fetchUserByEmail.mockResolvedValue(null);
      db.fetchUserByAccountId.mockResolvedValue(null);
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('hashed');
      db.insertUser.mockResolvedValue(42);
      jwt.sign.mockReturnValueOnce('refresh-tok').mockReturnValueOnce('access-tok');

      const req = { body: { accountId: 'user1', password: 'pw', email: 'a@b.com' } };
      const res = makeRes();
      const next = jest.fn();

      await register(req, res, next);

      expect(db.insertUser).toHaveBeenCalledWith(db.pool, 'user1', 'hashed', 'a@b.com');
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'refresh-tok', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        token: 'access-tok',
        user: { userId: 42, accountId: 'user1', email: 'a@b.com' }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    test('missing accountId: calls next with ValidationError', async () => {
      const req = { body: { password: 'pw' } };
      const next = jest.fn();
      await login(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('missing password: calls next with ValidationError', async () => {
      const req = { body: { accountId: 'user1' } };
      const next = jest.fn();
      await login(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('user not found: calls next with UnauthorizedError', async () => {
      db.fetchUserByAccountId.mockResolvedValue(null);
      const req = { body: { accountId: 'user1', password: 'pw' } };
      const next = jest.fn();
      await login(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    test('wrong password: calls next with UnauthorizedError', async () => {
      db.fetchUserByAccountId.mockResolvedValue({ id: 1, password_hash: 'hash' });
      bcrypt.compare.mockResolvedValue(false);
      const req = { body: { accountId: 'user1', password: 'wrong' } };
      const next = jest.fn();
      await login(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    test('success: responds 200 with token and user, sets refreshToken cookie', async () => {
      db.fetchUserByAccountId.mockResolvedValue({ id: 5, account_id: 'user1', email: 'a@b.com', password_hash: 'hash' });
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValueOnce('refresh-tok').mockReturnValueOnce('access-tok');

      const req = { body: { accountId: 'user1', password: 'pw' } };
      const res = makeRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'refresh-tok', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        token: 'access-tok',
        user: { userId: 5, accountId: 'user1', email: 'a@b.com' }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getUserDetails', () => {
    test('user not found: calls next with NotFoundError', async () => {
      db.fetchUserById.mockResolvedValue(null);
      const req = { userId: 1 };
      const next = jest.fn();
      await getUserDetails(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    test('success: responds 200 with accountId, email, joinedDate', async () => {
      db.fetchUserById.mockResolvedValue({ account_id: 'user1', email: 'a@b.com', joined_date: '2024-01-01' });
      const req = { userId: 1 };
      const res = makeRes();
      const next = jest.fn();

      await getUserDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ accountId: 'user1', email: 'a@b.com', joinedDate: '2024-01-01' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    test('success: responds 200 with new token', async () => {
      jwt.sign.mockReturnValue('new-access-tok');
      const req = { userId: 7 };
      const res = makeRes();
      const next = jest.fn();

      await refreshToken(req, res, next);

      expect(jwt.sign).toHaveBeenCalledWith({ userId: 7 }, process.env.JWT_SECRET, { expiresIn: '15m' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ token: 'new-access-tok' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    test('missing oldPassword: calls next with ValidationError', async () => {
      const req = { userId: 1, body: { newPassword: 'new' } };
      const next = jest.fn();
      await changePassword(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('missing newPassword: calls next with ValidationError', async () => {
      const req = { userId: 1, body: { oldPassword: 'old' } };
      const next = jest.fn();
      await changePassword(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('user not found: calls next with NotFoundError', async () => {
      db.fetchUserById.mockResolvedValue(null);
      const req = { userId: 1, body: { oldPassword: 'old', newPassword: 'new' } };
      const next = jest.fn();
      await changePassword(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    test('wrong old password: calls next with UnauthorizedError', async () => {
      db.fetchUserById.mockResolvedValue({ id: 1, password_hash: 'hash' });
      bcrypt.compare.mockResolvedValue(false);
      const req = { userId: 1, body: { oldPassword: 'wrong', newPassword: 'new' } };
      const next = jest.fn();
      await changePassword(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    test('success: calls updateUserPassword and responds 200', async () => {
      db.fetchUserById.mockResolvedValue({ id: 1, password_hash: 'hash' });
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('newhash');
      db.updateUserPassword.mockResolvedValue(undefined);

      const req = { userId: 1, body: { oldPassword: 'old', newPassword: 'new' } };
      const res = makeRes();
      const next = jest.fn();

      await changePassword(req, res, next);

      expect(db.updateUserPassword).toHaveBeenCalledWith(db.pool, 1, 'newhash');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Password changed successfully' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
