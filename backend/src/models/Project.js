const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    document_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      unique: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 1000 },
    dept_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    fiscal_year: { type: Number, required: true },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    storage_base: { type: String, required: true }, // absolute path to project folder
    created_by: { type: mongoose.Schema.Types.ObjectId, required: true },

    // ข้อมูลเพิ่มเติมของโครงการ
    location: { type: String, default: '', trim: true }, // สถานที่ดำเนินการ
    district: { type: String, default: '', trim: true }, // อำเภอ
    province: { type: String, default: '', trim: true }, // จังหวัด
    phone: { type: String, default: '', trim: true }, // โทรศัพท์
    work_volume: { type: String, default: '', trim: true }, // ปริมาณงาน
    quantity: { type: String, default: '', trim: true }, // จำนวน
    contract_no: { type: String, default: '', trim: true }, // สัญญาเลขที่
    contract_date: { type: String, default: '', trim: true }, // ลงวันที่
    contract_month: { type: String, default: '', trim: true }, // เดือน
    contract_year: { type: String, default: '', trim: true }, // พ.ศ.
    start_date: { type: String, default: '', trim: true }, // เริ่มสัญญาวันที่
    end_date: { type: String, default: '', trim: true }, // สิ้นสุดสัญญาวันที่
    budget: { type: String, default: '', trim: true }, // วงเงินโครงการ
    contractor: { type: String, default: '', trim: true }, // ผู้รับจ้าง
    duration: { type: String, default: '', trim: true }, // ระยะเวลาดำเนินการ

    // รายชื่อคณะกรรมการ & ผู้ควบคุมงาน
    supervisor: { type: String, default: '', trim: true }, // ผู้ควบคุมงาน
    committee_chairman: { type: String, default: '', trim: true }, // ประธานกรรมการ
    committee_member_1: { type: String, default: '', trim: true }, // กรรมการ_1
    committee_member_2: { type: String, default: '', trim: true }, // กรรมการ_2
  },
  { timestamps: true }
);

projectSchema.index({ dept_id: 1, fiscal_year: 1 });
projectSchema.index({ status: 1 });

module.exports = mongoose.model('Project', projectSchema);
