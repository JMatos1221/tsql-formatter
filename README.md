# tsql-formatter

A VS Code extension that formats T-SQL statements.

## Settings

- `tsqlFormatter.linesBetweenQueries` (number, default: `2`)
- `tsqlFormatter.breakOnKeywords` (boolean, default: `true`)
- `tsqlFormatter.keywordCase` (`upper` | `lower` | `preserve`, default: `preserve`)
- `tsqlFormatter.elementCase` (`upper` | `lower` | `preserve` | `matchTable`, default: `preserve`)
- `tsqlFormatter.useBrackets` (boolean, default: `false`)

## Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Press `F5` in VS Code to launch an Extension Development Host.
3. Open a SQL file and run **Format Document**.

## Manual test input

```sql
select foo.id, foo.name from foo join bar on foo.id = bar.foo_id where foo.active = 1 and bar.state = 'on'
select * from baz where baz.id = 10
```

Try changing settings in VS Code (`tsqlFormatter.*`) and format again.
