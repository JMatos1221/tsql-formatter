# <img src="icon.png" alt="Clean T-SQL Formatter Icon" width="42" height="42" align="top" /> Clean T-SQL Formatter

A high-performance Visual Studio Code extension for formatting Microsoft T-SQL (Transact-SQL) code consistently and cleanly.

## Latest Changes

### T-SQL Use Case Enhancements

- **`SELECT ... INTO #TargetTable`**: Formatted with `INTO` on its own line beneath column lists.
- **`TOP (n) PERCENT WITH TIES`**: Complete support for expressions, percentage, and tie-breaking across `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
- **DML `TOP`**: Clean formatting for `UPDATE TOP (n)` and `DELETE TOP (n)` without statement fragmentation.
- **CTE Column Lists**: Formats `WITH cte (col1, col2) AS (SELECT ...)` cleanly with inline column projections.
- **Cursors & Table Variables**: First-class formatting for `DECLARE cur CURSOR ... FOR SELECT` and `DECLARE @tbl TABLE (...)` / `DECLARE [@tbl] TABLE (...)`.
- **DML `OUTPUT ... INTO`**: Formatted on dedicated indented lines across `INSERT`, `UPDATE`, `DELETE`, and `MERGE`.
- **Multi-Condition Joins**: Activated `breakOnKeywords` to format `AND` / `OR` continuation lines indented beneath `ON`.
- **Modern T-SQL**: Full casing support for `APPROX_PERCENTILE_CONT`, `APPROX_PERCENTILE_DISC`, `GREATEST`, `LEAST`, `DATETRUNC`, and `GENERATE_SERIES`.

### Performance Optimizations

- **Zero-Copy Token Lookahead**: Replaced $O(N)$ array splices with in-place token tombstoning, eliminating $O(N^2)$ overhead on large SQL files.
- **Greedy Longest-Match Multi-Word Tokenization**: Rapid trie-based multi-word keyword recognition without backtracking.

### New Settings

- **`tsqlFormatter.indentSize`**: Customizable indentation scale (1 to 8 spaces, default: `4`). Inherits VS Code editor tab size when omitted.
- **`tsqlFormatter.breakOnKeywords`**: Now actively controls multi-condition join formatting (`AND` / `OR` lines under `ON`).

---

- [Clean T-SQL Formatter](#-clean-t-sql-formatter)
  - [Latest Changes](#latest-changes)
    - [T-SQL Use Case Enhancements](#t-sql-use-case-enhancements)
    - [Performance Optimizations](#performance-optimizations)
    - [New Settings](#new-settings)
  - [Install](#install)
  - [Features](#features)
  - [Comment Formatting Rules](#comment-formatting-rules)
  - [Format SQL](#format-sql)
    - [Format a Document](#format-a-document)
    - [Format a Selection](#format-a-selection)
  - [Settings](#settings)
  - [Examples](#examples)
    - [Basic Query](#basic-query)
    - [`SELECT ... INTO` \& `TOP (n) PERCENT WITH TIES`](#select--into--top-n-percent-with-ties)
    - [Multi-Row `INSERT ... VALUES` \& Table Value Constructors](#multi-row-insert--values--table-value-constructors)
    - [DML Statements with `OUTPUT ... INTO`](#dml-statements-with-output--into)
    - [Table Variables, Cursors \& CTE Column Projections](#table-variables-cursors--cte-column-projections)
    - [Multi-Condition Joins](#multi-condition-joins)
    - [Subqueries, CTEs \& Table-Valued Functions](#subqueries-ctes--table-valued-functions)
    - [MERGE Statement](#merge-statement)
    - [Comment Formatting](#comment-formatting)
    - [Modern DDL \& Indexes](#modern-ddl--indexes)
    - [Transactions \& Stored Procedures](#transactions--stored-procedures)
  - [Troubleshooting](#troubleshooting)
  - [Development \& Contributing](#development--contributing)
  - [License](#license)

---

## Install

Install **Clean T-SQL Formatter** from the Visual Studio Code Extensions view:

1. Open **Extensions** in VS Code (`Ctrl+Shift+X` or `Cmd+Shift+X`).
2. Search for `Clean T-SQL Formatter` or `clean-tsql-formatter`.
3. Click **Install**.

The extension activates automatically when you open a `.sql` file.

---

## Features

- **Full T-SQL Statement Coverage**:
  - **DML**: `SELECT`, `SELECT ... INTO #TargetTable` (with `INTO` on its own line beneath column projections), `INSERT` / `INSERT INTO` (including cleanly aligned single-row and multi-row `VALUES` lists, `INSERT ... SELECT`, and `INSERT ... EXEC`), `UPDATE`, `DELETE`, `TOP (n) [PERCENT] [WITH TIES]` across DML statements without fragmentation, dedicated `OUTPUT ... INTO` line formatting across statements, and full clause formatting for `MERGE` (`USING`, `ON`, `WHEN MATCHED THEN`, `WHEN NOT MATCHED [BY TARGET|BY SOURCE] THEN`, `OUTPUT`).
  - **Table Sources & Joins**: Supports standard joins (`INNER`, `LEFT`, `RIGHT`, `FULL`, `CROSS`), `CROSS APPLY` / `OUTER APPLY`, derived table value constructors (`FROM (VALUES (...), (...)) AS t(cols)`), ANSI comma joins (`FROM t1, t2`), multi-condition joins with indented `AND` / `OR` lines beneath `ON`, `PIVOT` and `UNPIVOT`, `TABLESAMPLE`, and table hints (`WITH (NOLOCK)`).
  - **Table-Valued & Rowset Functions**: Native support for built-in and user-defined TVFs (`STRING_SPLIT`, `GENERATE_SERIES`, `OPENJSON`, `OPENROWSET`, `OPENQUERY`, `OPENDATASOURCE`, `OPENXML`, `dbo.fn_GetUsers(...)`) in `FROM` and `JOIN` clauses.
  - **DDL**: `CREATE TABLE` (column constraints, `IDENTITY(seed, increment)`, computed columns), `CREATE OR ALTER PROCEDURE / VIEW / FUNCTION`, `DROP TABLE IF EXISTS` (and all object variants), `ALTER TABLE` (including `ALTER COLUMN`, `ADD CONSTRAINT`, `DROP CONSTRAINT`), and `CREATE INDEX` (with `INCLUDE`, `WHERE`, and `WITH (...)` index options).
  - **Expressions & Control Flow**: CTEs (`WITH ... AS`) including explicit column projection lists (`WITH cte (c1, c2) AS (...)`), subqueries, `CASE` expressions, window functions (`OVER`, `PARTITION BY`, `ROWS/RANGE/GROUPS`, `WINDOW`), `IF ... ELSE`, `BEGIN ... END`, `BEGIN TRY ... END CATCH`, transactions (`BEGIN TRAN`, `SAVE TRAN`, `COMMIT WORK`), cursors (`DECLARE cur CURSOR FOR SELECT`), table variables (`DECLARE @tbl TABLE (...)` / `DECLARE [@tbl] TABLE (...)`), and `GO` batches.
  - **Modern T-SQL & Vector Extensions**: SQL Server 2022 & 2025 vector data types and functions (`VECTOR(1536)`, `VECTOR_DISTANCE`, `VECTOR_NORM`), `APPROX_PERCENTILE_CONT`, `APPROX_PERCENTILE_DISC`, `GREATEST`, `LEAST`, `DATETRUNC`, `DATE_BUCKET`, `GENERATE_SERIES`, `JSON_PATH_EXISTS`, and `APPROX_COUNT_DISTINCT`.
  - **Robust Lexing**: Supports Unicode / international identifiers (`código`, `preço`), compound assignment operators (`+=`, `-=`, `*=`, `/=`, `%=`, `&=`, `^=`, `|=`), HierarchyID / CLR scope resolution operator (`::`), hexadecimal literals (`0x...`), scientific notation (`1e5`), nested block comments (`/* ... /* ... */ ... */`), and bracketed identifiers with escaped brackets (`[Table]]Name]`).
- **Consistent Multi-Row `VALUES` & Line Wrapping**: Places `VALUES` on its own line and aligns every row tuple `( ... )` at the same indentation level beneath `VALUES` (even across 100+ rows). Long lines that wrap multiple times via `maxLineLength` maintain a steady continuation indent relative to the statement's base indent without stair-stepping.
- **Strict & Clean Comment Formatting**: Preserves single-line (`--`) and multi-line (`/* */`) comments, formatting comment runs with precise spacing rules.
- **Document & Selection Formatting**: Format an entire SQL document or format only the selected SQL statements.
- **Asynchronous, Non-Blocking Pipeline**: Formats large documents and complex batches without freezing the VS Code editor UI. Cooperatively yields to the Node.js event loop across tokenization (`tokenizeAsync`), multi-word keyword merging (`mergeMultiWordKeywordsAsync`), statement parsing, and nested execution blocks (`BEGIN ... END`, `BEGIN TRY ... END TRY`, `IF ... ELSE`, `WHILE`). Promptly honors VS Code cancellation tokens (e.g., when continuing to type while formatting).
- **High-Performance Architecture**: Employs zero-copy token lookahead with in-place token tombstoning (eliminating $O(N^2)$ overhead on large files), greedy longest-match multi-word tokenization, zero-allocation indentation caching, bracketed identifier bypass, and direct line-range calculation in VS Code to avoid duplicate full-text buffer allocations.
- **Customizable Casing & Style Options**: Configure indentation size (`indentSize`, 1–8 spaces), keyword casing (`UPPER`, `lower`, `preserve`), identifier casing, bracketed identifiers (`[TableName]`), line wrapping lengths, clause breaks (including multi-condition join `AND`/`OR` formatting), and blank line spacing between queries.
- **VS Code Format-on-Save Support**: Seamless integration with `editor.formatOnSave`.

---

## Comment Formatting Rules

Clean T-SQL Formatter enforces consistent whitespace rules for comments to ensure high readability:

- **Single-Line Comments (`--`)**:
  - Always placed on their own line (never sharing a line with SQL code) with a blank line **before** the comment (or the first comment in a sequential run), unless it is at the very beginning of the document or already preceded by a blank line.
  - Sequential `--` comments are kept on consecutive lines without blank lines in between.
  - **No blank line after** single-line comments — the last comment in a run stands directly above the line of code it describes.
- **Multi-Line / Block Comments (`/* ... */`)**:
  - Always formatted with a blank line **before** the block comment, and the following line of code is placed **directly after** the closing `*/` line (no blank line after).
  - Correctly tracks nested block comments (`/* outer /* inner */ still comment */`).

---

## Format SQL

### Format a Document

1. Open any `.sql` file.
2. Right-click in the editor and select **Format Document**, or use the shortcut (`Shift+Alt+F` on Windows/Linux, `Shift+Option+F` on macOS).

To format automatically on save, add the following to your VS Code settings:

```json
"[sql]": {
  "editor.defaultFormatter": "JMatos1221.clean-tsql-formatter",
  "editor.formatOnSave": true
}
```

### Format a Selection

Select one or more complete T-SQL statements, right-click, and select **Format Selection** (`Ctrl+K Ctrl+F` / `Cmd+K Cmd+F`). Only the selected text will be formatted; non-selected code remains untouched.

---

## Settings

Customize extension behavior in VS Code Settings (`Ctrl+,` or `Cmd+,`) by searching for `tsqlFormatter`:

| Setting                               | Type      | Default      | Description                                                                                                                                                           |
| :------------------------------------ | :-------- | :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsqlFormatter.breakOnKeywords`       | `boolean` | `true`       | Break into a new line for clause keywords like `WHERE`, `JOIN` and multi-condition joins (`AND`, `OR` indented under `ON`).                                           |
| `tsqlFormatter.keywordCase`           | `string`  | `"preserve"` | Keyword casing mode (`"upper"`, `"lower"`, or `"preserve"`).                                                                                                          |
| `tsqlFormatter.identifierCase`        | `string`  | `"preserve"` | Identifier casing mode for database/schema/table/column names (`"upper"`, `"lower"`, or `"preserve"`).                                                                |
| `tsqlFormatter.indentSize`            | `number`  | `4`          | Number of spaces per indentation level (minimum: 1, maximum: 8). Automatically inherits VS Code editor tab size when omitted.                                         |
| `tsqlFormatter.useBrackets`           | `boolean` | `false`      | Wrap table/column identifiers in square brackets (e.g., `[TableName]`). Variables (`@var`, `@@sysvar`) and temp tables (`#temp`, `##global`) are **never** bracketed. |
| `tsqlFormatter.linesBetweenQueries`   | `number`  | `2`          | Number of empty lines between top-level SQL statements.                                                                                                               |
| `tsqlFormatter.linesBetweenVariables` | `number`  | `0`          | Number of empty lines between consecutive variable declarations (`DECLARE`) or assignments (`SET @var = ...`).                                                        |
| `tsqlFormatter.useMaxLineLength`      | `boolean` | `true`       | Enable line length wrapping.                                                                                                                                          |
| `tsqlFormatter.maxLineLength`         | `number`  | `100`        | Maximum line length before wrapping long expressions onto consistently indented continuation lines.                                                                   |

Example `.vscode/settings.json`:

```json
{
  "tsqlFormatter.keywordCase": "upper",
  "tsqlFormatter.identifierCase": "preserve",
  "tsqlFormatter.indentSize": 4,
  "tsqlFormatter.useBrackets": false,
  "tsqlFormatter.linesBetweenQueries": 2,
  "tsqlFormatter.linesBetweenVariables": 0
}
```

---

## Examples

### Basic Query

**Before:**

```sql
select id, name, email from dbo.users where is_active=1 and created_at >= '2025-01-01' order by name
```

**After (with `keywordCase: "upper"`):**

```sql
SELECT
    id,
    name,
    email
FROM dbo.users
WHERE is_active = 1
  AND created_at >= '2025-01-01'
ORDER BY name;
```

---

### `SELECT ... INTO` & `TOP (n) PERCENT WITH TIES`

`SELECT ... INTO` formats the target destination table on its own line below the projected column list. `TOP (n) PERCENT WITH TIES` preserves expressions, percentages, and ties without breaking column projections:

**Before:**

```sql
select top (10) percent with ties id, name, score into #TopStudents from dbo.Students where active = 1 order by score desc;
```

**After:**

```sql
SELECT TOP (10) PERCENT WITH TIES
    id,
    name,
    score
INTO #TopStudents
FROM dbo.Students
WHERE active = 1
ORDER BY score DESC;
```

---

### Multi-Row `INSERT ... VALUES` & Table Value Constructors

**Before:**

```sql
insert into dbo.Users (id, username, email) values (1, 'alice', 'alice@example.com'), (2, 'bob', 'bob@example.com'), (3, 'charlie', 'charlie@example.com');
```

**After:**

```sql
INSERT INTO dbo.Users (id, username, email)
VALUES
    (1, 'alice', 'alice@example.com'),
    (2, 'bob', 'bob@example.com'),
    (3, 'charlie', 'charlie@example.com');
```

Derived `(VALUES ...)` table value constructors in `FROM` / `APPLY` clauses are formatted with the same row alignment:

```sql
SELECT
    *
FROM (
    VALUES
        (1, 'A'),
        (2, 'B')
) AS t(id, code);
```

---

### DML Statements with `OUTPUT ... INTO`

`OUTPUT ... INTO` clauses are formatted onto dedicated lines across `INSERT`, `UPDATE`, `DELETE`, and `MERGE` operations, preserving clean statement flow without crowding:

```sql
UPDATE TOP (5) dbo.Users
SET status = 'inactive'
OUTPUT inserted.id, deleted.status, inserted.status INTO @StatusAudit
WHERE last_login < DATEADD(year, -1, GETDATE());

DELETE TOP (10) FROM dbo.AuditLogs
OUTPUT deleted.id, deleted.created_at INTO @PurgedLogs
WHERE created_at < '2025-01-01';

INSERT INTO dbo.ArchiveLogs (entry_id, payload)
OUTPUT inserted.id, inserted.entry_id INTO @InsertedRows
VALUES
    (1, 'payload_a'),
    (2, 'payload_b');
```

---

### Table Variables, Cursors & CTE Column Projections

Format table variable schemas, cursor declarations, and common table expressions with explicit column projection lists:

```sql
DECLARE @TempUsers TABLE (
    id INT NOT NULL,
    name VARCHAR(50) NULL,
    created_at DATETIME2(7) NOT NULL
);

DECLARE user_cursor CURSOR FOR
SELECT
    id,
    name
FROM dbo.Users;

WITH RankedOrders (order_id, customer_id, ranking) AS (
    SELECT
        order_id,
        customer_id,
        ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY order_date DESC)
    FROM dbo.Orders
)
SELECT
    order_id,
    customer_id,
    ranking
FROM RankedOrders
WHERE ranking <= 3;
```

---

### Multi-Condition Joins

When `breakOnKeywords: true` is enabled, compound join conditions split `AND` / `OR` keywords onto their own aligned lines indented beneath `ON`:

```sql
SELECT
    a.id,
    b.name
FROM dbo.TableA a
INNER JOIN dbo.TableB b
    ON a.id = b.id
    AND a.tenant_id = b.tenant_id
    OR a.is_admin = 1;
```

---

### Subqueries, CTEs & Table-Valued Functions

```sql
WITH ActiveUsers AS (
    SELECT
        user_id,
        email
    FROM dbo.users
    WHERE status = 'ACTIVE'
)
SELECT
    u.user_id,
    u.email,
    s.value AS tag
FROM ActiveUsers AS u
CROSS APPLY STRING_SPLIT(u.tags, ',') AS s
WHERE u.user_id IN (
    SELECT
        user_id
    FROM dbo.orders
    WHERE total_amount > 100
);
```

---

### MERGE Statement

```sql
MERGE INTO dbo.TargetTable AS target
USING dbo.SourceTable AS source
    ON target.ID = source.ID
WHEN MATCHED AND source.Val <> target.Val THEN
    UPDATE SET target.Val = source.Val, target.Updated = GETDATE()
WHEN NOT MATCHED BY TARGET THEN
    INSERT (ID, Val)
    VALUES (source.ID, source.Val)
WHEN NOT MATCHED BY SOURCE THEN
    DELETE
OUTPUT $action, inserted.*, deleted.*;
```

---

### Comment Formatting

**Input:**

```sql
SELECT 1;
-- first comment
-- second comment
SELECT id,
-- comment before column
name FROM users;
/* block comment */
SELECT 2;
```

**Output:**

```sql
SELECT
    1;

-- first comment
-- second comment
SELECT
    id,

    -- comment before column
    name
FROM users;

/* block comment */
SELECT
    2;
```

---

### Modern DDL & Indexes

```sql
CREATE TABLE dbo.Orders (
    OrderID INT IDENTITY(1, 1) NOT NULL,
    CustomerID INT NOT NULL,
    OrderDate DATETIME2(7) DEFAULT SYSUTCDATETIME() NOT NULL,
    TotalAmount DECIMAL(18, 2) NOT NULL,
    TaxAmount AS (TotalAmount * 0.1) PERSISTED,
    CONSTRAINT PK_Orders PRIMARY KEY CLUSTERED (OrderID ASC),
    CONSTRAINT FK_Orders_Customers FOREIGN KEY (CustomerID) REFERENCES dbo.Customers (CustomerID) ON DELETE CASCADE
);

CREATE UNIQUE NONCLUSTERED INDEX IX_Orders_CustomerDate ON dbo.Orders (CustomerID ASC, OrderDate DESC)
INCLUDE (TotalAmount)
WHERE TotalAmount > 0
WITH (DATA_COMPRESSION = PAGE, FILLFACTOR = 80, ONLINE = ON);

ALTER TABLE dbo.Orders ALTER COLUMN TotalAmount DECIMAL(19, 4) NOT NULL;
```

---

### Transactions & Stored Procedures

```sql
CREATE OR ALTER PROCEDURE dbo.GetCustomerOrders
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRAN;

    SAVE TRAN SavePoint1;

    DROP TABLE IF EXISTS #TempOrders;

    SELECT
        order_id,
        order_date
    FROM dbo.orders
    WHERE customer_id = @CustomerId;

    COMMIT WORK;
END;
```

---

## Troubleshooting

- **Undo Changes**: Use VS Code's **Undo** (`Ctrl+Z` / `Cmd+Z`) if formatting is not desired for a specific file.
- **Selection Formatting**: Select full, complete SQL statements when running **Format Selection** for best results.
- **Variables & Temp Tables**: `useBrackets` ignores variables (`@var`, `@@sysvar`) and temp tables (`#temp`, `##global`) per T-SQL syntax standard.
- **Output Channel**: If an error occurs, check **Output** -> **TSQL Formatter** in VS Code for details.
- **Issues & Contributions**: Report issues or request features at [GitHub Issues](https://github.com/JMatos1221/tsql-formatter/issues).

---

## Development & Contributing

### Project Structure

- `src/extension.ts` — VS Code extension activation and formatting provider registration.
- `src/provider.ts` — `DocumentFormattingEditProvider` and `DocumentRangeFormattingEditProvider` implementation, configuration loading, and output logging.
- `src/formatter.ts` — Synchronous (`formatTsql`) and asynchronous (`formatTsqlAsync`) SQL formatting engine (`SqlFormatter`).
- `src/tokenizer.ts` — Lexer (`tokenize`, `tokenizeAsync`) and greedy multi-word keyword combiner (`mergeMultiWordKeywords`, `mergeMultiWordKeywordsAsync`).
- `src/keywords.ts` — T-SQL reserved keywords, multi-word keyword trie definitions, built-in functions, and parameterized data types.

### Build & Test

To build and run tests locally:

```pwsh
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run full test suite
npm test

# Watch mode during development
npm run watch
```

---

## License

[MIT License](LICENSE)
