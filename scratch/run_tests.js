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

// 5. User-Requested Goal Tests
test('User Goal: Single-line comments sequential with statement on next line', () => {
  const input = `select 1;\n\n-- comment\n-- comment 2\nselect 2;\n\n--comment3\nselect 3;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    1;\n\n-- comment\n-- comment 2\nSELECT\n    2;\n\n--comment3\nSELECT\n    3;\n`;
  assert.strictEqual(result, expected);
});

test('User Goal: Multi-line block comment has blank line before and after', () => {
  const input = `select 1;\n\n/*\nmany\nlines\ncomment\n*/\n\nselect 2;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    1;\n\n/*\nmany\nlines\ncomment\n*/\n\nSELECT\n    2;\n`;
  assert.strictEqual(result, expected);
});

test('Comments inside CTEs: standalone comments correctly formatted', () => {
  const input = `WITH cte AS (\n-- comment inside CTE\nSELECT id FROM users\n)\n-- comment after CTE\nSELECT * FROM cte;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `WITH cte AS (\n\n    -- comment inside CTE\n    SELECT\n        id\n    FROM users\n)\n\n-- comment after CTE\nSELECT\n    *\nFROM cte;\n`;
  assert.strictEqual(result, expected);
});

test('Comments inside IF/ELSE blocks', () => {
  const input = `IF @x = 1\nBEGIN\nSELECT 1;\nEND\n-- comment before ELSE\nELSE\nBEGIN\nSELECT 2;\nEND`;
  const result = formatTsql(input, defaultOptions);
  const expected = `IF @x = 1\nBEGIN\n    SELECT\n        1;\nEND\n\n-- comment before ELSE\nELSE\nBEGIN\n    SELECT\n        2;\nEND\n`;
  assert.strictEqual(result, expected);
});

test('Inline trailing comment vs standalone line comment', () => {
  const input = `SELECT id, name -- inline comment\n-- standalone comment\nFROM users;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    id,\n    name -- inline comment\n\n    -- standalone comment\nFROM users;\n`;
  assert.strictEqual(result, expected);
});

// 6. Comprehensive T-SQL Keywords & Vector Functions Tests
test('DROP IF EXISTS variants formatting', () => {
  const input = `drop procedure if exists dbo.sp_test; drop function if exists dbo.fn_test; drop view if exists dbo.vw_test;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `DROP PROCEDURE IF EXISTS dbo.sp_test;\n\n\nDROP FUNCTION IF EXISTS dbo.fn_test;\n\n\nDROP VIEW IF EXISTS dbo.vw_test;\n`;
  assert.strictEqual(result, expected);
});

test('Vector data types and vector functions (SQL Server 2025)', () => {
  const input = `declare @v vector(1536); select vector_distance('cosine', @v, @v) as dist;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `DECLARE @v VECTOR(1536);\n\n\nSELECT\n    VECTOR_DISTANCE('cosine', @v, @v) AS dist;\n`;
  assert.strictEqual(result, expected);
});

test('BULK INSERT and REVERT statements', () => {
  const input = `revert; bulk insert dbo.users from 'c:\\data.csv' with (firstrow = 2);`;
  const result = formatTsql(input, defaultOptions);
  const expected = `REVERT;\n\n\nBULK INSERT dbo.users FROM 'c:\\data.csv' WITH (firstrow = 2);\n`;
  assert.strictEqual(result, expected);
});

test('Performance benchmark: 1000 SQL statements formatted rapidly', () => {
  const statement = `SELECT id, name, created_at FROM users WHERE active = 1 AND age >= 18 ORDER BY id DESC;\n`;
  const largeScript = statement.repeat(1000);
  const start = Date.now();
  const result = formatTsql(largeScript, defaultOptions);
  const duration = Date.now() - start;
  assert.ok(result.length > 0);
  console.log(`  └─ Formatted 1000 queries (${largeScript.length} chars) in ${duration}ms`);
});

// 7. Advanced Syntax & Edge Cases
test('Hexadecimal constants: 0x... preserved without splitting', () => {
  const input = `select 0x12AF, 0x00 from dbo.BinTable;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    0x12AF,\n    0x00\nFROM dbo.BinTable;\n`;
  assert.strictEqual(result, expected);
});

test('Compound assignment operators: +=, -=, *=, /= preserved as single tokens', () => {
  const input = `set @i += 1; set @x -= 2;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SET @i += 1;\n\n\nSET @x -= 2;\n`;
  assert.strictEqual(result, expected);
});

test('Scope resolution operator :: for HierarchyID / CLR methods', () => {
  const input = `select hierarchyid::GetRoot();`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    HIERARCHYID::GetRoot();\n`;
  assert.strictEqual(result, expected);
});

test('Unicode / international identifier support', () => {
  const input = `select id, preço, código from comércio;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    id,\n    preço,\n    código\nFROM comércio;\n`;
  assert.strictEqual(result, expected);
});

test('Nested block comments correctly tracked', () => {
  const input = `/* outer /* inner */ still comment */ select 1;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `/* outer /* inner */ still comment */\n\nSELECT\n    1;\n`;
  assert.strictEqual(result, expected);
});

test('Bracketed identifiers with escaped ]] brackets', () => {
  const input = `select [My]]Column] from [dbo].[My]]Table];`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    [My]]Column]\nFROM [dbo].[My]]Table];\n`;
  assert.strictEqual(result, expected);
});

test('MERGE statement formatted with clause breaks and indentation', () => {
  const input = `merge into dbo.Target as t using dbo.Source as s on t.id = s.id when matched then update set t.val = s.val when not matched then insert (id, val) values (s.id, s.val);`;
  const result = formatTsql(input, defaultOptions);
  const expected = `MERGE INTO dbo.Target AS t\nUSING dbo.Source AS s\n    ON t.id = s.id\nWHEN MATCHED THEN\n    UPDATE SET t.val = s.val\nWHEN NOT MATCHED THEN\n    INSERT (id, val)\n    VALUES (s.id, s.val);\n`;
  assert.strictEqual(result, expected);
});

test('Table-valued functions in FROM and JOIN', () => {
  const input = `select * from dbo.GetUsers(@id) as u inner join dbo.GetOrders(u.id) as o on u.id = o.order_id;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    *\nFROM dbo.GetUsers(@id) AS u\nINNER JOIN dbo.GetOrders(u.id) AS o\n    ON u.id = o.order_id;\n`;
  assert.strictEqual(result, expected);
});

test('STRING_SPLIT and OPENROWSET table functions in FROM', () => {
  const input1 = `select * from string_split(@csv, ',') as s;`;
  const result1 = formatTsql(input1, defaultOptions);
  const expected1 = `SELECT\n    *\nFROM STRING_SPLIT(@csv, ',') AS s;\n`;
  assert.strictEqual(result1, expected1);

  const input2 = `select * from openrowset('Microsoft.ACE.OLEDB.12.0', '...') as r;`;
  const result2 = formatTsql(input2, defaultOptions);
  const expected2 = `SELECT\n    *\nFROM OPENROWSET('Microsoft.ACE.OLEDB.12.0', '...') AS r;\n`;
  assert.strictEqual(result2, expected2);
});

test('Comma-separated tables in FROM clause', () => {
  const input = `select * from dbo.Users u, dbo.Orders o where u.id = o.order_id;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    *\nFROM dbo.Users u,\n    dbo.Orders o\nWHERE u.id = o.order_id;\n`;
  assert.strictEqual(result, expected);
});

test('PIVOT clause formatting', () => {
  const input = `select * from PivotTest pivot (count(id) for col in ([A], [B])) as pvt;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    *\nFROM PivotTest\nPIVOT (COUNT(id) FOR col IN ([A], [B])) AS pvt;\n`;
  assert.strictEqual(result, expected);
});

test('ALTER TABLE with ALTER COLUMN preserved in same statement', () => {
  const input = `alter table dbo.Users alter column Email nvarchar(320) not null;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `ALTER TABLE dbo.Users ALTER COLUMN Email NVARCHAR(320) NOT NULL;\n`;
  assert.strictEqual(result, expected);
});

test('CREATE INDEX with WITH options not broken into separate statement', () => {
  const input = `create index IX_Orders on dbo.Orders (CustomerID) with (data_compression = page, online = on);`;
  const result = formatTsql(input, defaultOptions);
  const expected = `CREATE INDEX IX_Orders ON dbo.Orders (CustomerID) WITH (DATA_COMPRESSION = PAGE, ONLINE = ON);\n`;
  assert.strictEqual(result, expected);
});

test('IDENTITY(seed, increment) has no space before (', () => {
  const input = `create table dbo.T ( id int identity(1, 1) not null );`;
  const result = formatTsql(input, defaultOptions);
  const expected = `CREATE TABLE dbo.T (\n    id INT IDENTITY(1, 1) NOT NULL\n);\n`;
  assert.strictEqual(result, expected);
});

test('Bitwise NOT ~ without space before operand', () => {
  const input = `select ~flags from bit_table;`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    ~flags\nFROM bit_table;\n`;
  assert.strictEqual(result, expected);
});

test('Single-row INSERT INTO ... VALUES places row on new line indented beneath VALUES', () => {
  const input = `insert into dbo.Users (id, name) values (1, 'Alice');`;
  const result = formatTsql(input, defaultOptions);
  const expected = `INSERT INTO dbo.Users (id, name)\nVALUES\n    (1, 'Alice');\n`;
  assert.strictEqual(result, expected);
});

test('Multi-row INSERT INTO ... VALUES aligns all rows at the same indent level', () => {
  const input = `insert into dbo.Users (id, name) values (1, 'Alice'), (2, 'Bob'), (3, 'Charlie');`;
  const result = formatTsql(input, defaultOptions);
  const expected = `INSERT INTO dbo.Users (id, name)\nVALUES\n    (1, 'Alice'),\n    (2, 'Bob'),\n    (3, 'Charlie');\n`;
  assert.strictEqual(result, expected);
});

test('Multi-row INSERT INTO ... VALUES with 100 rows aligns every row at 4 spaces (no staircase indent)', () => {
  const rows = Array.from(
    { length: 100 },
    (_, i) => `(${i + 1}, 'User_${i + 1}', 'user${i + 1}@example.com')`,
  );
  const input = `INSERT INTO dbo.Users (id, username, email) VALUES ${rows.join(', ')};`;
  const result = formatTsql(input, defaultOptions);
  const lines = result.trimEnd().split('\n');
  assert.strictEqual(lines[0], 'INSERT INTO dbo.Users (id, username, email)');
  assert.strictEqual(lines[1], 'VALUES');
  assert.strictEqual(lines.length, 102);
  for (let i = 0; i < 100; i++) {
    const suffix = i < 99 ? ',' : ';';
    assert.strictEqual(
      lines[i + 2],
      `    (${i + 1}, 'User_${i + 1}', 'user${i + 1}@example.com')${suffix}`,
      `Row ${i + 1} should be indented by exactly 4 spaces`,
    );
  }
});

test('Derived table (VALUES ...) in FROM clause aligns rows consistently', () => {
  const input = `select * from (values (1, 'A'), (2, 'B')) as t(id, code);`;
  const result = formatTsql(input, defaultOptions);
  const expected = `SELECT\n    *\nFROM (\n    VALUES\n        (1, 'A'),\n        (2, 'B')\n) AS t(id, code);\n`;
  assert.strictEqual(result, expected);
});

if (process.exitCode === 1) {
  console.error('\nSome tests failed.');
  process.exit(1);
} else {
  console.log('\nAll tests passed successfully!');
}
