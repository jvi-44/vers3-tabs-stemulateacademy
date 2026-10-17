/** Wraps an async route handler so a failed database call reaches the error
 *  handler in app.js (Express 4 doesn't catch rejected promises itself). */
export const route = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
