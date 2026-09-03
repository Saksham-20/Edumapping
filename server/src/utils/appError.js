// server/src/utils/appError.js
//
// `middleware/errorHandler.js` reads `err.status` and falls back to 500, so a
// plain `throw new Error('Invalid credentials')` answers a wrong password with
// HTTP 500. Every auth failure did exactly that: clients could not tell a bad
// password from a broken server, and the responses were indistinguishable from
// real faults in logs and monitoring.
//
// `httpError` attaches the status and a name the handler can render, so
// throwing stays as short as it was.

class AppError extends Error {
  constructor(status, message, name) {
    super(message);
    this.status = status;
    this.name = name || AppError.defaultName(status);
    this.expected = true; // a rejected request, not a fault
    Error.captureStackTrace?.(this, AppError);
  }

  static defaultName(status) {
    switch (status) {
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Not Found';
      case 409: return 'Conflict';
      default: return 'Error';
    }
  }
}

const httpError = (status, message, name) => new AppError(status, message, name);

module.exports = { AppError, httpError };
