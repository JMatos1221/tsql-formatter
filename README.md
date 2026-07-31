# Clean T-SQL Formatter

A VS Code extension that formats T-SQL statements consistently.

- [Clean T-SQL Formatter](#clean-t-sql-formatter)
  - [Install](#install)
  - [Features](#features)
  - [Format SQL](#format-sql)
  - [Settings](#settings)
  - [Example](#example)
  - [Troubleshooting](#troubleshooting)

## Install

Install Clean T-SQL Formatter from the Visual Studio Code Extensions view:

1. Open Extensions in VS Code.
2. Search for "Clean T-SQL Formatter" or `clean-tsql-formatter`.
3. Select the extension and choose **Install**.

The extension activates automatically when you open a SQL file.

## Features

- Format an entire SQL document or only the selected SQL.
- Format common T-SQL statements, including DML, DDL, CTEs, subqueries, joins, `CASE` expressions,
  window functions, transactions, cursors, and batches.
- Preserve comments and string literals while applying consistent whitespace and indentation.
- Configure keyword and identifier casing, bracketed identifiers, clause line breaks, line wrapping, and
  spacing between statements.
- Use with VS Code's built-in **Format on Save** support.

## Format SQL

### Format a document

Open a `.sql` file, then run **Format Document** from the editor context menu or Command Palette. You can
also use your configured VS Code format-document keyboard shortcut.

To format when saving, enable **Editor: Format On Save** in VS Code Settings. If multiple formatters are
available, choose **Clean T-SQL Formatter** as the default formatter for SQL files.

### Format a selection

Select one or more complete SQL statements, then run **Format Selection** from the editor context menu or
Command Palette. Only the selected text is replaced; text outside the selection is unchanged. With no
selection, use **Format Document** to format the entire file.

## Settings

- `tsqlFormatter.breakOnKeywords` (boolean, default: `true`): Place keywords like `WHERE`, `JOIN`, `AND`, `OR` on their own lines.
- `tsqlFormatter.identifierCase` (`upper` | `lower` | `preserve`, default: `preserve`): Identifier casing for database/schema/table/column names.
- `tsqlFormatter.keywordCase` (`upper` | `lower` | `preserve`, default: `preserve`): Keyword casing mode.
- `tsqlFormatter.linesBetweenQueries` (number, default: `2`): Number of empty lines between top-level statements.
- `tsqlFormatter.maxLineLength` (number, default: `100`): Maximum output line length before wrapping to a continuation line. Only active when `useMaxLineLength` is enabled.
- `tsqlFormatter.useBrackets` (boolean, default: `false`): Wrap identifiers in square brackets (e.g., `[TableName]`). Variables (`@var`, `@@sysvar`) and temporary tables (`#temp`, `##global`) are **never** bracketed, even when this setting is enabled.
- `tsqlFormatter.useMaxLineLength` (boolean, default: `true`): Enable line-length-based wrapping. When `true`, tokens that would push a line past `maxLineLength` are moved to a new indented continuation line. Set to `false` to disable all line-length wrapping.

Change these in VS Code Settings by searching for `tsqlFormatter`.

For project-specific settings, add them to `.vscode/settings.json` in your workspace:

```json
{
  "tsqlFormatter.keywordCase": "upper",
  "tsqlFormatter.identifierCase": "preserve",
  "tsqlFormatter.useBrackets": false
}
```

## Example

Before:

```sql
select id, name from users where active=1 order by name
```

After (with defaults and `keywordCase: "upper"`):

```sql
SELECT id, name
FROM users
WHERE active = 1
ORDER BY name
```

Subqueries are formatted with the same clause-breaking as top-level queries, indented relative to their parent:

```sql
SELECT id
FROM users
WHERE id IN (
    SELECT user_id
    FROM orders
    WHERE total > 100
)
```

## Troubleshooting

- The extension formats SQL but does not validate SQL semantics. Review formatting changes with VS Code's
  **Undo** command if needed.
- Select complete statements when using **Format Selection** for the most predictable result.
- `useBrackets` never applies to T-SQL variables (`@var`, `@@sysvar`) or temporary tables (`#temp`,
  `##global`).
- Subquery formatting applies to `(SELECT ...)` expressions anywhere they appear — in `FROM` clauses,
  `WHERE`/`IN`/`EXISTS`, `SELECT` column lists, and function arguments.
- If formatting fails, open VS Code's **Output** panel and select **TSQL Formatter** for details.
- Report issues or feature requests at https://github.com/JMatos1221/tsql-formatter/issues

License: MIT
