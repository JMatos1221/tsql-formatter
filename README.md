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

- `tsqlFormatter.linesBetweenQueries` (number, default: `2`): Number of empty lines between top-level statements.
- `tsqlFormatter.breakOnKeywords` (boolean, default: `true`): Place keywords like `WHERE`, `JOIN`, `AND`, `OR` on their own lines.
- `tsqlFormatter.keywordCase` (`upper` | `lower` | `preserve`, default: `preserve`): Keyword casing mode.
- `tsqlFormatter.elementCase` (`upper` | `lower` | `preserve` | `matchTable`, default: `preserve`): Identifier casing for tables/columns.
- `tsqlFormatter.useBrackets` (boolean, default: `false`): Wrap identifiers in square brackets (e.g., `[TableName]`).

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

## Notes

- This extension focuses on formatting; it does not validate SQL semantics.
- Formatting results depend on your `tsqlFormatter.*` settings.
- Report issues or feature requests at https://github.com/JMatos1221/tsql-formatter/issues

License: MIT
