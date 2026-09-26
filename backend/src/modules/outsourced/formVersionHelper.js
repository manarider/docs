const OutsourcedReportFormVersion = require('../../models/OutsourcedReportFormVersion');

async function ensureFormVersion(form, version = form.version || 1) {
    const definition = form.toObject ? form.toObject({ flattenMaps: true }) : form;
    await OutsourcedReportFormVersion.updateOne(
        { form_id: form._id, version },
        { $setOnInsert: { name: definition.name, fields: definition.fields } },
        { upsert: true }
    );
}

module.exports = { ensureFormVersion };