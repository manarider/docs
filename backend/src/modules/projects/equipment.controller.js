/**
 * equipment.controller.js
 * Global equipment search — ค้นหาครุภัณฑ์ / ตำแหน่ง ข้ามโครงการ
 */
const DailyReport = require('../../models/DailyReport');
const Procurement = require('../../models/Procurement');
const Project = require('../../models/Project');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');

/** Escape special regex characters to prevent ReDoS */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/equipment/search?q=&mode=equipment_no|position
 * ต้อง login ด้วย session ปกติ (authenticate + requireRole ใน routes)
 */
async function searchEquipment(req, res) {
  try {
    const { q = '', mode = 'equipment_no' } = req.query;
    const term = String(q).trim();
    if (!term) return sendSuccess(res, [], 'ok');

    const regex = new RegExp(escapeRegex(term), 'i');

    // ── mode: equipment_no ──────────────────────────────────────────────────
    if (mode === 'equipment_no') {
      // ค้นหาจาก equipment_serial_list
      const procItems = await Procurement.find({
        'equipment_serial_list.equipment_no': regex,
      }).lean();

      // ค้นหา legacy field equipment_no (procurement ที่ไม่ได้ใช้ serial_list)
      const legacyProc = await Procurement.find({
        'equipment_serial_list': { $size: 0 },
        equipment_no: regex,
      }).lean();

      // สร้าง map: equipment_no → info
      const equipMap = new Map();

      for (const proc of procItems) {
        const project = await Project.findById(proc.project_id).select('title').lean();
        for (const eq of (proc.equipment_serial_list || [])) {
          if (regex.test(eq.equipment_no) && !equipMap.has(eq.equipment_no)) {
            equipMap.set(eq.equipment_no, {
              equipment_no: eq.equipment_no,
              serial_no: eq.serial_no || '',
              description: proc.description || '',
              project_id: String(proc.project_id),
              project_title: project?.title || '',
            });
          }
        }
      }

      for (const proc of legacyProc) {
        if (proc.equipment_no && !equipMap.has(proc.equipment_no)) {
          const project = await Project.findById(proc.project_id).select('title').lean();
          equipMap.set(proc.equipment_no, {
            equipment_no: proc.equipment_no,
            serial_no: '',
            description: proc.description || '',
            project_id: String(proc.project_id),
            project_title: project?.title || '',
          });
        }
      }

      if (equipMap.size === 0) return sendSuccess(res, [], 'ok');

      // หา position จาก daily report ล่าสุด
      const results = [];
      for (const [equipment_no, info] of equipMap) {
        const latestReport = await DailyReport.findOne({
          'equipment_items.equipment_no': equipment_no,
        })
          .sort({ report_date: -1 })
          .select('position report_date project_id')
          .lean();

        results.push({
          ...info,
          current_position: latestReport?.position || '',
          last_date: latestReport?.report_date || null,
        });
      }

      results.sort((a, b) => a.equipment_no.localeCompare(b.equipment_no, 'th'));
      return sendSuccess(res, results, 'ok');
    }

    // ── mode: position ──────────────────────────────────────────────────────
    if (mode === 'position') {
      const reports = await DailyReport.find({
        position: regex,
        'equipment_items.0': { $exists: true },
      })
        .sort({ report_date: -1 })
        .lean();

      // กลุ่มตาม position (case-insensitive key → original case เก็บครั้งแรก)
      const positionMap = new Map();
      for (const rep of reports) {
        const pos = rep.position?.trim();
        if (!pos) continue;
        const key = pos.toLowerCase();
        if (!positionMap.has(key)) {
          positionMap.set(key, {
            position: pos,
            project_ids: new Set(),
            equipment_map: new Map(),
            latest_date: rep.report_date,
          });
        }
        const entry = positionMap.get(key);
        entry.project_ids.add(String(rep.project_id));
        for (const eq of (rep.equipment_items || [])) {
          if (!eq.equipment_no) continue;
          if (!entry.equipment_map.has(eq.equipment_no)) {
            entry.equipment_map.set(eq.equipment_no, {
              equipment_no: eq.equipment_no,
              equipment_type: eq.equipment_type || '',
              serial_no: eq.serial_no || '',
              last_date: rep.report_date,
            });
          }
        }
      }

      const results = [];
      for (const [, data] of positionMap) {
        const projectIds = [...data.project_ids];
        const projects = await Project.find({ _id: { $in: projectIds } }).select('title').lean();
        results.push({
          position: data.position,
          project_titles: projects.map((p) => p.title),
          equipment_list: [...data.equipment_map.values()],
          latest_date: data.latest_date,
        });
      }

      results.sort((a, b) => a.position.localeCompare(b.position, 'th'));
      return sendSuccess(res, results, 'ok');
    }

    return sendError(res, 400, 'mode ไม่ถูกต้อง (equipment_no หรือ position)');
  } catch (err) {
    logger.error('[Equipment] searchEquipment error:', err.message);
    return sendError(res, 500, 'เกิดข้อผิดพลาด');
  }
}

module.exports = { searchEquipment };
