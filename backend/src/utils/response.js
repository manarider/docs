/**
 * สร้าง response มาตรฐาน
 */
const success = (res, data, message = 'success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const error = (res, message = 'Internal server error', statusCode = 500, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

// Aliases — sendError ใช้ลำดับ (res, statusCode, message) ต่างจาก error(res, message, statusCode)
const sendSuccess = success;
const sendError = (res, statusCode, message, errors = null) => error(res, message, statusCode, errors);

module.exports = { success, error, sendSuccess, sendError };
