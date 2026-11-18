const { z } = require('zod');
const validate = require('../../middleware/validate');

const isoDate = z.coerce.date({ invalid_type_error: 'รูปแบบวันที่ไม่ถูกต้อง' });

const createMeetingSchema = z
  .object({
    description: z.string().max(500).optional(),
    documents: z.array(z.string().min(1)).min(1, 'กรุณาเลือกเอกสารอย่างน้อย 1 รายการ'),
    starts_at: isoDate,
    ends_at: isoDate,
  })
  .refine((d) => d.ends_at.getTime() > d.starts_at.getTime(), {
    message: 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น',
    path: ['ends_at'],
  });

const updateMeetingSchema = z
  .object({
    description: z.string().max(500).optional(),
    documents: z.array(z.string().min(1)).min(1).optional(),
    starts_at: isoDate.optional(),
    ends_at: isoDate.optional(),
  })
  .refine((d) => !d.starts_at || !d.ends_at || d.ends_at.getTime() > d.starts_at.getTime(), {
    message: 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น',
    path: ['ends_at'],
  });

module.exports = {
  validateCreateMeeting: validate(createMeetingSchema),
  validateUpdateMeeting: validate(updateMeetingSchema),
};
