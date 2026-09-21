# Clean T-SQL Formatter

A high-performance Visual Studio Code extension for formatting Microsoft T-SQL (Transact-SQL) code consistently and cleanly.

- [Clean T-SQL Formatter](#clean-t-sql-formatter)
  - [Install](#install)
  - [Features](#features)
  - [Comment Formatting Rules](#comment-formatting-rules)
  - [Format SQL](#format-sql)
    - [Format a Document](#format-a-document)
    - [Format a Selection](#format-a-selection)
  - [Settings](#settings)
  - [Examples](#examples)
    - [Basic Query](#basic-query)
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
  - **DML**: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and full clause formatting for `MERGE` (`USING`, `ON`, `WHEN MATCHED THEN`, `WHEN NOT MATCHED [BY TARGET|BY SOURCE] THEN`, `OUTPUT`).
  - **Table Sources & Joins**: Supports standard joins (`INNER`, `LEFT`, `RIGHT`, `FULL`, `CROSS`), `CROSS APPLY` / `OUTER APPLY`, ANSI comma joins (`FROM t1, t2`), `PIVOT` and `UNPIVOT`, `TABLESAMPLE`, and table hints (`WITH (NOLOCK)`).
  - **Table-Valued & Rowset Functions**: Native support for built-in and user-defined TVFs (`STRING_SPLIT`, `GENERATE_SERIES`, `OPENJSON`, `OPENROWSET`, `OPENQUERY`, `OPENDATASOURCE`, `OPENXML`, `dbo.fn_GetUsers(...)`) in `FROM` and `JOIN` clauses.
  - **DDL**: `CREATE TABLE` (column constraints, `IDENTITY(seed, increment)`, computed columns), `CREATE OR ALTER PROCEDURE / VIEW / FUNCTION`, `DROP TABLE IF EXISTS` (and all object variants), `ALTER TABLE` (including `ALTER COLUMN`, `ADD CONSTRAINT`, `DROP CONSTRAINT`), and `CREATE INDEX` (with `INCLUDE`, `WHERE`, and `WITH (...)` index options).
  - **Expressions & Control Flow**: CTEs (`WITH ... AS`), subqueries, `CASE` expressions, window functions (`OVER`, `PARTITION BY`, `ROWS/RANGE/GROUPS`, `WINDOW`), `IF ... ELSE`, `BEGIN ... END`, `BEGIN TRY ... END CATCH`, transactions (`BEGIN TRAN`, `SAVE TRAN`, `COMMIT WORK`), cursors, and `GO` batches.
  - **Modern T-SQL & Vector Extensions**: SQL Server 2022 & 2025 vector data types and functions (`VECTOR(1536)`, `VECTOR_DISTANCE`, `VECTOR_NORM`), `DATETRUNC`, `DATE_BUCKET`, `JSON_PATH_EXISTS`, and `APPROX_COUNT_DISTINCT`.
  - **Robust Lexing**: Supports Unicode / international identifiers (`código`, `preço`), compound assignment operators (`+=`, `-=`, `*=`, `/=`, `%=`, `&=`, `^=`, `|=`), HierarchyID / CLR scope resolution operator (`::`), hexadecimal literals (`0x...`), scientific notation (`1e5`), nested block comments (`/* ... /* ... */ ... */`), and bracketed identifiers with escaped brackets (`[Table]]Name]`).
- **Strict & Clean Comment Formatting**: Preserves single-line (`--`) and multi-line (`/* */`) comments, formatting comment runs with precise spacing rules.
- **Document & Selection Formatting**: Format an entire SQL document or format only the selected SQL statements.
- **Asynchronous, Non-Blocking Pipeline**: Formats large documents and complex batches without freezing the VS Code editor UI. Cooperatively yields to the Node.js event loop across tokenization (`tokenizeAsync`), multi-word keyword merging (`mergeMultiWordKeywordsAsync`), statement parsing, and nested execution blocks (`BEGIN ... END`, `BEGIN TRY ... END TRY`, `IF ... ELSE`, `WHILE`). Promptly honors VS Code cancellation tokens (e.g., when continuing to type while formatting).
- **High-Performance Architecture**: Employs precomputed multi-word patterns, zero-allocation indentation caching, bracketed identifier bypass, and direct line-range calculation in VS Code to avoid duplicate full-text buffer allocations.
- **Customizable Casing & Style Options**: Configure keyword casing (`UPPER`, `lower`, `preserve`), identifier casing, bracketed identifiers (`[TableName]`), line wrapping lengths, clause breaks, and blank line spacing between queries.
- **VS Code Format-on-Save Support**: Seamless integration with `editor.formatOnSave`.

---

## Comment Formatting Rules

Clean T-SQL Formatter enforces consistent whitespace rules for comments to ensure high readability:

- **Single-Line Comments (`--`)**:
  - Inserted with a blank line **before** the comment (or the first comment in a sequential run), unless it is at the very beginning of the document or already preceded by a blank line.
  - Sequential `--` comments are kept on consecutive lines without blank lines in between.
  - **No blank line after** single-line comments — the last comment in a run sits directly above the line of code it describes.
- **Multi-Line / Block Comments (`/* ... */`)**:
  - Always formatted with a blank line **before** and a blank line **after** the block comment.
  - Correctly tracks nested block comments (`/* outer /* inner */ still comment */`).
- **Inline Comments**:
  - Trailing comments at the end of a code line (e.g., `id, -- primary key`) are preserved on that line with appropriate spacing.

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

| Setting                             | Type      | Default      | Description                                                                                                                                                           |
| :---------------------------------- | :-------- | :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsqlFormatter.breakOnKeywords`     | `boolean` | `true`       | Break into a new line for keywords like `WHERE`, `JOIN`, `AND`, `OR`.                                                                                                 |
| `tsqlFormatter.keywordCase`         | `string`  | `"preserve"` | Keyword casing mode (`"upper"`, `"lower"`, or `"preserve"`).                                                                                                          |
| `tsqlFormatter.identifierCase`      | `string`  | `"preserve"` | Identifier casing mode for database/schema/table/column names (`"upper"`, `"lower"`, or `"preserve"`).                                                                |
| `tsqlFormatter.useBrackets`         | `boolean` | `false`      | Wrap table/column identifiers in square brackets (e.g., `[TableName]`). Variables (`@var`, `@@sysvar`) and temp tables (`#temp`, `##global`) are **never** bracketed. |
| `tsqlFormatter.linesBetweenQueries` | `number`  | `2`          | Number of empty lines between top-level SQL statements.                                                                                                               |
| `tsqlFormatter.useMaxLineLength`    | `boolean` | `true`       | Enable line length wrapping.                                                                                                                                          |
| `tsqlFormatter.maxLineLength`       | `number`  | `100`        | Maximum line length before wrapping long expressions onto indented continuation lines.                                                                                |

Example `.vscode/settings.json`:

```json
{
  "tsqlFormatter.keywordCase": "upper",
  "tsqlFormatter.identifierCase": "preserve",
  "tsqlFormatter.useBrackets": false,
  "tsqlFormatter.linesBetweenQueries": 2
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
