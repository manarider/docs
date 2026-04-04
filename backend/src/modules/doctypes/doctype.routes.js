const { Router } = require('express');
const { authenticate, requireRole } = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const { z } = require('zod');
const {
  listDocTypes, listPending, getDocType,
  createDocType, requestDocType, approveDocType, getDocTypeDocuments,
  updateDocType, deleteDocType,
} = require('./doctype.controller');

const router = Router();

const createSchema = z.object({
  name: z.string().min(1, 'กรุณาระบุชื่อประเภทเอกสาร').max(200),
  code: z.string().min(1, 'กรุณาระบุรหัส').max(20).regex(/^[A-Z0-9_]+$/i),
  description: z.string().max(500).optional(),
});
const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

router.get('/', authenticate, listDocTypes);
router.get('/pending', authenticate, requireRole('admin'), listPending);
router.get('/:id', authenticate, getDocType);
router.get('/:id/documents', authenticate, requireRole('admin'), getDocTypeDocuments);
router.post('/', authenticate, requireRole('admin'), validate(createSchema), createDocType);
router.post('/request', authenticate, requestDocType);          // ผู้ใช้ทั่วไปขอเพิ่ม
router.post('/:id/approve', authenticate, requireRole('admin'), approveDocType);
router.patch('/:id', authenticate, requireRole('admin'), validate(updateSchema), updateDocType);
router.delete('/:id', authenticate, requireRole('admin'), deleteDocType);

module.exports = router;
