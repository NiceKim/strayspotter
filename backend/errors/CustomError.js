class CustomError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

class ValidationError extends CustomError {
  constructor(message = 'Validation error') {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends CustomError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

module.exports = { CustomError, ValidationError, NotFoundError };