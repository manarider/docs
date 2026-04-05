const dayjs = require('dayjs');
const buddhistEra = require('dayjs/plugin/buddhistEra');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(buddhistEra);
dayjs.extend(customParseFormat);

const TZ = 'Asia/Bangkok';

/**
 * คำนวณปีงบประมาณไทย (1 ต.ค. – 30 ก.ย.)
 * เดือน ต.ค.–ธ.ค. (10–12) → ปีหน้า (ค.ศ.) | ม.ค.–ก.ย. (1–9) → ปีนี้
 * คืนเป็น BE (พ.ศ.)
 * @param {Date|string} [date] — ค่า default คือวันนี้
 * @returns {number} fiscal year (BE)
 */
const getFiscalYear = (date) => {
  const d = dayjs(date || new Date()).tz(TZ);
  const month = d.month() + 1; // dayjs: 0-based
  const yearCE = month >= 10 ? d.year() + 1 : d.year();
  return yearCE + 543; // convert to BE
};

/**
 * คืนวันเริ่มต้นและสิ้นสุดของปีงบประมาณ (BE)
 * @param {number} fiscalYearBE
 * @returns {{ start: Date, end: Date }}
 */
const getFiscalYearRange = (fiscalYearBE) => {
  const yearCE = fiscalYearBE - 543;
  return {
    start: dayjs.tz(`${yearCE - 1}-10-01`, TZ).toDate(),
    end: dayjs.tz(`${yearCE}-09-30T23:59:59`, TZ).toDate(),
  };
};

module.exports = { getFiscalYear, getFiscalYearRange };
