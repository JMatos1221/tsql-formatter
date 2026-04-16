# tsql-formatter

A VS Code extension that formats T-SQL statements.

- [tsql-formatter](#tsql-formatter)
  - [Install](#install)
  - [Use](#use)
  - [Settings](#settings)
  - [Notes](#notes)

## Install

Install `tsql-formatter` from the Visual Studio Code Extensions view:

1. Open Extensions in VS Code.
2. Search for `tsql-formatter`.
3. Select the extension and choose **Install**.

## Use

After installation, open a SQL file and run **Format Document**.

You can do that in any of these ways:

1. Right-click in the editor and choose **Format Document**.
2. Open the Command Palette and run **Format Document**.
3. Use your normal VS Code format shortcut.

If you want this extension to run automatically on save, enable **Editor: Format On Save** in VS Code.

## Settings

- `tsqlFormatter.linesBetweenQueries` (number, default: `2`)
- `tsqlFormatter.breakOnKeywords` (boolean, default: `true`)
- `tsqlFormatter.keywordCase` (`upper` | `lower` | `preserve`, default: `preserve`)
- `tsqlFormatter.elementCase` (`upper` | `lower` | `preserve` | `matchTable`, default: `preserve`)
- `tsqlFormatter.useBrackets` (boolean, default: `false`)

You can change these in VS Code Settings by searching for `tsqlFormatter`.

## Notes

- This extension is intended for T-SQL formatting.
- Formatting results depend on your current `tsqlFormatter.*` settings.
