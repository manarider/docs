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

/**
 * แบ่งหน้าข้อมูล
 */
const paginate = (query, { page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;
  return { skip, limit: limitNum, page: pageNum };
};

const paginatedResponse = (res, { data, total, page, limit }) => {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};

// Aliases — sendError ใช้ลำดับ (res, statusCode, message) ต่างจาก error(res, message, statusCode)
const sendSuccess = success;
const sendError = (res, statusCode, message, errors = null) => error(res, message, statusCode, errors);

module.exports = { success, error, sendSuccess, sendError, paginate, paginatedResponse };
