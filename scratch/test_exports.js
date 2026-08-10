const { formatTsql } = require('../out/formatter');

// If formatTsql is not exported, let's check what is exported:
const formatter = require('../out/formatter');
console.log('Exported keys:', Object.keys(formatter));
