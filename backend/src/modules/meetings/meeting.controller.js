const fs = require('fs');
const Meeting = require('../../models/Meeting');
const Document = require('../../models/Document');
const DocType = require('../../models/DocType');
const { logAction, getIp } = require('../../utils/auditHelper');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');

const MEETING_DOCTYPE_CODE = 'MEET';

// ช่วงเวลาแสดงผลล่วงหน้า/ย้อนหลัง รอบระยะเวลาประชุมจริง
const PRE_BUFFER_MS = 60 * 60 * 1000; // 1 ชั่วโมงก่อนประชุม
const POST_BUFFER_MS = 60 * 60 * 1000; // 1 ชั่วโมงหลังประชุม

/**
 * หา/สร้าง DocType "เอกสารประชุม" (code: MEET) — ใช้ตรึงประเภทเอกสารของ MeetingDocs
 */
async function ensureMeetingDocType() {
  let docType = await DocType.findOne({ code: MEETING_DOCTYPE_CODE });
  if (!docType) {
    docType = await DocType.create({
      name: 'เอกสารประชุม',
      code: MEETING_DOCTYPE_CODE,
      description: 'เอกสารสำหรับใช้แสดงผลในระบบจัดการเอกสารประชุม (MeetingDocs)',
    });
  } else if (docType.deletedAt || !docType.isActive) {
    docType.deletedAt = null;
    docType.isActive = true;
    await docType.save();
  }
  return docType;
}

/**
 * GET /api/meetings/doctype
 * คืนประเภทเอกสาร "เอกสารประชุม" (สร้างอัตโนมัติถ้ายังไม่มี)
 */
async function getMeetingDocType(req, res) {
  try {
    const docType = await ensureMeetingDocType();
    return sendSuccess(res, docType, 'ประเภทเอกสารประชุม');
  } catch (err) {
    logger.error('[Meeting] getMeetingDocType error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/meetings?status=active|history&page=&limit=
 * รายการคิวการแสดงผล — active = ยังไม่หมดเวลา, history = หมดเวลาแล้ว
 */
async function listMeetings(req, res) {
  try {
    const { status = 'active', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const now = new Date();

    const filter = { deleted_at: null };
    if (status === 'history') filter.ends_at = { $lt: now };
    else filter.ends_at = { $gte: now };

    const sortOpt = status === 'history' ? { ends_at: -1 } : { starts_at: 1 };

    const [items, total] = await Promise.all([
      Meeting.find(filter)
        .populate({ path: 'documents', select: 'title attachments deleted_at' })
        .sort(sortOpt)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Meeting.countDocuments(filter),
    ]);

    items.forEach((m) => {
      m.documents = (m.documents || [])
        .filter((d) => d && !d.deleted_at)
        .map((d) => ({ ...d, attachments: (d.attachments || []).filter((a) => !a.deleted_at) }));
    });

    return res.json({
      success: true,
      data: items,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    logger.error('[Meeting] listMeetings error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * ตรวจว่าเอกสารที่เลือกทั้งหมดมีอยู่จริง และเป็นประเภทเอกสารประชุม (MEET)
 */
async function validateMeetingDocuments(documentIds) {
  const meetDocType = await ensureMeetingDocType();
  const docs = await Document.find({ _id: { $in: documentIds }, deleted_at: null })
    .select('type_id')
    .lean();
  const valid =
    docs.length === documentIds.length &&
    docs.every((d) => String(d.type_id) === String(meetDocType._id));
  return valid;
}

/**
 * POST /api/meetings
 * สร้างคิวการแสดงผลใหม่
 */
async function createMeeting(req, res) {
  try {
    const { description, documents, starts_at, ends_at } = req.body;

    const isValid = await validateMeetingDocuments(documents);
    if (!isValid) {
      return sendError(res, 400, 'เอกสารบางรายการไม่ถูกต้องหรือไม่ใช่เอกสารประชุม');
    }

    const meeting = await Meeting.create({
      description: description?.trim() || '',
      documents,
      starts_at,
      ends_at,
      created_by: req.user.userId,
    });

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'CREATE',
      module: 'MEETING',
      resourceId: meeting._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
      details: { starts_at, ends_at, documents },
    });

    return sendSuccess(res, meeting, 'สร้างคิวการแสดงผลเรียบร้อย');
  } catch (err) {
    logger.error('[Meeting] createMeeting error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/meetings/:id
 */
async function getMeeting(req, res) {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, deleted_at: null })
      .populate({ path: 'documents', select: 'title attachments deleted_at' })
      .lean();
    if (!meeting) return sendError(res, 404, 'ไม่พบคิวการแสดงผล');
    meeting.documents = (meeting.documents || [])
      .filter((d) => d && !d.deleted_at)
      .map((d) => ({ ...d, attachments: (d.attachments || []).filter((a) => !a.deleted_at) }));
    return sendSuccess(res, meeting, 'รายละเอียดคิวการแสดงผล');
  } catch (err) {
    logger.error('[Meeting] getMeeting error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

function canManageMeeting(req, meeting) {
  const userRole = req.user.role;
  if (['superadmin', 'admin', 'manager', 'staff'].includes(userRole)) return true;
  return String(meeting.created_by) === req.user.userId;
}

/**
 * PATCH /api/meetings/:id
 */
async function updateMeeting(req, res) {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, deleted_at: null });
    if (!meeting) return sendError(res, 404, 'ไม่พบคิวการแสดงผล');
    if (!canManageMeeting(req, meeting)) return sendError(res, 403, 'คุณไม่มีสิทธิ์แก้ไขคิวนี้');

    const { description, documents, starts_at, ends_at } = req.body;

    if (documents) {
      const isValid = await validateMeetingDocuments(documents);
      if (!isValid) return sendError(res, 400, 'เอกสารบางรายการไม่ถูกต้องหรือไม่ใช่เอกสารประชุม');
      meeting.documents = documents;
    }
    if (description !== undefined) meeting.description = description?.trim() || '';
    if (starts_at) meeting.starts_at = starts_at;
    if (ends_at) meeting.ends_at = ends_at;

    if (meeting.ends_at.getTime() <= meeting.starts_at.getTime()) {
      return sendError(res, 400, 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น');
    }

    await meeting.save();

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'UPDATE',
      module: 'MEETING',
      resourceId: meeting._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, meeting, 'แก้ไขคิวการแสดงผลเรียบร้อย');
  } catch (err) {
    logger.error('[Meeting] updateMeeting error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * DELETE /api/meetings/:id
 */
async function deleteMeeting(req, res) {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, deleted_at: null });
    if (!meeting) return sendError(res, 404, 'ไม่พบคิวการแสดงผล');
    if (!canManageMeeting(req, meeting)) return sendError(res, 403, 'คุณไม่มีสิทธิ์ลบคิวนี้');

    meeting.deleted_at = new Date();
    await meeting.save();

    await logAction({
      userId: req.user.userId,
      username: req.user.username,
      action: 'DELETE',
      module: 'MEETING',
      resourceId: meeting._id,
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, null, 'ลบคิวการแสดงผลเรียบร้อย');
  } catch (err) {
    logger.error('[Meeting] deleteMeeting error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * เลือกคิวการประชุมที่ "ควรแสดงผล" ในขณะนี้ จากรายการคิวทั้งหมด
 * กติกา:
 *  - แสดงล่วงหน้า 1 ชม. ก่อนเริ่ม และค้างไว้ 1 ชม. หลังจบ
 *  - ระหว่างที่ประชุมกำลังดำเนินอยู่จริง (starts_at..ends_at) จะมีสิทธิ์เหนือคิวอื่นเสมอ
 *  - ถ้าไม่มีคิวที่กำลังประชุมจริง ให้เลือกคิวที่ starts_at ล่าสุด (ใหม่สุด) จากคิวที่อยู่ในช่วงแสดงผล
 *    — ทำให้กรณีประชุมติดต่อกัน คิวใหม่จะมาแทนทันทีที่คิวก่อนหน้าหมดเวลาจริง (ไม่ต้องรอ buffer 1 ชม.)
 * คืนค่า { meeting, displayUntil(ms) } หรือ null ถ้าไม่มีคิวใดควรแสดง
 */
function selectCurrentMeeting(meetings, nowMs) {
  const candidates = meetings.filter(
    (m) => m.starts_at.getTime() - PRE_BUFFER_MS <= nowMs && nowMs <= m.ends_at.getTime() + POST_BUFFER_MS
  );
  if (candidates.length === 0) return null;

  const live = candidates.filter((m) => m.starts_at.getTime() <= nowMs && nowMs <= m.ends_at.getTime());
  const current =
    live.length > 0
      ? live.reduce((a, b) => (b.starts_at.getTime() > a.starts_at.getTime() ? b : a))
      : candidates.reduce((a, b) => (b.starts_at.getTime() > a.starts_at.getTime() ? b : a));

  // หาคิวถัดไป (ตามเวลาเริ่ม) เพื่อคำนวณว่าคิวปัจจุบันจะถูกแทนที่เร็วกว่ากำหนดหรือไม่ (ประชุมติดต่อกัน)
  const next = meetings
    .filter((m) => m.starts_at.getTime() > current.starts_at.getTime())
    .sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime())[0];

  let displayUntil = current.ends_at.getTime() + POST_BUFFER_MS;
  if (next && next.starts_at.getTime() - PRE_BUFFER_MS <= current.ends_at.getTime()) {
    displayUntil = current.ends_at.getTime();
  }

  return { meeting: current, displayUntil };
}

/**
 * แปลงคิวการประชุม + เอกสารที่เลือกไว้ ให้เป็น payload สำหรับหน้าแสดงผลสาธารณะ
 */
function buildDisplayPayload(meeting, displayUntilMs) {
  const docs = (meeting.documents || []).filter((d) => d && !d.deleted_at);
  const buttons = [];
  docs.forEach((doc) => {
    const activeAtts = (doc.attachments || []).filter((a) => !a.deleted_at);
    const multi = activeAtts.length > 1;
    activeAtts.forEach((att) => {
      if (att.att_type === 'google_url') {
        buttons.push({
          doc_id: String(doc._id),
          sub_id: att.sub_id,
          kind: 'google',
          label: multi ? `${doc.title} - ${att.sub_title}` : doc.title,
          url: att.source_url,
        });
      } else if (att.mime_type === 'application/pdf') {
        buttons.push({
          doc_id: String(doc._id),
          sub_id: att.sub_id,
          kind: 'pdf',
          label: multi ? `${doc.title} - ${att.sub_title}` : doc.title,
        });
      }
    });
  });

  const message = (meeting.description && meeting.description.trim()) || docs.map((d) => d.title).join(', ') || 'เอกสารการประชุม';

  return {
    meeting_id: String(meeting._id),
    message,
    starts_at: meeting.starts_at,
    ends_at: meeting.ends_at,
    display_until: new Date(displayUntilMs).toISOString(),
    buttons,
  };
}

/**
 * GET /api/meetings/public/current — public, ไม่ต้อง login
 * คืนคิวการประชุมที่ควรแสดงผล ณ ขณะนี้ (หรือ null ถ้าไม่มี)
 */
async function getPublicCurrent(req, res) {
  try {
    const now = new Date();
    const meetings = await Meeting.find({ deleted_at: null })
      .populate({ path: 'documents', select: 'title attachments deleted_at', match: { deleted_at: null } })
      .lean();

    const result = selectCurrentMeeting(meetings, now.getTime());
    if (!result) return res.json({ success: true, data: null });

    const payload = buildDisplayPayload(result.meeting, result.displayUntil);
    return res.json({ success: true, data: payload });
  } catch (err) {
    logger.error('[Meeting] getPublicCurrent error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

/**
 * GET /api/meetings/public/file/:meetingId/:docId/:subId — public, ไม่ต้อง login
 * สตรีมไฟล์ PDF — เข้าถึงได้เฉพาะช่วงเวลาที่คิวการประชุมนั้นยังอยู่ในช่วงแสดงผล
 */
async function streamPublicFile(req, res) {
  try {
    const { meetingId, docId, subId } = req.params;
    const now = Date.now();

    const meeting = await Meeting.findOne({ _id: meetingId, deleted_at: null }).lean();
    if (!meeting) return sendError(res, 404, 'ไม่พบข้อมูลการประชุม');

    const windowStart = meeting.starts_at.getTime() - PRE_BUFFER_MS;
    const windowEnd = meeting.ends_at.getTime() + POST_BUFFER_MS;
    if (now < windowStart || now > windowEnd) {
      return res.status(410).json({ success: false, message: 'หมดเวลาการแสดงผลเอกสารนี้แล้ว' });
    }
    if (!meeting.documents.some((d) => String(d) === String(docId))) {
      return sendError(res, 403, 'เอกสารนี้ไม่ได้อยู่ในรายการของการประชุมนี้');
    }

    const doc = await Document.findOne({ _id: docId, deleted_at: null })
      .select('+attachments.file_path')
      .lean();
    if (!doc) return sendError(res, 404, 'ไม่พบเอกสาร');

    const att = (doc.attachments || []).find((a) => a.sub_id === subId && !a.deleted_at);
    if (!att || att.att_type === 'google_url' || att.mime_type !== 'application/pdf') {
      return sendError(res, 400, 'ไม่พบไฟล์ที่ร้องขอ');
    }
    if (!fs.existsSync(att.file_path)) return sendError(res, 404, 'ไฟล์ไม่พบในระบบ');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(att.original_name || 'document.pdf')}`
    );
    // อนุญาตให้แคชได้ (browser + Cloudflare edge) แต่จำกัดอายุแคชไว้ไม่เกินเวลาที่เหลือของ
    // ช่วงแสดงผลจริง (หรือสูงสุด 5 นาที) — ช่วยลดเวลาโหลดซ้ำเมื่อมีผู้เข้าชมเอกสารเดียวกัน
    // พร้อมกันหลายเครื่องในห้องประชุม โดยยังหมดอายุไม่เกินเวลาที่ควรหยุดแสดงผล
    const remainingSec = Math.floor((windowEnd - now) / 1000);
    const maxAge = Math.max(0, Math.min(300, remainingSec));
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    return res.sendFile(att.file_path);
  } catch (err) {
    logger.error('[Meeting] streamPublicFile error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

module.exports = {
  ensureMeetingDocType,
  getMeetingDocType,
  listMeetings,
  createMeeting,
  getMeeting,
  updateMeeting,
  deleteMeeting,
  getPublicCurrent,
  streamPublicFile,
};
