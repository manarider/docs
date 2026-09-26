const { normalizeFields } = require('../src/modules/outsourced/form.controller');
const { validateAndCleanFields } = require('../src/modules/outsourced/report.controller');
const { generateOutsourcedReportPdf } = require('../src/modules/outsourced/outsourced.pdfGenerator');

describe('Outsourced nested form fields', () => {
    test('creates radio branches from options and syncs shared root field definitions', () => {
        const fields = normalizeFields([
            { fieldId: 'person-name', label: 'ชื่อ', type: 'text', required: true },
            {
                fieldId: 'has-people', label: 'มีรายชื่อหรือไม่', type: 'radio', options: ['มี', 'ไม่มี'],
                radioOptions: [
                    { value: 'มี', fields: [{ fieldId: 'shared-name', sourceFieldId: 'person-name', label: 'ชื่อเก่า', type: 'text' }] },
                    { value: 'ไม่มี', fields: [] },
                ],
            },
        ]);

        expect(fields[1].radioOptions.map((option) => option.value)).toEqual(['มี', 'ไม่มี']);
        expect(fields[1].radioOptions[0].fields[0]).toMatchObject({ label: 'ชื่อ', type: 'text', required: true });
        expect(fields[1].radioOptions[0].fields[0].sourceFieldId).toBe('person-name');
        expect(fields[1].radioOptions[1].fields).toEqual([]);
    });

    test('rejects tables without columns and radio fields without options', () => {
        expect(normalizeFields([{ fieldId: 'table', label: 'ตาราง', type: 'table' }])).toBeNull();
        expect(normalizeFields([{ fieldId: 'radio', label: 'ตัวเลือก', type: 'radio', options: [] }])).toBeNull();
        expect(normalizeFields([{ fieldId: 'radio', label: 'ตัวเลือก', type: 'radio', options: ['มี'], radioOptions: [{ value: 'มี', fields: [{ fieldId: 'table', label: 'ตาราง', type: 'table', tableColumns: [] }] }] }])).toBeNull();
        expect(normalizeFields([{ fieldId: 'table', label: 'ตาราง', type: 'table', tableColumns: [{ columnId: 'status', label: 'สถานะ', type: 'select' }] }])).toBeNull();
    });

    test('cleans table rows and rejects unknown columns', () => {
        const cleanValues = {};
        const fields = [{
            fieldId: 'people', label: 'รายชื่อ', type: 'table', required: true,
            tableColumns: [
                { columnId: 'name', label: 'ชื่อ', type: 'text', required: true },
                { columnId: 'code', label: 'รหัส', type: 'number', required: false },
            ],
        }];

        const error = validateAndCleanFields(fields, { people: [{ name: 'สมชาย', code: '12', injected: 'drop' }] }, [], cleanValues);

        expect(error).toBeNull();
        expect(cleanValues.people).toEqual([{ name: 'สมชาย', code: 12 }]);
    });

    test('normalizes dropdown column options and rejects values outside the options', () => {
        const fields = normalizeFields([{
            fieldId: 'people', label: 'รายชื่อ', type: 'table',
            tableColumns: [{ columnId: 'status', label: 'สถานะ', type: 'select', options: ['ใช้งาน', 'ไม่ใช้งาน', 'ใช้งาน'] }],
        }]);
        expect(fields[0].tableColumns[0].options).toEqual(['ใช้งาน', 'ไม่ใช้งาน']);

        const error = validateAndCleanFields(fields, { people: [{ status: 'แอบเพิ่มค่า' }] }, [], {});
        expect(error).toContain('ไม่อยู่ในตัวเลือก');
    });

    test('validates required table columns and maximum row count', () => {
        const field = {
            fieldId: 'people', label: 'รายชื่อ', type: 'table',
            tableColumns: [{ columnId: 'name', label: 'ชื่อ', type: 'text', required: true }],
        };
        expect(validateAndCleanFields([field], { people: [{ name: '' }] }, [], {})).toContain('กรุณากรอก "ชื่อ"');
        expect(validateAndCleanFields([field], { people: Array.from({ length: 51 }, () => ({ name: 'x' })) }, [], {})).toContain('สูงสุด 50 แถว');
    });

    test('validates and cleans only the selected radio branch', () => {
        const fields = [{
            fieldId: 'has-people', label: 'มีรายชื่อหรือไม่', type: 'radio', required: true, options: ['มี', 'ไม่มี'],
            radioOptions: [{ value: 'มี', fields: [{ fieldId: 'people', label: 'รายชื่อ', type: 'table', tableColumns: [{ columnId: 'name', label: 'ชื่อ', type: 'text' }] }] }],
        }];
        const cleanValues = {};

        const error = validateAndCleanFields(fields, { 'has-people': 'ไม่มี', people: [{ name: 'ignored' }] }, [], cleanValues);

        expect(error).toBeNull();
        expect(cleanValues).toEqual({ 'has-people': 'ไม่มี' });
    });

    test('generates a PDF for a selected radio branch containing a table', async () => {
        const pdf = await generateOutsourcedReportPdf(
            { report_date: new Date(), submitted_by_username: 'tester', values: { present: 'มี', people: [{ name: 'สมชาย', code: 12 }] } },
            { name: 'รายงาน', fields: [{
                fieldId: 'present', label: 'มีรายชื่อหรือไม่', type: 'radio', options: ['มี', 'ไม่มี'],
                radioOptions: [{ value: 'มี', fields: [{ fieldId: 'people', label: 'รายชื่อ', type: 'table', tableColumns: [{ columnId: 'name', label: 'ชื่อ' }, { columnId: 'code', label: 'รหัส' }] }] }],
            }] },
            { name: 'ทดสอบ' }
        );

        expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe('%PDF');
    });
});