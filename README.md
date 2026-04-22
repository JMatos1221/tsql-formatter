# Clean T-SQL Formatter

A VS Code extension that formats T-SQL statements consistently.

- [Clean T-SQL Formatter](#clean-t-sql-formatter)
  - [Install](#install)
  - [Build \& Run Locally](#build--run-locally)
  - [Use](#use)
  - [Settings](#settings)
  - [Example](#example)
  - [Notes](#notes)

## Install

Install Clean T-SQL Formatter from the Visual Studio Code Extensions view:

1. Open Extensions in VS Code.
2. Search for "Clean T-SQL Formatter" or `clean-tsql-formatter`.
3. Select the extension and choose **Install**.

Alternatively, build and install a VSIX locally or run the extension in the Extension Development Host (see Build & Run Locally).

## Build & Run Locally

1. Clone the repository:

```bash
git clone https://github.com/JMatos1221/tsql-formatter.git
cd tsql-formatter
```

2. Install dependencies and compile:

```bash
npm install
npm run compile
```

3. Open the project in VS Code and press F5 to launch the Extension Development Host.

## Use

Open a `.sql` file and run **Format Document** (right-click → Format Document, Command Palette → Format Document, or use your keybinding). To format automatically on save, enable **Editor: Format On Save**.

## Settings

- `tsqlFormatter.breakOnKeywords` (boolean, default: `true`): Place keywords like `WHERE`, `JOIN`, `AND`, `OR` on their own lines.
- `tsqlFormatter.identifierCase` (`upper` | `lower` | `preserve`, default: `preserve`): Identifier casing for database/schema/table/column names.
- `tsqlFormatter.keywordCase` (`upper` | `lower` | `preserve`, default: `preserve`): Keyword casing mode.
- `tsqlFormatter.linesBetweenQueries` (number, default: `2`): Number of empty lines between top-level statements.
- `tsqlFormatter.maxLineLength` (number, default: `100`): Maximum output line length before wrapping to a continuation line. Only active when `useMaxLineLength` is enabled.
- `tsqlFormatter.useBrackets` (boolean, default: `false`): Wrap identifiers in square brackets (e.g., `[TableName]`). Variables (`@var`, `@@sysvar`) and temporary tables (`#temp`, `##global`) are **never** bracketed, even when this setting is enabled.
- `tsqlFormatter.useMaxLineLength` (boolean, default: `true`): Enable line-length-based wrapping. When `true`, tokens that would push a line past `maxLineLength` are moved to a new indented continuation line. Set to `false` to disable all line-length wrapping.

Change these in VS Code Settings by searching for `tsqlFormatter`.

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

## Notes

- This extension focuses on formatting; it does not validate SQL semantics.
- Formatting results depend on your `tsqlFormatter.*` settings.
- `useBrackets` never applies to T-SQL variables (`@var`, `@@sysvar`) or temporary tables (`#temp`, `##global`).
- Subquery formatting applies to `(SELECT ...)` expressions anywhere they appear — in `FROM` clauses, `WHERE`/`IN`/`EXISTS`, `SELECT` column lists, and inside function arguments.
- Report issues or feature requests at https://github.com/JMatos1221/tsql-formatter/issues

License: MIT
