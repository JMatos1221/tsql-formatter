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
    - [Subqueries and CTEs](#subqueries-and-ctes)
    - [Comment Formatting](#comment-formatting)
    - [Modern DDL \& Transactions](#modern-ddl--transactions)
  - [Troubleshooting](#troubleshooting)
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

- **Full T-SQL Statement & Keyword Coverage**: Supports DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`), DDL (`CREATE TABLE`, `CREATE OR ALTER PROCEDURE/VIEW/FUNCTION`, `DROP TABLE IF EXISTS`, `ALTER TABLE`), CTEs (`WITH ... AS`), subqueries, joins, `CASE` expressions, window functions (`OVER`, `PARTITION BY`, `ROWS/RANGE/GROUPS`), transactions (`BEGIN TRAN`, `SAVE TRAN`, `COMMIT WORK`), cursors, and GO batches.
- **Strict & Clean Comment Formatting**: Preserves single-line (`--`) and multi-line (`/* */`) comments, formatting standalone comment runs with precise spacing rules.
- **Document & Selection Formatting**: Format an entire SQL document or format only the selected SQL statements.
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
select id, name, email from dbo.users where is_active=1 order by name
```

**After (with `keywordCase: "upper"`):**

```sql
SELECT
    id,
    name,
    email
FROM dbo.users
WHERE is_active = 1
ORDER BY name;
```

---

### Subqueries and CTEs

**Formatted CTE & Subquery:**

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
    u.email
FROM ActiveUsers AS u
WHERE u.user_id IN (
    SELECT
        user_id
    FROM dbo.orders
    WHERE total_amount > 100
);
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

### Modern DDL & Transactions

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

## License

[MIT License](LICENSE)
