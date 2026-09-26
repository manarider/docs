const mongoose = require('mongoose');

/**
 * ฟิลด์ย่อยที่จะโผล่มาเพิ่ม เมื่อผู้กรอกเลือกตัวเลือกใดตัวเลือกหนึ่งของ radio (conditional field)
 */
const subFieldSchema = new mongoose.Schema(
    {
        fieldId: { type: String, required: true, trim: true },
        label: { type: String, required: true, trim: true, maxlength: 200 },
        type: { type: String, enum: ['text', 'textarea', 'number'], default: 'textarea' },
        required: { type: Boolean, default: false },
    },
    { _id: false }
);

const tableColumnSchema = new mongoose.Schema(
    {
        columnId: { type: String, required: true, trim: true },
        label: { type: String, required: true, trim: true, maxlength: 200 },
        type: { type: String, enum: ['text', 'number', 'select'], default: 'text' },
        options: { type: [String], default: [] },
        required: { type: Boolean, default: false },
    },
    { _id: false }
);

const radioOptionSchema = new mongoose.Schema(
    {
        value: { type: String, required: true, trim: true, maxlength: 200 },
        fields: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },
    { _id: false }
);

/**
 * นิยามฟิลด์ของฟอร์มรายงาน — แบบ list ฟิลด์ธรรมดา (ไม่ใช่ visual PDF designer)
 */
const formFieldSchema = new mongoose.Schema(
    {
        fieldId: { type: String, required: true, trim: true },
        sourceFieldId: { type: String, default: null, trim: true },
        label: { type: String, required: true, trim: true, maxlength: 200 },
        type: {
            type: String,
            enum: ['text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'location', 'image', 'table'],
            default: 'text',
        },
        options: { type: [String], default: [] }, // สำหรับ type: select, radio, checkbox
        tableColumns: { type: [tableColumnSchema], default: [] },
        radioOptions: { type: [radioOptionSchema], default: [] },
        // สำหรับ type: radio — ฟอร์มย่อยที่แสดงเพิ่มเมื่อเลือกตัวเลือกนั้น (key = ค่าตัวเลือกใน options)
        radioSubFields: { type: Map, of: subFieldSchema, default: {} },
        required: { type: Boolean, default: false },
        maxImages: { type: Number, default: 4, min: 1, max: 10 }, // สำหรับ type: image
    },
    { _id: false }
);

radioOptionSchema.add({ fields: { type: [formFieldSchema], default: [] } });

/**
 * ฟอร์มการรายงานของแต่ละกลุ่มงาน — ต้องเลือกกลุ่มงานก่อนจึงสร้างฟอร์มได้
 */
const outsourcedReportFormSchema = new mongoose.Schema(
    {
        group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OutsourcedGroup', required: true },
        name: { type: String, required: true, trim: true, maxlength: 200 },
        version: { type: Number, default: 1, min: 1 },
        fields: {
            type: [formFieldSchema],
            default: [],
            validate: {
                validator: (v) => v.length > 0,
                message: 'ฟอร์มต้องมีอย่างน้อย 1 ฟิลด์',
            },
        },
        status: { type: String, enum: ['active', 'inactive'], default: 'active' },
        created_by: { type: mongoose.Schema.Types.ObjectId, required: true },
        updated_by: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    { timestamps: true }
);

outsourcedReportFormSchema.index({ group_id: 1, status: 1 });


module.exports = mongoose.model('OutsourcedReportForm', outsourcedReportFormSchema);
