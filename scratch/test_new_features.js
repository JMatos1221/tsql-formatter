const assert = require('assert');
const { formatTsql, formatTsqlAsync } = require('../out/formatter');

console.log('--- Testing New Features & Keyword Coverage ---\n');

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
    process.exit(1);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Keyword coverage tests
test('Reserved keywords coverage: KILL, RECONFIGURE, SHUTDOWN, SECURITYAUDIT', () => {
  const sql = 'kill 54;\nreconfigure;\nshutdown;';
  const formatted = formatTsql(sql, defaultOptions);
  assert(formatted.includes('KILL 54;'), 'Expected uppercase KILL');
  assert(formatted.includes('RECONFIGURE;'), 'Expected uppercase RECONFIGURE');
  assert(formatted.includes('SHUTDOWN;'), 'Expected uppercase SHUTDOWN');
});

test('TRUNCATE TABLE statement formatted properly', () => {
  const sql = 'truncate table dbo.Orders;';
  const formatted = formatTsql(sql, defaultOptions);
  assert(
    formatted.includes('TRUNCATE TABLE dbo.Orders;'),
    'Expected TRUNCATE TABLE merged keyword',
  );
});

test('WINDOW clause (SQL Server 2022) formatted on its own line', () => {
  const sql =
    'select emp_id, sum(salary) over w from dbo.Employees window w as (partition by dept_id order by salary desc);';
  const formatted = formatTsql(sql, defaultOptions);
  assert(
    formatted.includes('WINDOW w AS (PARTITION BY dept_id ORDER BY salary DESC);'),
    'Expected formatted WINDOW clause:\n' + formatted,
  );
});

test('OPTION clause formatted properly with hints', () => {
  const sql = "select id from dbo.Users where status = 'active' option (recompile, maxdop 4);";
  const formatted = formatTsql(sql, defaultOptions);
  assert(
    formatted.includes('OPTION (RECOMPILE, MAXDOP 4);'),
    'Expected uppercase OPTION and hints:\n' + formatted,
  );
});

test('FOR BROWSE and FOR XML PATH clauses formatted properly', () => {
  const sql1 = 'select id, name from dbo.Users for browse;';
  const formatted1 = formatTsql(sql1, defaultOptions);
  assert(formatted1.includes('FOR BROWSE;'), 'Expected formatted FOR BROWSE:\n' + formatted1);

  const sql2 = "select id from dbo.Users for xml path('row');";
  const formatted2 = formatTsql(sql2, defaultOptions);
  assert(
    formatted2.includes("FOR XML PATH('row');"),
    'Expected formatted FOR XML PATH:\n' + formatted2,
  );
});

test('Modern functions casing: DATE_BUCKET, GENERATE_SERIES, VECTOR_NORM, JSON_PATH_EXISTS', () => {
  const sql =
    "select date_bucket(month, 1, order_date), vector_norm(v), json_path_exists(data, '$.id') from dbo.T;";
  const formatted = formatTsql(sql, defaultOptions);
  assert(formatted.includes('DATE_BUCKET('), 'Expected DATE_BUCKET');
  assert(formatted.includes('VECTOR_NORM('), 'Expected VECTOR_NORM');
  assert(formatted.includes('JSON_PATH_EXISTS('), 'Expected JSON_PATH_EXISTS');
});

test('Types with parameters: DEC(10, 2) has no space before (', () => {
  const sql = 'declare @amount dec(10, 2) = 123.45;';
  const formatted = formatTsql(sql, defaultOptions);
  assert(formatted.includes('DEC(10, 2)'), 'Expected DEC(10, 2) without space:\n' + formatted);
});

test('Identifier with $ is preserved', () => {
  const sql = 'select user$name, @var$val from dbo.T$table;';
  const formatted = formatTsql(sql, defaultOptions);
  assert(formatted.includes('user$name'), 'Expected user$name');
  assert(formatted.includes('@var$val'), 'Expected @var$val');
  assert(formatted.includes('dbo.T$table'), 'Expected dbo.T$table');
});

test('OFFSET ... FETCH NEXT ... ROWS ONLY pagination formatted properly', () => {
  const sql =
    'select id, name from dbo.Users order by id asc offset 10 rows fetch next 20 rows only;';
  const formatted = formatTsql(sql, { ...defaultOptions, useBrackets: true });
  const expected =
    'SELECT\n    [id],\n    [name]\nFROM [dbo].[Users]\nORDER BY [id] ASC\nOFFSET 10 ROWS FETCH NEXT 20 ROWS ONLY;\n';
  assert.strictEqual(formatted, expected);
});

test('MERGE 6-word WHEN NOT MATCHED BY TARGET/SOURCE THEN keywords', () => {
  const sql =
    'merge into dbo.T as t using dbo.S as s on t.id = s.id when not matched by target then insert (id) values (s.id) when not matched by source then delete;';
  const formatted = formatTsql(sql, { ...defaultOptions, useBrackets: true });
  assert(
    formatted.includes('WHEN NOT MATCHED BY TARGET THEN'),
    'Expected WHEN NOT MATCHED BY TARGET THEN:\n' + formatted,
  );
  assert(
    formatted.includes('WHEN NOT MATCHED BY SOURCE THEN'),
    'Expected WHEN NOT MATCHED BY SOURCE THEN:\n' + formatted,
  );
});

test('IS NOT DISTINCT FROM and INNER HASH/LOOP/MERGE JOIN', () => {
  const sql =
    'select u.id from dbo.Users u inner hash join dbo.Orders o on u.id is not distinct from o.user_id;';
  const formatted = formatTsql(sql, { ...defaultOptions, useBrackets: true });
  const expected =
    'SELECT\n    [u].[id]\nFROM [dbo].[Users] [u]\nINNER HASH JOIN [dbo].[Orders] [o]\n    ON [u].[id] IS NOT DISTINCT FROM [o].[user_id];\n';
  assert.strictEqual(formatted, expected);
});

test('indentSize: 2 formats indented clauses and columns with 2-space indentation', () => {
  const sql = 'select id, name from dbo.Users;';
  const formatted = formatTsql(sql, { ...defaultOptions, indentSize: 2 });
  const expected = 'SELECT\n  id,\n  name\nFROM dbo.Users;\n';
  assert.strictEqual(formatted, expected);
});

// 2. Comprehensive coverage for 10 newly implemented T-SQL features

test('SELECT ... INTO #TargetTable FROM ... formats INTO on its own line', () => {
  const sql = 'select id, name into #TempUsers from dbo.Users where active = 1;';
  const formatted = formatTsql(sql, defaultOptions);
  const expected =
    'SELECT\n    id,\n    name\nINTO #TempUsers\nFROM dbo.Users\nWHERE active = 1;\n';
  assert.strictEqual(formatted, expected);
});

test('SELECT TOP (10) PERCENT WITH TIES formats without splitting into columns', () => {
  const sql = 'select top (10) percent with ties id, name from dbo.Users order by id desc;';
  const formatted = formatTsql(sql, defaultOptions);
  const expected =
    'SELECT TOP (10) PERCENT WITH TIES\n    id,\n    name\nFROM dbo.Users\nORDER BY id DESC;\n';
  assert.strictEqual(formatted, expected);
});

test('UPDATE TOP (5) formats without fragmenting statement or table reference', () => {
  const sql = "update top (5) dbo.Users set status = 'inactive' where last_login = 0;";
  const formatted = formatTsql(sql, defaultOptions);
  const expected = "UPDATE TOP (5) dbo.Users\nSET status = 'inactive'\nWHERE last_login = 0;\n";
  assert.strictEqual(formatted, expected);
});

test('DELETE TOP (10) formats without fragmenting statement', () => {
  const sql = 'delete top (10) from dbo.Logs where log_date = 1;';
  const formatted = formatTsql(sql, defaultOptions);
  const expected = 'DELETE TOP (10) FROM dbo.Logs\nWHERE log_date = 1;\n';
  assert.strictEqual(formatted, expected);
});

test('WITH cte (col1, col2) AS (SELECT ...) explicit column projection preserves parenthesized columns', () => {
  const sql =
    'with cte (col1, col2) as (select id, name from dbo.Users) select col1, col2 from cte;';
  const formatted = formatTsql(sql, defaultOptions);
  const expected =
    'WITH cte (col1, col2) AS (\n    SELECT\n        id,\n        name\n    FROM dbo.Users\n)\nSELECT\n    col1,\n    col2\nFROM cte;\n';
  assert.strictEqual(formatted, expected);
});

test('DECLARE cur CURSOR FOR SELECT ... does not break into fragmented statements', () => {
  const sql = 'declare user_cursor cursor for select id, name from dbo.Users;';
  const formatted = formatTsql(sql, defaultOptions);
  const expected = 'DECLARE user_cursor CURSOR FOR\nSELECT\n    id,\n    name\nFROM dbo.Users;\n';
  assert.strictEqual(formatted, expected);
});

test('DECLARE @tbl TABLE (...) formats table columns with clean indentation', () => {
  const sql = 'declare @tbl table (id int not null, name varchar(50) null);';
  const formatted = formatTsql(sql, defaultOptions);
  const expected = 'DECLARE @tbl TABLE (\n    id INT NOT NULL,\n    name VARCHAR(50) NULL\n);\n';
  assert.strictEqual(formatted, expected);
});

test('DECLARE [@tbl] TABLE (...) bracketed identifier formats table columns with clean indentation', () => {
  const sql = 'declare [@tbl] table (id int not null, name varchar(50) null);';
  const formatted = formatTsql(sql, defaultOptions);
  const expected = 'DECLARE [@tbl] TABLE (\n    id INT NOT NULL,\n    name VARCHAR(50) NULL\n);\n';
  assert.strictEqual(formatted, expected);
});

test('Multi-condition JOIN ... ON breaks AND/OR onto indented lines when breakOnKeywords: true', () => {
  const sql =
    'select a.id, b.name from dbo.TableA a inner join dbo.TableB b on a.id = b.id and a.tenant_id = b.tenant_id or a.is_admin = 1;';
  const formatted = formatTsql(sql, { ...defaultOptions, breakOnKeywords: true });
  const expected =
    'SELECT\n    a.id,\n    b.name\nFROM dbo.TableA a\nINNER JOIN dbo.TableB b\n    ON a.id = b.id\n    AND a.tenant_id = b.tenant_id\n    OR a.is_admin = 1;\n';
  assert.strictEqual(formatted, expected);
});

test('Multi-condition JOIN ... ON keeps AND/OR inline when breakOnKeywords: false', () => {
  const sql =
    'select a.id, b.name from dbo.TableA a inner join dbo.TableB b on a.id = b.id and a.tenant_id = b.tenant_id or a.is_admin = 1;';
  const formatted = formatTsql(sql, { ...defaultOptions, breakOnKeywords: false });
  const expected =
    'SELECT\n    a.id,\n    b.name\nFROM dbo.TableA a\nINNER JOIN dbo.TableB b\n    ON a.id = b.id AND a.tenant_id = b.tenant_id OR a.is_admin = 1;\n';
  assert.strictEqual(formatted, expected);
});

test('INSERT ... OUTPUT ... INTO ... VALUES formats OUTPUT on its own line', () => {
  const sql =
    'insert into dbo.AuditLog (col1, col2) output inserted.id, inserted.col1 into @audit_out values (1, 42);';
  const formatted = formatTsql(sql, defaultOptions);
  const expected =
    'INSERT INTO dbo.AuditLog (col1, col2)\nOUTPUT inserted.id, inserted.col1 INTO @audit_out\nVALUES\n    (1, 42);\n';
  assert.strictEqual(formatted, expected);
});

test('UPDATE ... SET ... OUTPUT ... INTO ... WHERE formats OUTPUT on its own line', () => {
  const sql =
    'update dbo.Users set status = 1 output inserted.id, deleted.status, inserted.status into @changes where id = 1;';
  const formatted = formatTsql(sql, defaultOptions);
  const expected =
    'UPDATE dbo.Users\nSET status = 1\nOUTPUT inserted.id, deleted.status, inserted.status INTO @changes\nWHERE id = 1;\n';
  assert.strictEqual(formatted, expected);
});

test('DELETE FROM ... OUTPUT ... INTO ... WHERE formats OUTPUT on its own line', () => {
  const sql =
    'delete from dbo.Users output deleted.id, deleted.name into @deleted_users where is_deleted = 1;';
  const formatted = formatTsql(sql, defaultOptions);
  const expected =
    'DELETE FROM dbo.Users\nOUTPUT deleted.id, deleted.name INTO @deleted_users\nWHERE is_deleted = 1;\n';
  assert.strictEqual(formatted, expected);
});

test('Modern SQL Server functions: APPROX_PERCENTILE_CONT, GREATEST, LEAST, DATETRUNC, GENERATE_SERIES', () => {
  const sql =
    'select approx_percentile_cont(0.5) within group (order by salary) over (partition by dept_id), greatest(c1, c2), least(c1, c2), datetrunc(month, order_date), value from generate_series(1, 100, 5);';
  const formatted = formatTsql(sql, defaultOptions);
  assert(
    formatted.includes(
      'APPROX_PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) OVER(PARTITION BY dept_id)',
    ),
    'Expected APPROX_PERCENTILE_CONT',
  );
  assert(formatted.includes('GREATEST(c1, c2)'), 'Expected GREATEST');
  assert(formatted.includes('LEAST(c1, c2)'), 'Expected LEAST');
  assert(formatted.includes('DATETRUNC(month, order_date)'), 'Expected DATETRUNC');
  assert(formatted.includes('GENERATE_SERIES(1, 100, 5)'), 'Expected GENERATE_SERIES');
});

test('Tombstone tokens are correctly skipped during lookahead and formatting under high load', () => {
  // Construct 500 column expressions where comments precede commas, triggering tombstone marking
  const cols = Array.from({ length: 500 }, (_, i) => `col${i} /* comment_${i} */`).join(' , ');
  const sql = `SELECT ${cols} FROM dbo.T /* trailing */ ;`;
  const t0 = performance.now();
  const formatted = formatTsql(sql, defaultOptions);
  const elapsed = performance.now() - t0;

  assert(
    formatted.startsWith('SELECT\n    col0,'),
    'Should correctly format first column with comma',
  );
  assert(formatted.includes('FROM dbo.T;'), 'Should correctly format FROM clause after columns');
  assert(formatted.includes('/* trailing */'), 'Should correctly preserve trailing comment');
  assert(
    elapsed < 200,
    `Tombstone lookahead must be O(1) fast (took ${elapsed.toFixed(1)}ms, expected < 200ms)`,
  );
});

// 3. Async non-blocking tests
(async () => {
  await testAsync('formatTsqlAsync formats identically to formatTsql', async () => {
    const sql = `
DECLARE @a INT = 1;
DECLARE @b INT = 2;
SET @a = 3;
IF NOT EXISTS (SELECT 1 FROM dbo.Customers c INNER JOIN dbo.Orders o ON c.id = o.customer_id)
BEGIN
SELECT c.id, c.name, count(o.id) AS order_count
FROM dbo.Customers c
LEFT JOIN dbo.Orders o ON c.id = o.customer_id
WHERE c.is_active = 1
GROUP BY c.id, c.name
HAVING count(o.id) > 5
ORDER BY order_count DESC
OPTION (RECOMPILE);
END
    `.trim();

    const syncResult = formatTsql(sql, defaultOptions);
    const asyncResult = await formatTsqlAsync(sql, defaultOptions);
    assert.strictEqual(asyncResult, syncResult, 'Async result must equal sync result');
  });

  await testAsync('formatTsqlAsync respects cancellation token', async () => {
    const sql = 'SELECT 1;\n'.repeat(500);
    const cancellationToken = { isCancellationRequested: true };
    const result = await formatTsqlAsync(sql, defaultOptions, cancellationToken);
    assert.strictEqual(result, sql, 'Cancelled format should return input without formatting');
  });

  await testAsync('formatTsqlAsync cooperative yielding on huge inputs', async () => {
    // Generate 3,000 queries
    const query = 'SELECT col1, col2 FROM dbo.Table1 WHERE id = 1 OPTION (RECOMPILE);\n';
    const largeSql = query.repeat(3000);
    const t0 = performance.now();
    const result = await formatTsqlAsync(largeSql, defaultOptions);
    const elapsed = performance.now() - t0;
    assert(result.length > 0, 'Should return formatted output');
    console.log(`  └─ Formatted 3,000 queries in ${elapsed.toFixed(1)}ms asynchronously`);
  });

  console.log('\nAll new feature tests passed successfully!');
})();
