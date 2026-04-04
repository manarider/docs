const { z } = require('zod');
const validate = require('../../middleware/validate');

const createDocSchema = z.object({
  title: z.string().min(1, 'กรุณาระบุชื่อเอกสาร').max(1000),
  description: z.string().max(2000).optional(),
  dept_id: z.string().min(1, 'กรุณาระบุหน่วยงาน'),
  type_id: z.string().min(1, 'กรุณาระบุประเภทเอกสาร'),
  tags: z.array(z.string().max(100)).max(20).optional(),
  is_public: z.boolean().optional(),
});

const updateDocSchema = z.object({
  title: z.string().min(1).max(1000).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  is_public: z.boolean().optional(),
});

const uploadAttSchema = z.object({
  sub_title: z.string().min(1, 'กรุณาระบุชื่อเอกสารแนบ').max(500),
});

module.exports = {
  validateCreate: validate(createDocSchema),
  validateUpdate: validate(updateDocSchema),
  validateUploadAtt: validate(uploadAttSchema),
};
