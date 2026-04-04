const { Router } = require('express');
const { authenticate, requireRole } = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const { z } = require('zod');
const {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require('./department.controller');

const router = Router();

const createSchema = z.object({
  name: z.string().min(1, 'กรุณาระบุชื่อหน่วยงาน').max(200),
  code: z.string().min(1, 'กรุณาระบุรหัสหน่วยงาน').max(20).regex(/^[A-Z0-9_]+$/i, 'รหัสต้องเป็นตัวอักษรหรือตัวเลขเท่านั้น'),
});
const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
});

router.get('/', authenticate, listDepartments);
router.get('/:id', authenticate, getDepartment);
router.post('/', authenticate, requireRole('admin'), validate(createSchema), createDepartment);
router.patch('/:id', authenticate, requireRole('admin'), validate(updateSchema), updateDepartment);
router.delete('/:id', authenticate, requireRole('admin'), deleteDepartment);

module.exports = router;
