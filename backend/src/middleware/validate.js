const { error } = require('../utils/response');

/**
 * Middleware: Validate request body ด้วย Zod schema
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} source
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return error(res, 'ข้อมูลไม่ถูกต้อง', 422, errors);
    }
    req[source] = result.data; // ใช้ข้อมูลที่ผ่าน parse แล้ว (sanitized)
    next();
  };
};

module.exports = validate;
