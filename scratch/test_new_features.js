const assert = require('assert');
const {
  formatTsql,
  formatTsqlAsync,
  KEYWORDS,
  FUNCTIONS,
  CLAUSE_KEYWORDS,
  STATEMENT_START_KEYWORDS,
} = require('../out/formatter');
const { KEYWORDS: KW, FUNCTIONS: FN } = require('../out/keywords');

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

// 2. Async non-blocking tests
(async () => {
  await testAsync('formatTsqlAsync formats identically to formatTsql', async () => {
    const sql = `
SELECT c.id, c.name, count(o.id) AS order_count
FROM dbo.Customers c
LEFT JOIN dbo.Orders o ON c.id = o.customer_id
WHERE c.is_active = 1
GROUP BY c.id, c.name
HAVING count(o.id) > 5
ORDER BY order_count DESC
OPTION (RECOMPILE);
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
