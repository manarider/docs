const { normalizeFields } = require('../src/modules/outsourced/form.controller');
const { validateAndCleanFields, listReports, getReport, viewReportPhoto, downloadReportPdf, previewReportImage } = require('../src/modules/outsourced/report.controller');
const OutsourcedReport = require('../src/models/OutsourcedReport');
const OutsourcedGroup = require('../src/models/OutsourcedGroup');
const OutsourcedReportForm = require('../src/models/OutsourcedReportForm');
const OutsourcedReportFormVersion = require('../src/models/OutsourcedReportFormVersion');
const { generateOutsourcedReportPdf } = require('../src/modules/outsourced/outsourced.pdfGenerator');
const { PDFDocument, PDFPage } = require('pdf-lib');
const fsSync = require('fs');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const config = require('../src/config');

describe('Outsourced report image preview', () => {
    test('resizes uploaded images to JPEG and removes the temporary file after sending', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'outsourced-preview-'));
        const filePath = path.join(directory, 'preview.png');
        const sharp = require('sharp');
        const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#cc4422' } }).png().toBuffer();
        await fs.writeFile(filePath, image);
        let sentImage;
        const response = {
            headersSent: false,
            set: jest.fn(),
            sendFile: jest.fn((sentPath, callback) => {
                sentImage = fsSync.readFileSync(sentPath);
                callback();
                return response;
            }),
        };

        try {
            await previewReportImage({ files: [{ path: filePath }] }, response);

            expect(response.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
            expect(sentImage.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
            expect(fsSync.existsSync(path.join(directory, 'preview.jpg'))).toBe(false);
        } finally {
            await fs.rm(directory, { recursive: true, force: true });
        }
    });
});

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
        const textSpy = jest.spyOn(PDFPage.prototype, 'drawText');
        const rectangleSpy = jest.spyOn(PDFPage.prototype, 'drawRectangle');
        try {
            const pdf = await generateOutsourcedReportPdf(
                { report_date: new Date(), submitted_by_username: 'tester', values: { present: 'มี', detail: 'ตรวจสอบแล้ว', code: 'AB-123', people: [{ name: 'สมชาย', code: 12 }] } },
                { name: 'รายงาน', fields: [{
                    fieldId: 'present', label: 'มีรายชื่อหรือไม่', type: 'radio', options: ['มี', 'ไม่มี'],
                    radioOptions: [{ value: 'มี', fields: [
                        { fieldId: 'detail', label: 'รายละเอียด', type: 'text' },
                        { fieldId: 'code', label: 'รหัสงาน', type: 'text' },
                        { fieldId: 'people', label: 'รายชื่อ', type: 'table', tableColumns: [{ columnId: 'name', label: 'ชื่อ' }, { columnId: 'code', label: 'รหัส' }] },
                    ] }],
                }] },
                { name: 'ทดสอบ' }
            );

            expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe('%PDF');
            const detailHeading = textSpy.mock.calls.find(([text]) => text === 'รายละเอียด')[1];
            const codeHeading = textSpy.mock.calls.find(([text]) => text === 'รหัสงาน')[1];
            const detailValue = textSpy.mock.calls.find(([text]) => text === 'ตรวจสอบแล้ว')[1];
            const recorderIndex = textSpy.mock.calls.findIndex(([text]) => text === 'tester');
            const summaryIndex = textSpy.mock.calls.findIndex(([text]) => text === 'สรุปการปฏิบัติงาน:');
            const recorderCalls = textSpy.mock.calls.filter(([text]) => text === 'tester');
            expect(codeHeading.x).toBeGreaterThan(detailHeading.x);
            expect(codeHeading.y).toBe(detailHeading.y);
            expect(detailValue.y).toBeLessThan(detailHeading.y);
            expect(detailValue.color.blue).toBeGreaterThan(0.7);
            expect(recorderIndex).toBeLessThan(summaryIndex);
            expect(recorderCalls).toHaveLength(1);
            expect(recorderCalls[0][1].color).toMatchObject({ red: 0, green: 0, blue: 0 });
            expect(recorderCalls[0][1].font.name).toBe('THSarabunPSK-Bold');
            expect(textSpy.mock.calls.some(([text, options]) => text.startsWith('เรียน') && options.y < 710)).toBe(true);
            expect(textSpy.mock.calls.some(([text, options]) => text.startsWith('รายงานการส่งมอบงานประจำวัน') && options.x > 50)).toBe(true);
            expect(rectangleSpy.mock.calls.some(([options]) => options?.color?.red === 0.84)).toBe(false);
        } finally {
            textSpy.mockRestore();
            rectangleSpy.mockRestore();
        }
    });

    test('places before and after photos using the dynamic photo grid (up to 12 per page)', async () => {
        const imagePath = path.join(config.storage.basePath, '_outsourced', 'test.png');
        const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');
        const readFile = fs.readFile.bind(fs);
        const readSpy = jest.spyOn(fs, 'readFile').mockImplementation((filePath) => filePath === imagePath ? Promise.resolve(image) : readFile(filePath));

        try {
            const pdf = await generateOutsourcedReportPdf(
                {
                    report_date: new Date(), values: {}, photos: {
                        before: Array.from({ length: 5 }, () => ({ file_path: imagePath })),
                        after: [{ file_path: imagePath }],
                    },
                },
                { name: 'รายงาน', fields: [
                    { fieldId: 'before', label: 'ภาพก่อนการปฏิบัติงาน', type: 'image' },
                    { fieldId: 'after', label: 'ภาพหลังการปฏิบัติงาน', type: 'image' },
                ] },
                { name: 'กลุ่มงาน' }
            );

            // หน้าเนื้อหา 1 + ภาพก่อน (5 ภาพ พอดีในตาราง 3x4 หน้าเดียว) 1 + ภาพหลัง (1 ภาพ) 1 = 3
            expect((await PDFDocument.load(pdf)).getPageCount()).toBe(3);
            expect(readSpy).toHaveBeenCalledTimes(8);
        } finally {
            readSpy.mockRestore();
        }
    });

    test('omits photo pages when no images were uploaded', async () => {
        const pdf = await generateOutsourcedReportPdf(
            { report_date: new Date(), values: {}, photos: {} },
            { name: 'รายงาน', fields: [{ fieldId: 'before', label: 'ภาพก่อนการปฏิบัติงาน', type: 'image' }] },
            { name: 'กลุ่มงาน' }
        );

        expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
    });

    test('leaves clear space between a table and the following note', async () => {
        const textSpy = jest.spyOn(PDFPage.prototype, 'drawText');
        const rectangleSpy = jest.spyOn(PDFPage.prototype, 'drawRectangle');
        try {
            await generateOutsourcedReportPdf(
                { values: { items: [{ name: 'รายการ' }], note: 'ข้อมูลเพิ่มเติม' } },
                { name: 'รายงาน', fields: [
                    { fieldId: 'items', label: 'รายการ', type: 'table', tableColumns: [{ columnId: 'name', label: 'ชื่อ' }] },
                    { fieldId: 'note', label: 'ข้อมูลเพิ่มเติมอื่น', type: 'text' },
                ] },
                { name: 'กลุ่มงาน' }
            );

            const noteHeading = textSpy.mock.calls.find(([text]) => text === 'ข้อมูลเพิ่มเติมอื่น:')[1];
            const tableRows = rectangleSpy.mock.calls.map(([options]) => options).filter((options) => options?.height === 24);
            expect(tableRows.length).toBeGreaterThan(0);
            expect(tableRows.at(-1).y - noteHeading.y).toBeGreaterThan(40);
        } finally {
            textSpy.mockRestore();
            rectangleSpy.mockRestore();
        }
    });
});

describe('Outsourced report visibility and filters', () => {
    afterEach(() => jest.restoreAllMocks());

    const response = () => ({ json: jest.fn(), status: jest.fn().mockReturnThis() });
    const mockReports = () => {
        const query = { select: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
        const find = jest.spyOn(OutsourcedReport, 'find').mockReturnValue(query);
        const count = jest.spyOn(OutsourcedReport, 'countDocuments').mockResolvedValue(0);
        return { find, count };
    };

    test('limits staff to their reports and uses Bangkok fiscal boundaries', async () => {
        const { find, count } = mockReports();
        const res = response();
        await listReports({ params: { groupId: 'group' }, user: { role: 'staff', userId: 'owner' }, query: { fiscalYear: '2569' } }, res);

        expect(find.mock.calls[0][0]).toMatchObject({ group_id: 'group', submitted_by_user: 'owner', report_date: { $gte: new Date('2025-09-30T17:00:00Z'), $lt: new Date('2026-09-30T17:00:00Z') } });
        expect(count.mock.calls[0][0]).toEqual(find.mock.calls[0][0]);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ pagination: expect.objectContaining({ total: 0 }) }));
    });

    test('lets admins see all reports and narrows October to the prior calendar year', async () => {
        const { find } = mockReports();
        await listReports({ params: { groupId: 'group' }, user: { role: 'admin', userId: 'admin' }, query: { fiscalYear: '2569', month: '10' } }, response());
        expect(find.mock.calls[0][0]).toEqual({ group_id: 'group', report_date: { $gte: new Date('2025-09-30T17:00:00Z'), $lt: new Date('2025-10-31T17:00:00Z') } });
    });

    test('searches report fields, nested table cells, usernames and form names before pagination', async () => {
        const { find } = mockReports();
        jest.spyOn(OutsourcedReportForm, 'find').mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{
            _id: 'form', name: 'ตรวจสอบ', fields: [{ fieldId: 'radio', type: 'radio', radioOptions: [{ value: 'มี', fields: [{ fieldId: 'items', type: 'table', tableColumns: [{ columnId: 'name' }] }] }] }],
        }]) });
        jest.spyOn(OutsourcedReportFormVersion, 'find').mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) });
        await listReports({ params: { groupId: 'group' }, user: { role: 'staff', userId: 'owner' }, query: { search: 'ตรวจสอบ' } }, response());

        const filter = find.mock.calls[0][0];
        expect(filter.submitted_by_user).toBe('owner');
        expect(filter.$or).toEqual(expect.arrayContaining([
            { submitted_by_username: /ตรวจสอบ/i }, { form_id: { $in: ['form'] } }, { 'values.items.name': /ตรวจสอบ/i },
        ]));
    });

    test('matches numeric values inside report tables', async () => {
        const { find } = mockReports();
        jest.spyOn(OutsourcedReportForm, 'find').mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{
            _id: 'form', name: 'รายงาน', fields: [{ fieldId: 'rows', type: 'table', tableColumns: [{ columnId: 'amount', type: 'number' }] }],
        }]) });
        jest.spyOn(OutsourcedReportFormVersion, 'find').mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) });
        await listReports({ params: { groupId: 'group' }, user: { role: 'staff', userId: 'owner' }, query: { search: '12' } }, response());
        expect(find.mock.calls[0][0].$or).toContainEqual({ 'values.rows.amount': 12 });
    });

    test('scopes direct report reads to the owner', async () => {
        const query = { select: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) };
        const findOne = jest.spyOn(OutsourcedReport, 'findOne').mockReturnValue(query);
        await getReport({ params: { groupId: 'group', reportId: 'report' }, user: { role: 'manager', userId: 'owner' } }, response());
        expect(findOne).toHaveBeenCalledWith({ _id: 'report', group_id: 'group', submitted_by_user: 'owner' });
    });

    test('scopes photo and PDF downloads to the owner', async () => {
        const query = { select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) };
        const findOne = jest.spyOn(OutsourcedReport, 'findOne').mockReturnValue(query);
        jest.spyOn(OutsourcedGroup, 'findOne').mockReturnValue({ lean: jest.fn().mockResolvedValue({ name: 'กลุ่มงาน' }) });
        const request = { params: { groupId: 'group', reportId: 'report', fieldId: 'image', index: '0' }, user: { role: 'staff', userId: 'owner' } };
        await viewReportPhoto(request, response());
        await downloadReportPdf(request, response());
        expect(findOne).toHaveBeenCalledTimes(2);
        expect(findOne.mock.calls[0][0]).toEqual({ _id: 'report', group_id: 'group', submitted_by_user: 'owner' });
        expect(findOne.mock.calls[1][0]).toEqual(findOne.mock.calls[0][0]);
    });
});