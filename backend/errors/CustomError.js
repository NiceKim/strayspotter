class CustomError extends Error {
  constructor(message, statusCode, logging = true) {
    super(message);
    this.statusCode = statusCode;
    this.logging = logging;
    this.expose = statusCode >= 400 && statusCode < 500;
  }
}

class ValidationError extends CustomError {
  constructor(message = 'Validation error') {
    super(message, 400, false);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends CustomError {
  constructor(message = 'Resource not found') {
    super(message, 404, false);
    this.name = 'NotFoundError';
  }
}

class ForbiddenError extends CustomError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

class UnauthorizedError extends CustomError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

class PayloadTooLargeError extends CustomError {
  constructor(message = 'Payload too large') {
    super(message, 413);
    this.name = 'PayloadTooLargeError';
  }
}

module.exports = {
  CustomError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  PayloadTooLargeError
};