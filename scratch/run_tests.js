const assert = require('assert');
const { formatTsql } = require('../out/formatter');

const defaultOptions = {
  breakOnKeywords: true,
  identifierCase: 'preserve',
  keywordCase: 'upper',
  linesBetweenQueries: 2,
  maxLineLength: 100,
  useBrackets: false,
  useMaxLineLength: true,
};

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('--- Running T-SQL Formatter Test Suite ---\n');

// 1. Single Line Comment Rules
test('Single-line comment: blank line before, no blank line after', () => {
  const input = `SELECT 1;\n-- single comment\nSELECT 2;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    1;\n\n-- single comment\nSELECT\n    2;\n`;
  assert.strictEqual(result, expected);
});

test('Sequential single-line comments: grouped together, blank line before first, last above code', () => {
  const input = `SELECT 1;\n-- comment 1\n-- comment 2\n-- comment 3\nSELECT 2;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    1;\n\n-- comment 1\n-- comment 2\n-- comment 3\nSELECT\n    2;\n`;
  assert.strictEqual(result, expected);
});

// 2. Block Comment Rules
test('Multi-line block comment: blank line before AND after', () => {
  const input = `SELECT 1;\n/* block comment */\nSELECT 2;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    1;\n\n/* block comment */\n\nSELECT\n    2;\n`;
  assert.strictEqual(result, expected);
});

test('Mixed comments: single and block comments combined', () => {
  const input = `SELECT 1;\n-- comment 1\n/* block comment */\n-- comment 2\nSELECT 2;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    1;\n\n-- comment 1\n\n/* block comment */\n\n-- comment 2\nSELECT\n    2;\n`;
  assert.strictEqual(result, expected);
});

// 3. Comments inside SELECT columns
test('Single-line comment before column in SELECT list', () => {
  const input = `SELECT id,\n-- comment for name\nname FROM users;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    id,\n\n    -- comment for name\n    name\nFROM users;\n`;
  assert.strictEqual(result, expected);
});

// 4. Modern T-SQL Multi-word Keywords & Statements
test('CREATE OR ALTER PROCEDURE statement', () => {
  const input = `create or alter procedure dbo.GetUsers as select id from users;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `CREATE OR ALTER PROCEDURE dbo.GetUsers AS\n\n\nSELECT\n    id\nFROM users;\n`;
  assert.strictEqual(result, expected);
});

test('DROP TABLE IF EXISTS statement', () => {
  const input = `drop table if exists dbo.users; select 1;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `DROP TABLE IF EXISTS dbo.users;\n\n\nSELECT\n    1;\n`;
  assert.strictEqual(result, expected);
});

test('Transactions: SAVE TRAN and COMMIT WORK', () => {
  const input = `begin tran; save tran point1; commit work;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `BEGIN TRAN;\n\n\nSAVE TRAN point1;\n\n\nCOMMIT WORK;\n`;
  assert.strictEqual(result, expected);
});

test('CTEs (WITH ... AS) and Subqueries', () => {
  const input = `with cte as (select id from users) select * from cte;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `WITH cte AS (\n    SELECT\n        id\n    FROM users\n)\nSELECT\n    *\nFROM cte;\n`;
  assert.strictEqual(result, expected);
});

test('CASE expressions', () => {
  const input = `select case when active = 1 then 'Yes' else 'No' end as isActive from users;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    CASE WHEN active = 1 THEN 'Yes' ELSE 'No' END AS isActive\nFROM users;\n`;
  assert.strictEqual(result, expected);
});

test('Keyword Casing: lower', () => {
  const opts = { ...defaultOptions, keywordCase: 'lower' };
  const input = `SELECT id FROM users WHERE active = 1;`;
  const result = formatTsql(input, opts);
  const expected = `select\n    id\nfrom users\nwhere active = 1;\n`;
  assert.strictEqual(result, expected);
});

test('Brackets setting: useBrackets = true', () => {
  const opts = { ...defaultOptions, useBrackets: true };
  const input = `select id, @var, #temp from users;`;
  const result = formatTsql(input, opts);
  const expected = `SELECT\n    [id],\n    @var,\n    #temp\nFROM [users];\n`;
  assert.strictEqual(result, expected);
});

if (process.exitCode === 1) {
  console.error('\nSome tests failed.');
  process.exit(1);
} else {
  console.log('\nAll tests passed successfully!');
}
