import * as vscode from 'vscode';

type CaseOption = 'upper' | 'lower' | 'preserve';
type KeywordCaseOption = 'upper' | 'lower' | 'preserve';

interface FormatterOptions {
  breakOnKeywords: boolean;
  identifierCase: CaseOption;
  keywordCase: KeywordCaseOption;
  linesBetweenQueries: number;
  maxLineLength: number;
  useBrackets: boolean;
  useMaxLineLength: boolean;
}

// --- Token definition ---
interface Token {
  type:
    | 'word'
    | 'string'
    | 'number'
    | 'operator'
    | 'comma'
    | 'oparen'
    | 'cparen'
    | 'dot'
    | 'semicolon'
    | 'star'
    | 'comment';
  value: string;
  // Precomputed upper-case value for 'word' tokens (empty string otherwise).
  // Every keyword/statement-boundary check in the hot parsing loop needs the
  // upper-cased form, often several times per token; computing it once here
  // avoids repeated toUpperCase() calls on the same string.
  upper: string;
}

function makeToken(type: Token['type'], value: string): Token {
  return { type, value, upper: type === 'word' ? value.toUpperCase() : '' };
}

// --- Keyword and function sets ---
const KEYWORDS = new Set([
  // DML
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'MERGE',
  'FROM',
  'WHERE',
  'SET',
  'VALUES',
  'INTO',
  // Joins
  'JOIN',
  'INNER',
  'LEFT',
  'RIGHT',
  'FULL',
  'OUTER',
  'CROSS',
  'ON',
  'APPLY',
  // Clauses
  'GROUP',
  'BY',
  'ORDER',
  'HAVING',
  'TOP',
  'DISTINCT',
  'UNION',
  'ALL',
  'EXCEPT',
  'INTERSECT',
  // Expressions
  'AS',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'AND',
  'OR',
  'NOT',
  'IN',
  'IS',
  'NULL',
  'LIKE',
  'BETWEEN',
  'EXISTS',
  'ASC',
  'DESC',
  // Window functions
  'OVER',
  'PARTITION',
  'ROWS',
  'RANGE',
  'UNBOUNDED',
  'PRECEDING',
  'FOLLOWING',
  'CURRENT',
  'ROW',
  // DDL
  'CREATE',
  'ALTER',
  'DROP',
  'TABLE',
  'VIEW',
  'INDEX',
  'PROCEDURE',
  'FUNCTION',
  'TRIGGER',
  'SCHEMA',
  'DATABASE',
  'PRIMARY',
  'KEY',
  'IDENTITY',
  'UNIQUE',
  'CLUSTERED',
  'NONCLUSTERED',
  'CONSTRAINT',
  'DEFAULT',
  'CHECK',
  'FOREIGN',
  'REFERENCES',
  'CASCADE',
  'ADD',
  'COLUMN',
  'TYPE',
  'SYNONYM',
  'SEQUENCE',
  'INCLUDE',
  'FILLFACTOR',
  'STATISTICS',
  // Data types
  'INT',
  'BIGINT',
  'SMALLINT',
  'TINYINT',
  'BIT',
  'DECIMAL',
  'NUMERIC',
  'FLOAT',
  'REAL',
  'MONEY',
  'SMALLMONEY',
  'CHAR',
  'VARCHAR',
  'NCHAR',
  'NVARCHAR',
  'TEXT',
  'NTEXT',
  'DATE',
  'DATETIME',
  'DATETIME2',
  'SMALLDATETIME',
  'TIME',
  'DATETIMEOFFSET',
  'BINARY',
  'VARBINARY',
  'IMAGE',
  'UNIQUEIDENTIFIER',
  'XML',
  'SQL_VARIANT',
  'TIMESTAMP',
  'ROWVERSION',
  'MAX',
  'HIERARCHYID',
  'GEOMETRY',
  'GEOGRAPHY',
  'SYSNAME',
  // Control flow
  'IF',
  'BEGIN',
  'END',
  'WHILE',
  'BREAK',
  'CONTINUE',
  'RETURN',
  'GOTO',
  'WAITFOR',
  'TRY',
  'CATCH',
  'THROW',
  'RAISERROR',
  // Transaction
  'COMMIT',
  'ROLLBACK',
  'TRAN',
  'TRANSACTION',
  'SAVE',
  // Cursor
  'CURSOR',
  'OPEN',
  'CLOSE',
  'FETCH',
  'DEALLOCATE',
  'NEXT',
  'PRIOR',
  'FIRST',
  'LAST',
  'ABSOLUTE',
  'RELATIVE',
  'SCROLL',
  'INSENSITIVE',
  'FAST_FORWARD',
  'READ_ONLY',
  'FORWARD_ONLY',
  'STATIC',
  'DYNAMIC',
  'KEYSET',
  'SCROLL_LOCKS',
  'OPTIMISTIC',
  'LOCAL',
  'GLOBAL',
  // Paging
  'OFFSET',
  'PERCENT',
  'TIES',
  // Query hints
  'OPTION',
  'RECOMPILE',
  'MAXRECURSION',
  'MAXDOP',
  'OPTIMIZE',
  'FOR',
  'FORCE',
  // Join hints
  'LOOP',
  'HASH',
  'REMOTE',
  // SET options
  'NOCOUNT',
  'XACT_ABORT',
  'ANSI_NULLS',
  'QUOTED_IDENTIFIER',
  'CONCAT_NULL_YIELDS_NULL',
  'ARITHABORT',
  'ANSI_PADDING',
  'ANSI_WARNINGS',
  'ROWCOUNT',
  // Full-text search
  'CONTAINS',
  'FREETEXT',
  'CONTAINSTABLE',
  'FREETEXTTABLE',
  // MERGE
  'MATCHED',
  'TARGET',
  'SOURCE',
  // Other
  'DECLARE',
  'PRINT',
  'EXEC',
  'EXECUTE',
  'WITH',
  'NOLOCK',
  'HOLDLOCK',
  'UPDLOCK',
  'ROWLOCK',
  'TABLOCK',
  'PAGLOCK',
  'XLOCK',
  'READCOMMITTED',
  'READUNCOMMITTED',
  'READPAST',
  'SERIALIZABLE',
  'SNAPSHOT',
  'NOWAIT',
  'NOEXPAND',
  'GO',
  'USE',
  'GRANT',
  'REVOKE',
  'DENY',
  'TRUNCATE',
  'OUTPUT',
  'INSERTED',
  'DELETED',
  'SOME',
  'ANY',
  'PIVOT',
  'UNPIVOT',
  'TABLESAMPLE',
  'OPENXML',
  'OPENQUERY',
  'OPENROWSET',
  'OPENDATASOURCE',
  'COLLATE',
  'ESCAPE',
  'BACKUP',
  'RESTORE',
  'DBCC',
  'ENABLE',
  'DISABLE',
  'BULK',
  'DELAY',
  // Pagination (OFFSET ... FETCH NEXT/FIRST ... ROWS ONLY)
  'FIRST',
  'ONLY',
  // GROUP BY extensions
  'ROLLUP',
  'CUBE',
  'GROUPING',
  'SETS',
  // Ordered-set / analytic functions
  'WITHIN',
  // Sequences
  'VALUE',
  // FOR XML / FOR JSON
  'XML',
  'JSON',
  'AUTO',
  'RAW',
  'EXPLICIT',
  'ROOT',
  'ELEMENTS',
  'XSINIL',
  'BINARY_BASE64',
  'WITHOUT_ARRAY_WRAPPER',
  'INCLUDE_NULL_VALUES',
  // Column definition modifiers
  'PERSISTED',
  'SPARSE',
  'FILESTREAM',
  'ROWGUIDCOL',
  'MASKED',
  'ENCRYPTED',
  // WITH options for views/procedures/functions
  'SCHEMABINDING',
  'ENCRYPTION',
  // EXECUTE AS context
  'CALLER',
  'SELF',
  'OWNER',
  // Table hints (additional)
  'TABLOCKX',
  'READCOMMITTEDLOCK',
  'REPEATABLEREAD',
  // SET IDENTITY_INSERT
  'IDENTITY_INSERT',
  // Multi-word keywords (merged tokens)
  'GROUP BY',
  'ORDER BY',
  'PARTITION BY',
  'INNER JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'FULL JOIN',
  'CROSS JOIN',
  'LEFT OUTER JOIN',
  'RIGHT OUTER JOIN',
  'FULL OUTER JOIN',
  'CROSS APPLY',
  'OUTER APPLY',
  'UNION ALL',
  'EXCEPT ALL',
  'INTERSECT ALL',
  'INSERT INTO',
  'DELETE FROM',
  'BEGIN TRY',
  'BEGIN CATCH',
  'BEGIN TRAN',
  'BEGIN TRANSACTION',
  'END TRY',
  'END CATCH',
  'PRIMARY KEY',
  'FOREIGN KEY',
  'IS NULL',
  'IS NOT NULL',
  'NOT NULL',
  'NOT IN',
  'NOT LIKE',
  'NOT BETWEEN',
  'NOT EXISTS',
  'GROUPING SETS',
  'WITH ROLLUP',
  'WITH CUBE',
  'WITHIN GROUP',
  'NEXT VALUE FOR',
  'EXECUTE AS',
  'FOR XML',
  'FOR JSON',
]);

const FUNCTIONS = new Set([
  // Aggregate
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'COUNT_BIG',
  'GROUPING',
  'GROUPING_ID',
  'CHECKSUM_AGG',
  'STDEV',
  'STDEVP',
  'VAR',
  'VARP',
  // Ranking/Window
  'ROW_NUMBER',
  'RANK',
  'DENSE_RANK',
  'NTILE',
  'LAG',
  'LEAD',
  'FIRST_VALUE',
  'LAST_VALUE',
  // String
  'LEN',
  'DATALENGTH',
  'SUBSTRING',
  'CHARINDEX',
  'PATINDEX',
  'REPLACE',
  'STUFF',
  'REPLICATE',
  'REVERSE',
  'SPACE',
  'LTRIM',
  'RTRIM',
  'TRIM',
  'UPPER',
  'LOWER',
  'CONCAT',
  'CONCAT_WS',
  'STRING_AGG',
  'STRING_SPLIT',
  'FORMAT',
  'ASCII',
  'UNICODE',
  'QUOTENAME',
  // Date
  'GETDATE',
  'GETUTCDATE',
  'SYSDATETIME',
  'SYSUTCDATETIME',
  'SYSDATETIMEOFFSET',
  'DATEADD',
  'DATEDIFF',
  'DATEDIFF_BIG',
  'DATENAME',
  'DATEPART',
  'DATETRUNC',
  'YEAR',
  'MONTH',
  'DAY',
  'EOMONTH',
  'ISDATE',
  'SWITCHOFFSET',
  'TODATETIMEOFFSET',
  // Conversion
  'CAST',
  'CONVERT',
  'TRY_CAST',
  'TRY_CONVERT',
  'PARSE',
  'TRY_PARSE',
  // Math
  'ABS',
  'CEILING',
  'FLOOR',
  'ROUND',
  'POWER',
  'SQRT',
  'SIGN',
  'LOG',
  'LOG10',
  'EXP',
  'PI',
  'RAND',
  'SQUARE',
  'SIN',
  'COS',
  'TAN',
  'ASIN',
  'ACOS',
  'ATAN',
  'ATN2',
  // Logical
  'IIF',
  'CHOOSE',
  'COALESCE',
  'NULLIF',
  // System
  'NEWID',
  'NEWSEQUENTIALID',
  'SCOPE_IDENTITY',
  'IDENT_CURRENT',
  'OBJECT_ID',
  'OBJECT_NAME',
  'DB_ID',
  'DB_NAME',
  'SCHEMA_ID',
  'SCHEMA_NAME',
  'TYPE_ID',
  'TYPE_NAME',
  'COL_NAME',
  'COL_LENGTH',
  'COLUMNPROPERTY',
  'OBJECTPROPERTY',
  'DATABASEPROPERTYEX',
  'SERVERPROPERTY',
  'ERROR_NUMBER',
  'ERROR_MESSAGE',
  'ERROR_SEVERITY',
  'ERROR_STATE',
  'ERROR_PROCEDURE',
  'ERROR_LINE',
  'APP_NAME',
  'HOST_NAME',
  'SUSER_NAME',
  'SUSER_SNAME',
  'SUSER_ID',
  'SUSER_SID',
  'USER_NAME',
  'USER_ID',
  // JSON
  'JSON_VALUE',
  'JSON_QUERY',
  'JSON_MODIFY',
  'ISJSON',
  'JSON_OBJECT',
  'JSON_ARRAY',
  'OPENJSON',
  // Analytics
  'PERCENTILE_CONT',
  'PERCENTILE_DISC',
  'CUME_DIST',
  'PERCENT_RANK',
  // String (additional)
  'STRING_ESCAPE',
  'TRANSLATE',
  'LEFT',
  'RIGHT',
  'CHAR',
  'NCHAR',
  // Metadata
  'OBJECT_DEFINITION',
  'INDEX_COL',
  'INDEXPROPERTY',
  'FILE_ID',
  'FILE_NAME',
  'FILEGROUP_ID',
  'FILEGROUP_NAME',
  // Aggregate (additional)
  'APPROX_COUNT_DISTINCT',
  // Other
  'ISNULL',
  'ISNUMERIC',
  'HASHBYTES',
  'CHECKSUM',
  'BINARY_CHECKSUM',
  'COMPRESS',
  'DECOMPRESS',
  'GREATEST',
  'LEAST',
  // Date construction
  'DATEFROMPARTS',
  'DATETIME2FROMPARTS',
  'DATETIMEFROMPARTS',
  'DATETIMEOFFSETFROMPARTS',
  'SMALLDATETIMEFROMPARTS',
  'TIMEFROMPARTS',
  // String (additional)
  'PARSENAME',
  'SOUNDEX',
  'DIFFERENCE',
  'STR',
  'FORMATMESSAGE',
  // Niladic system functions
  'CURRENT_TIMESTAMP',
  'CURRENT_USER',
  'SESSION_USER',
  'SYSTEM_USER',
  'CURRENT_TIMEZONE',
  'CURRENT_TIMEZONE_ID',
  // Metadata (additional)
  'OBJECTPROPERTYEX',
]);

// Data types that take a size/precision parameter in parentheses
const TYPES_WITH_PARAMS = new Set([
  'VARCHAR',
  'NVARCHAR',
  'CHAR',
  'NCHAR',
  'DECIMAL',
  'NUMERIC',
  'FLOAT',
  'VARBINARY',
  'BINARY',
  'DATETIME2',
  'DATETIMEOFFSET',
  'TIME',
]);

// Multi-word keywords: longest patterns first for greedy matching
const MULTI_WORD_KEYWORDS: string[][] = [
  // 3-word
  ['IS', 'NOT', 'NULL'],
  ['LEFT', 'OUTER', 'JOIN'],
  ['RIGHT', 'OUTER', 'JOIN'],
  ['FULL', 'OUTER', 'JOIN'],
  ['NEXT', 'VALUE', 'FOR'],
  // 2-word
  ['GROUP', 'BY'],
  ['ORDER', 'BY'],
  ['PARTITION', 'BY'],
  ['INNER', 'JOIN'],
  ['LEFT', 'JOIN'],
  ['RIGHT', 'JOIN'],
  ['FULL', 'JOIN'],
  ['CROSS', 'JOIN'],
  ['CROSS', 'APPLY'],
  ['OUTER', 'APPLY'],
  ['UNION', 'ALL'],
  ['EXCEPT', 'ALL'],
  ['INTERSECT', 'ALL'],
  ['INSERT', 'INTO'],
  ['DELETE', 'FROM'],
  ['BEGIN', 'TRY'],
  ['BEGIN', 'CATCH'],
  ['BEGIN', 'TRAN'],
  ['BEGIN', 'TRANSACTION'],
  ['END', 'TRY'],
  ['END', 'CATCH'],
  ['PRIMARY', 'KEY'],
  ['FOREIGN', 'KEY'],
  ['IS', 'NULL'],
  ['NOT', 'NULL'],
  ['NOT', 'IN'],
  ['NOT', 'LIKE'],
  ['NOT', 'BETWEEN'],
  ['NOT', 'EXISTS'],
  ['GROUPING', 'SETS'],
  ['WITH', 'ROLLUP'],
  ['WITH', 'CUBE'],
  ['WITHIN', 'GROUP'],
  ['EXECUTE', 'AS'],
  ['FOR', 'XML'],
  ['FOR', 'JSON'],
];

// Words that can immediately follow WITH as a procedure/function/view
// options clause rather than a CTE name (e.g. "WITH EXECUTE AS CALLER",
// "WITH SCHEMABINDING", "WITH CHECK OPTION"). A following "(" (table hints,
// or a parenthesized CTE column list) is handled separately by callers that
// already know which construct they're in.
const WITH_OPTION_KEYWORDS = new Set([
  'EXECUTE AS',
  'SCHEMABINDING',
  'ENCRYPTION',
  'RECOMPILE',
  'CHECK',
  'NATIVE_COMPILATION',
  'VIEW_METADATA',
]);

// Sets backing the parser's boundary checks. These are consulted on every
// token position while parsing (isStatementStart/isClauseKeyword/isJoinStart
// run far more often than any keyword lookup done during formatting), so a
// Set.has() lookup replaces what was previously a linear Array.includes()
// scan for each one.
const STATEMENT_START_KEYWORDS = new Set([
  'DECLARE',
  'INSERT',
  'INSERT INTO',
  'UPDATE',
  'DELETE',
  'DELETE FROM',
  'SELECT',
  'MERGE',
  'IF',
  'WHILE',
  'RETURN',
  'COMMIT',
  'ROLLBACK',
  'THROW',
  'PRINT',
  'EXEC',
  'EXECUTE',
  'TRUNCATE',
  'USE',
  'GO',
  'GRANT',
  'REVOKE',
  'DENY',
  'ALTER',
  'SET',
  'OPEN',
  'CLOSE',
  'FETCH',
  'DEALLOCATE',
  'RAISERROR',
  'BACKUP',
  'RESTORE',
  'DBCC',
  'BEGIN TRY',
  'BEGIN CATCH',
  'BEGIN TRAN',
  'BEGIN TRANSACTION',
]);

// Object keywords that can follow CREATE or DROP to start a DDL statement.
const CREATE_DROP_OBJECT_KEYWORDS = new Set([
  'TABLE',
  'VIEW',
  'PROCEDURE',
  'FUNCTION',
  'INDEX',
  'SCHEMA',
  'DATABASE',
  'TRIGGER',
  'TYPE',
  'SYNONYM',
  'SEQUENCE',
]);

const CLAUSE_KEYWORDS = new Set([
  'FROM',
  'WHERE',
  'SET',
  'VALUES',
  'HAVING',
  'GROUP BY',
  'ORDER BY',
  'UNION',
  'UNION ALL',
  'EXCEPT',
  'EXCEPT ALL',
  'INTERSECT',
  'INTERSECT ALL',
  'OUTPUT',
  'OFFSET',
  'FOR XML',
  'FOR JSON',
]);

const JOIN_START_KEYWORDS = new Set([
  'JOIN',
  'INNER JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'FULL JOIN',
  'CROSS JOIN',
  'LEFT OUTER JOIN',
  'RIGHT OUTER JOIN',
  'FULL OUTER JOIN',
  'CROSS APPLY',
  'OUTER APPLY',
]);

// Character classification by char code, avoiding a fresh regex test (and its
// match-object bookkeeping) on every single character of the document - the
// tokenizer's inner loop runs once per input character, so this adds up on
// large files.
function isWhitespaceCode(c: number): boolean {
  return c === 32 || (c >= 9 && c <= 13); // space, \t \n \v \f \r
}
function isDigitCode(c: number): boolean {
  return c >= 48 && c <= 57; // 0-9
}
function isWordStartCode(c: number): boolean {
  return (
    (c >= 65 && c <= 90) || // A-Z
    (c >= 97 && c <= 122) || // a-z
    c === 95 || // _
    c === 64 || // @
    c === 35 // #
  );
}
function isWordCharCode(c: number): boolean {
  return (
    (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95 // _
  );
}

// --- Tokenizer ---
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const len = input.length;
  let i = 0;

  while (i < len) {
    const code = input.charCodeAt(i);

    // Skip whitespace
    if (isWhitespaceCode(code)) {
      i++;
      continue;
    }

    // N-prefixed string literal (N'...')
    if ((input[i] === 'N' || input[i] === 'n') && input[i + 1] === "'") {
      let end = i + 2;
      while (end < len) {
        if (input[end] === "'" && input[end + 1] === "'") {
          end += 2;
        } else if (input[end] === "'") {
          end++;
          break;
        } else {
          end++;
        }
      }
      tokens.push(makeToken('string', input.slice(i, end)));
      i = end;
      continue;
    }

    // String literal
    if (input[i] === "'") {
      let end = i + 1;
      while (end < len) {
        if (input[end] === "'" && input[end + 1] === "'") {
          end += 2;
        } else if (input[end] === "'") {
          end++;
          break;
        } else {
          end++;
        }
      }
      tokens.push(makeToken('string', input.slice(i, end)));
      i = end;
      continue;
    }

    // Single-line comment
    if (input[i] === '-' && input[i + 1] === '-') {
      let end = i + 2;
      while (end < len && input[end] !== '\n') end++;
      tokens.push(makeToken('comment', input.slice(i, end).trim()));
      i = end;
      continue;
    }

    // Block comment
    if (input[i] === '/' && input[i + 1] === '*') {
      let end = i + 2;
      while (end < len && !(input[end] === '*' && input[end + 1] === '/')) end++;
      if (end < len) end += 2; // skip past closing */; if unclosed, end stays at input.length
      tokens.push(makeToken('comment', input.slice(i, end)));
      i = end;
      continue;
    }

    // Bracketed identifier [...]
    if (input[i] === '[') {
      let end = i + 1;
      while (end < len && input[end] !== ']') end++;
      if (end < len) end++; // include closing ]
      tokens.push(makeToken('word', input.slice(i, end)));
      i = end;
      continue;
    }

    // Double-quoted identifier "..."
    if (input[i] === '"') {
      let end = i + 1;
      while (end < len && input[end] !== '"') end++;
      if (end < len) end++; // include closing "
      tokens.push(makeToken('word', input.slice(i, end)));
      i = end;
      continue;
    }

    // Word (identifier, keyword, variable, system variable)
    if (isWordStartCode(code)) {
      let end = i;
      if (input[i] === '@' && input[i + 1] === '@') end = i + 2;
      else if (input[i] === '#' && input[i + 1] === '#') end = i + 2;
      else if (input[i] === '@' || input[i] === '#') end = i + 1;

      while (end < len && isWordCharCode(input.charCodeAt(end))) end++;
      tokens.push(makeToken('word', input.slice(i, end)));
      i = end;
      continue;
    }

    // Number
    if (isDigitCode(code)) {
      let end = i;
      while (end < len && (isDigitCode(input.charCodeAt(end)) || input[end] === '.')) end++;
      tokens.push(makeToken('number', input.slice(i, end)));
      i = end;
      continue;
    }

    // Punctuation and operators
    if (input[i] === '(') {
      tokens.push(makeToken('oparen', '('));
      i++;
      continue;
    }
    if (input[i] === ')') {
      tokens.push(makeToken('cparen', ')'));
      i++;
      continue;
    }
    if (input[i] === ',') {
      tokens.push(makeToken('comma', ','));
      i++;
      continue;
    }
    if (input[i] === '.') {
      tokens.push(makeToken('dot', '.'));
      i++;
      continue;
    }
    if (input[i] === ';') {
      tokens.push(makeToken('semicolon', ';'));
      i++;
      continue;
    }
    if (input[i] === '*') {
      tokens.push(makeToken('star', '*'));
      i++;
      continue;
    }

    // Multi-char operators
    if (input[i] === '<' && input[i + 1] === '>') {
      tokens.push(makeToken('operator', '<>'));
      i += 2;
      continue;
    }
    if (input[i] === '!' && input[i + 1] === '=') {
      tokens.push(makeToken('operator', '!='));
      i += 2;
      continue;
    }
    if (input[i] === '>' && input[i + 1] === '=') {
      tokens.push(makeToken('operator', '>='));
      i += 2;
      continue;
    }
    if (input[i] === '<' && input[i + 1] === '=') {
      tokens.push(makeToken('operator', '<='));
      i += 2;
      continue;
    }

    // Single char operators
    if ('=<>+-/%'.includes(input[i])) {
      tokens.push(makeToken('operator', input[i]));
      i++;
      continue;
    }

    // Anything else (e.g. brackets)
    tokens.push(makeToken('operator', input[i]));
    i++;
  }

  return tokens;
}

// Candidate patterns grouped by their first word, so a token only needs to
// try the handful of multi-word keywords that could plausibly start with it
// instead of scanning the entire MULTI_WORD_KEYWORDS list. Insertion order
// within each group is preserved (longest-pattern-first, per the source
// array), which keeps the existing greedy-match precedence intact.
const MULTI_WORD_BY_FIRST_WORD: Map<string, string[][]> = new Map();
for (const pattern of MULTI_WORD_KEYWORDS) {
  const key = pattern[0];
  const group = MULTI_WORD_BY_FIRST_WORD.get(key);
  if (group) group.push(pattern);
  else MULTI_WORD_BY_FIRST_WORD.set(key, [pattern]);
}

// Merge consecutive word tokens that form multi-word keywords
function mergeMultiWordKeywords(tokens: Token[]): Token[] {
  const result: Token[] = [];
  const len = tokens.length;
  let i = 0;

  while (i < len) {
    const tok = tokens[i];
    if (tok.type === 'word') {
      const candidates = MULTI_WORD_BY_FIRST_WORD.get(tok.upper);
      let matched = false;
      if (candidates) {
        for (const pattern of candidates) {
          if (i + pattern.length > len) continue;
          let allMatch = true;
          for (let j = 1; j < pattern.length; j++) {
            const t = tokens[i + j];
            if (t.type !== 'word' || t.upper !== pattern[j]) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) {
            const value = tokens
              .slice(i, i + pattern.length)
              .map((t) => t.value)
              .join(' ');
            result.push({ type: 'word', value, upper: pattern.join(' ') });
            i += pattern.length;
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        result.push(tok);
        i++;
      }
    } else {
      result.push(tok);
      i++;
    }
  }

  return result;
}

// --- Casing helpers ---
function applyCase(value: string, option: string): string {
  if (option === 'upper') return value.toUpperCase();
  if (option === 'lower') return value.toLowerCase();
  return value;
}

function isKeywordLike(token: Token): boolean {
  if (token.value.startsWith('[') || token.value.startsWith('"')) return false;
  return KEYWORDS.has(token.upper) || FUNCTIONS.has(token.upper) || token.value.startsWith('@@');
}

// --- Formatter class ---
const INDENT_SIZE = 4;

class SqlFormatter {
  private tokens: Token[];
  private pos: number = 0;
  private lines: string[] = [];
  private currentLine: string = '';
  private indent: number = 0;
  private options: FormatterOptions;

  constructor(tokens: Token[], options: FormatterOptions) {
    this.tokens = tokens;
    this.options = options;
  }

  format(): string {
    this.formatStatementList(false);
    this.finishLine();
    return this.lines.join('\n').trim() + '\n';
  }

  // --- Token navigation ---
  private peek(offset: number = 0): Token | null {
    return this.tokens[this.pos + offset] ?? null;
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private atEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  private upper(offset: number = 0): string {
    const t = this.peek(offset);
    return t?.type === 'word' ? t.upper : '';
  }

  private isWordAt(offset: number, ...expected: string[]): boolean {
    const u = this.upper(offset);
    return expected.includes(u);
  }

  private isType(offset: number, type: string): boolean {
    return this.peek(offset)?.type === type;
  }

  // --- Output helpers ---
  private emit(text: string): void {
    this.currentLine += text;
  }

  private finishLine(): void {
    // Preserve trailing spaces on content lines (used for continuation indicators)
    // Only trim whitespace-only lines to empty strings
    const line = this.currentLine;
    this.lines.push(line.trim() === '' ? '' : line);
    this.currentLine = '';
  }

  private newLine(indentSpaces?: number): void {
    this.finishLine();
    this.currentLine = ' '.repeat(indentSpaces ?? this.indent);
  }

  private blankLines(count: number): void {
    this.finishLine();
    for (let i = 0; i < count; i++) this.lines.push('');
  }

  private lineAt(col: number): void {
    this.finishLine();
    this.currentLine = ' '.repeat(col);
  }

  private wrapBeforeTokenIfNeeded(token: Token, tokenText: string): void {
    if (!this.options.useMaxLineLength) return;
    if (this.options.maxLineLength <= 0) return;
    if (this.currentLine.trim().length === 0) return;
    if (['comma', 'cparen', 'semicolon', 'dot'].includes(token.type)) return;
    if (this.currentLine.length + tokenText.length <= this.options.maxLineLength) return;

    if (this.currentLine.endsWith(' ')) {
      this.currentLine = this.currentLine.slice(0, -1);
    }
    const lineIndent = this.currentLine.length - this.currentLine.trimStart().length;
    this.newLine(lineIndent + INDENT_SIZE);
  }

  // --- Casing ---
  private caseWord(token: Token): string {
    if (token.type !== 'word') return token.value;
    // Preserve bracketed and double-quoted identifiers
    if (token.value.startsWith('[') || token.value.startsWith('"')) return token.value;
    if (isKeywordLike(token)) {
      return applyCase(token.value, this.options.keywordCase);
    }
    return this.applyIdentifierCasing(token);
  }

  private applyIdentifierCasing(token: Token): string {
    // Preserve bracketed and double-quoted identifiers
    if (token.value.startsWith('[') || token.value.startsWith('"')) return token.value;
    const opt = this.options.identifierCase;
    let value = token.value;
    if (opt === 'upper' || opt === 'lower') value = applyCase(value, opt);
    // Variables (@var, @@sysvar) and temp tables (#temp, ##global) must never be bracketed
    if (this.options.useBrackets && !token.value.startsWith('@') && !token.value.startsWith('#')) {
      value = `[${value}]`;
    }
    return value;
  }

  // --- Comment emission ---

  // Safely emit comment text, handling multi-line block comments by splitting
  // on embedded newlines so that currentLine tracking stays correct.
  private emitCommentText(text: string): void {
    if (!text.includes('\n')) {
      this.emit(text);
      return;
    }
    // Multi-line block comment: emit the first line onto currentLine, then
    // push each subsequent line as a standalone line preserving the comment's
    // own internal whitespace (e.g. leading " * " prefixes).
    const parts = text.split('\n');
    this.emit(parts[0].trimEnd());
    for (let i = 1; i < parts.length; i++) {
      this.finishLine();
      this.currentLine = parts[i].trimEnd();
    }
  }

  private emitToken(token: Token): void {
    if (token.type === 'comment') {
      this.emitCommentText(token.value);
      return;
    }
    const tokenText = this.caseWord(token);
    this.wrapBeforeTokenIfNeeded(token, tokenText);
    this.emit(tokenText);
  }

  // --- Spacing logic ---
  private needsSpaceBefore(token: Token, prev: Token | null): boolean {
    if (!prev) return false;
    if (prev.type === 'oparen') return false;
    if (token.type === 'cparen') return false;
    if (token.type === 'comma') return false;
    if (prev.type === 'dot' || token.type === 'dot') return false;
    if (token.type === 'semicolon') return false;

    // No space between function/type name and (
    if (token.type === 'oparen' && prev.type === 'word') {
      const upper = prev.value.toUpperCase();
      if (FUNCTIONS.has(upper) || TYPES_WITH_PARAMS.has(upper) || upper === 'OVER') return false;
    }

    return true;
  }

  // --- Statement boundary detection ---
  private isEndKeyword(): boolean {
    const u = this.upper();
    return u === 'END' || u === 'END TRY' || u === 'END CATCH';
  }

  private isStatementStart(): boolean {
    const u = this.upper();

    // A bare ELSE always closes the preceding single-statement IF/WHILE body
    // (e.g. "IF x PRINT 'a' ELSE PRINT 'b'") - it never legitimately appears
    // as part of an inline expression, so treat it like any other boundary.
    if (u === 'ELSE') return true;

    // WITH is ambiguous: it starts a CTE ("WITH cte AS (...)") but is also a
    // procedure/function/view options clause ("WITH EXECUTE AS CALLER",
    // "WITH SCHEMABINDING", "WITH ENCRYPTION", "WITH CHECK OPTION"). Only
    // treat it as a fresh statement when a real CTE could follow.
    if (u === 'WITH') return !WITH_OPTION_KEYWORDS.has(this.upper(1));

    if (STATEMENT_START_KEYWORDS.has(u)) return true;
    if (u === 'CREATE' && CREATE_DROP_OBJECT_KEYWORDS.has(this.upper(1))) return true;
    if (u === 'DROP' && CREATE_DROP_OBJECT_KEYWORDS.has(this.upper(1))) return true;
    if (u === 'BEGIN') return true;
    if (this.isEndKeyword()) return true;
    return false;
  }

  // --- Generic inline statement bounded by its own terminator ---
  // Used for statements whose bodies legitimately contain DML keywords as
  // sub-clauses or literal names rather than as fresh statement starts:
  // MERGE's "WHEN [NOT] MATCHED THEN UPDATE/INSERT/DELETE" actions, and
  // GRANT/REVOKE/DENY permission lists like "SELECT, INSERT, UPDATE". Rather
  // than guessing which bare keywords are safe, everything is written
  // inline up to the statement's own semicolon (or GO, or end of input).
  private formatInlineStatementToTerminator(): void {
    if (this.atEnd()) return;
    this.emitToken(this.advance());
    const atTerminator = () => this.peek()?.type === 'semicolon' || this.upper() === 'GO';
    if (!this.atEnd() && !atTerminator()) {
      this.emit(' ');
      this.writeInlineUntil(atTerminator);
    }
    if (this.peek()?.type === 'semicolon') {
      this.emit(this.advance().value); // ;
    }
  }

  // Is current position a clause keyword within a DML statement?
  private isClauseKeyword(): boolean {
    const u = this.upper();
    if (CLAUSE_KEYWORDS.has(u)) return true;
    if (this.isJoinStart()) return true;
    if (u === 'ON') return true;
    return false;
  }

  private isJoinStart(): boolean {
    return JOIN_START_KEYWORDS.has(this.upper());
  }

  private isAndOr(): boolean {
    const u = this.upper();
    return u === 'AND' || u === 'OR';
  }

  // Returns true when the current position is an opening paren that contains a subquery
  private isSubqueryStart(): boolean {
    if (this.peek()?.type !== 'oparen') return false;
    // Skip any comment tokens immediately after ( to find the first meaningful token
    let offset = 1;
    while (this.peek(offset)?.type === 'comment') offset++;
    const inner = this.peek(offset);
    if (!inner || inner.type !== 'word') return false;
    return inner.value.toUpperCase() === 'SELECT';
  }

  // --- Statement list formatter ---
  private formatStatementList(insideBlock: boolean): void {
    let first = true;
    while (!this.atEnd()) {
      // Check for block end
      if (insideBlock) {
        const u = this.upper();
        if (this.isEndKeyword() || u === 'ELSE') break;
      }

      // Skip semicolons between statements
      while (this.peek()?.type === 'semicolon') this.advance();
      if (this.atEnd()) break;
      if (insideBlock && (this.isEndKeyword() || this.upper() === 'ELSE')) break;

      if (first) {
        // Flush any content the caller left on the current line
        // (e.g., "BEGIN TRY" from formatBeginTryCatch)
        this.finishLine();
      } else {
        // If the next statement is a GO batch separator, only break to a
        // new line (no extra blank lines), since GO conceptually belongs
        // directly after the previous batch as a confirmation token.
        const nextToken = this.peek();
        const nextWord = nextToken?.type === 'word' ? nextToken.value.toUpperCase() : '';
        if (nextWord === 'GO') {
          this.finishLine();
        } else {
          this.blankLines(this.options.linesBetweenQueries);
        }
      }
      this.currentLine = ' '.repeat(this.indent);

      // Emit any comment lines that immediately precede the next statement.
      // They are associated with the statement, so no blank line is inserted
      // between the comment block and the code that follows it.
      while (!this.atEnd() && this.peek()?.type === 'comment') {
        this.emitCommentText(this.advance().value);
        this.newLine(this.indent);
        // Re-check block exit conditions in case the comment was the last
        // token before END / ELSE inside a BEGIN...END block.
        if (insideBlock && (this.isEndKeyword() || this.upper() === 'ELSE')) break;
      }
      if (this.atEnd()) break;
      if (insideBlock && (this.isEndKeyword() || this.upper() === 'ELSE')) break;

      // Safety net: formatStatement() must always advance past at least one
      // token. If a future keyword combination slips through without making
      // progress, force it here instead of looping forever on the same token.
      const posBefore = this.pos;
      this.formatStatement();
      if (this.pos === posBefore && !this.atEnd()) {
        this.emitToken(this.advance());
      }
      first = false;
    }
  }

  // --- Statement dispatcher ---
  private formatStatement(): void {
    const u = this.upper();
    switch (u) {
      case 'DECLARE':
        return this.formatDeclare();
      case 'CREATE':
        return this.formatCreate();
      case 'DROP':
        return this.formatDrop();
      case 'INSERT':
      case 'INSERT INTO':
        return this.formatInsert();
      case 'UPDATE':
        return this.formatUpdate();
      case 'DELETE':
      case 'DELETE FROM':
        return this.formatDelete();
      case 'SELECT':
        return this.formatSelectStatement();
      case 'MERGE':
        return this.formatInlineStatementToTerminator();
      case 'WITH':
        return this.formatWith();
      case 'IF':
        return this.formatIf();
      case 'WHILE':
        return this.formatWhile();
      case 'BEGIN':
        return this.formatBegin();
      case 'BEGIN TRY':
      case 'BEGIN CATCH':
        return this.formatBeginTryCatch();
      case 'BEGIN TRAN':
      case 'BEGIN TRANSACTION':
        return this.formatBeginTran();
      case 'COMMIT':
      case 'ROLLBACK':
        return this.formatTransactionCmd();
      case 'THROW':
      case 'RAISERROR':
      case 'RETURN':
        return this.formatSimpleCmd();
      case 'EXEC':
      case 'EXECUTE':
        return this.formatExec();
      case 'PRINT':
        return this.formatPrint();
      case 'SET':
        return this.formatSetStatement();
      case 'TRUNCATE':
        return this.formatGenericLine();
      case 'USE':
        return this.formatUse();
      case 'GO':
        return this.formatGo();
      case 'GRANT':
      case 'REVOKE':
      case 'DENY':
        return this.formatInlineStatementToTerminator();
      case 'ALTER':
      case 'OPEN':
      case 'CLOSE':
      case 'FETCH':
      case 'DEALLOCATE':
      case 'BACKUP':
      case 'RESTORE':
      case 'DBCC':
        return this.formatGenericLine();
      case 'END':
      case 'END TRY':
      case 'END CATCH':
        // Orphan END at top level (outside a block) - emit and move on
        this.emitToken(this.advance());
        return;
      default:
        return this.formatGenericLine();
    }
  }

  // --- DECLARE ---
  private formatDeclare(): void {
    this.emitToken(this.advance()); // DECLARE
    this.emit(' ');
    this.writeInlineUntil(() => this.isStatementStart());
  }

  // --- CREATE TABLE ---
  private formatCreate(): void {
    const u1 = this.upper(1);
    if (u1 === 'TABLE') {
      this.formatCreateTable();
    } else {
      this.formatGenericLine();
    }
  }

  private formatCreateTable(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // CREATE
    this.emit(' ');
    this.emitToken(this.advance()); // TABLE
    this.emit(' ');

    // Table name (possibly schema.table)
    this.writeTableRef();

    // Expect (
    if (this.peek()?.type !== 'oparen') return;

    this.emit(' ');
    this.emit(this.advance().value); // (

    // Column definitions - one per line
    const colIndent = stmtIndent + INDENT_SIZE;
    while (!this.atEnd() && this.peek()?.type !== 'cparen') {
      this.newLine(colIndent);
      this.writeInlineUntil(() => this.peek()?.type === 'comma' || this.peek()?.type === 'cparen');
      if (this.peek()?.type === 'comma') {
        this.emit(this.advance().value); // ,
      }
    }

    // Closing )
    this.newLine(stmtIndent);
    if (this.peek()?.type === 'cparen') {
      this.emit(this.advance().value); // )
    }
    // Optional trailing semicolon
    if (this.peek()?.type === 'semicolon') {
      this.emit(this.advance().value);
    }
  }

  // --- DROP ---
  private formatDrop(): void {
    this.emitToken(this.advance()); // DROP
    this.emit(' ');
    this.emitToken(this.advance()); // TABLE/VIEW/etc
    this.emit(' ');
    this.writeInlineUntil(() => this.isStatementStart());
  }

  // --- INSERT ---
  private formatInsert(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // INSERT or INSERT INTO (merged)
    this.emit(' ');

    // INTO (only if not already part of merged token)
    if (this.upper() === 'INTO') {
      this.emitToken(this.advance());
      this.emit(' ');
    }

    // Table name and optional column list
    this.writeInlineUntil(
      () => this.isWordAt(0, 'VALUES', 'SELECT', 'EXEC', 'EXECUTE') || this.isStatementStart(),
    );

    if (this.upper() === 'VALUES') {
      this.newLine(stmtIndent);
      this.emitToken(this.advance()); // VALUES
      this.emit(' ');
      this.writeInlineUntil(() => this.isStatementStart());
    } else if (this.upper() === 'SELECT') {
      this.newLine(stmtIndent);
      this.formatSelectQuery(stmtIndent);
    }
  }

  // --- UPDATE ---
  private formatUpdate(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // UPDATE
    this.emit(' ');
    this.writeTableRef();

    // SET clause
    if (this.upper() === 'SET') {
      this.newLine(stmtIndent);
      this.emitToken(this.advance()); // SET
      this.emit(' ');
      this.writeSetClause(stmtIndent);
    }

    this.formatOptionalClauses(stmtIndent);
  }

  private writeSetClause(stmtIndent: number): void {
    let prevToken: Token | null = null;
    while (!this.atEnd()) {
      if (this.isClauseKeyword() || this.isStatementStart()) break;

      const token = this.peek()!;

      // Handle CASE expression
      if (token.type === 'word' && token.value.toUpperCase() === 'CASE') {
        if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
        this.formatCaseExpression(stmtIndent);
        prevToken = null;
        continue;
      }

      if (token.type === 'oparen') {
        if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
        if (this.isSubqueryStart()) {
          this.writeSubquery();
        } else {
          this.writeInlineParens();
        }
        prevToken = makeToken('cparen', ')');
        continue;
      }

      // Handle inline comments (same rules as writeInlineUntil)
      if (token.type === 'comment') {
        if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
        this.advance();
        this.emitCommentText(token.value);
        if (token.value.startsWith('--') || token.value.includes('\n')) {
          break;
        }
        prevToken = token;
        continue;
      }

      this.advance();
      if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
      this.emitToken(token);
      prevToken = token;
    }
  }

  // --- DELETE ---
  private formatDelete(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // DELETE or DELETE FROM (merged)

    // Optional FROM (only if not already part of merged token)
    if (this.upper() === 'FROM') {
      this.emit(' ');
      this.emitToken(this.advance()); // FROM
    }

    this.emit(' ');
    this.writeTableRef();

    // Trailing space if WHERE follows
    if (this.upper() === 'WHERE') this.emit(' ');

    this.formatOptionalClauses(stmtIndent);
  }

  // --- SELECT (standalone) ---
  private formatSelectStatement(): void {
    this.formatSelectQuery(this.indent);
  }

  private formatSelectQuery(stmtIndent: number): void {
    this.emitToken(this.advance()); // SELECT

    // DISTINCT / TOP N - keep on SELECT line
    if (this.upper() === 'DISTINCT') {
      this.emit(' ');
      this.emitToken(this.advance());
    }
    if (this.upper() === 'TOP') {
      this.emit(' ');
      this.emitToken(this.advance()); // TOP
      this.emit(' ');
      // Number or expression
      if (this.peek()?.type === 'oparen') {
        this.writeInlineParens();
      } else {
        this.emitToken(this.advance()); // the number
      }
    }

    // SELECT columns - one per line, indented
    this.formatSelectColumns(stmtIndent);

    // Clauses
    this.formatOptionalClauses(stmtIndent);
  }

  private formatSelectColumns(stmtIndent: number): void {
    const colIndent = stmtIndent + INDENT_SIZE;
    let firstCol = true;

    while (!this.atEnd()) {
      if (this.isClauseKeyword() || this.isStatementStart()) break;
      // Also stop at END keyword (for subqueries inside CASE)
      if (this.isEndKeyword()) break;
      // Stop at close paren (for subqueries in parentheses)
      if (this.peek()?.type === 'cparen') break;

      if (!firstCol) {
        // Consume the comma token from the stream
        if (this.peek()?.type === 'comma') this.advance();
      }

      this.newLine(colIndent);
      this.writeInlineUntil(() => {
        if (this.peek()?.type === 'comma') return true;
        if (this.peek()?.type === 'cparen') return true;
        if (this.isClauseKeyword()) return true;
        if (this.isStatementStart()) return true;
        if (this.isEndKeyword()) return true;
        return false;
      });

      // Emit the comma at the end of the column line (if more columns follow)
      if (this.peek()?.type === 'comma') {
        this.emit(',');
      }

      firstCol = false;
    }
  }

  // --- WITH (CTE) ---
  private formatWith(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // WITH
    this.emit(' ');

    // CTE definitions (possibly multiple, comma-separated)
    let firstCte = true;
    while (!this.atEnd()) {
      if (!firstCte) {
        this.emit(',');
        this.newLine(stmtIndent);
      }

      // CTE name
      this.emitToken(this.advance());
      this.emit(' ');

      // AS
      if (this.upper() === 'AS') {
        this.emitToken(this.advance());
        this.emit(' ');
      }

      // (
      if (this.peek()?.type === 'oparen') {
        this.emit(this.advance().value); // (

        // Format the CTE body (a SELECT query)
        const bodyIndent = stmtIndent + INDENT_SIZE;
        this.newLine(bodyIndent);
        this.indent = bodyIndent;
        this.formatSelectQuery(bodyIndent);
        this.indent = stmtIndent;

        // )
        this.newLine(stmtIndent);
        if (this.peek()?.type === 'cparen') {
          this.emit(this.advance().value); // )
        }
      }

      firstCte = false;

      // Check for another CTE (comma separator).
      // The comma is consumed here; it is re-emitted via this.emit(",") at the
      // top of the next iteration so it appears before the next CTE name.
      if (this.peek()?.type !== 'comma') break;
      this.advance(); // consume comma
    }

    // The DML statement after the CTE
    this.newLine(stmtIndent);
    this.formatDmlAfterCte();
  }

  private formatDmlAfterCte(): void {
    switch (this.upper()) {
      case 'UPDATE':
        return this.formatUpdate();
      case 'INSERT':
      case 'INSERT INTO':
        return this.formatInsert();
      case 'DELETE':
      case 'DELETE FROM':
        return this.formatDelete();
      case 'SELECT':
        return this.formatSelectStatement();
      case 'MERGE':
        return this.formatInlineStatementToTerminator();
      default:
        return this.formatGenericLine();
    }
  }

  // --- Optional clauses (FROM, WHERE, JOIN, GROUP BY, ORDER BY, HAVING, etc.) ---
  private formatOptionalClauses(stmtIndent: number): void {
    while (!this.atEnd()) {
      const u = this.upper();

      if (this.isStatementStart()) break;
      // Stop at close paren (e.g., end of CTE body)
      if (this.peek()?.type === 'cparen') break;

      // A statement terminator here means the last clause (FROM/JOIN, whose
      // own table-reference parsing doesn't absorb trailing tokens the way
      // writeInlineUntil-based clauses do) left it dangling - emit it so it
      // isn't silently dropped by the caller's semicolon-skipping.
      if (this.peek()?.type === 'semicolon') {
        this.emit(this.advance().value);
        continue;
      }

      // Comments between clauses: emit on their own line at the clause indent
      // level so they stay visually associated with the surrounding SQL.
      if (this.peek()?.type === 'comment') {
        this.newLine(stmtIndent);
        this.emitCommentText(this.advance().value);
        continue;
      }

      if (u === 'FROM') {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // FROM
        this.emit(' ');
        this.writeTableRef();
        continue;
      }

      if (this.isJoinStart()) {
        this.formatJoinClause(stmtIndent);
        continue;
      }

      if (u === 'ON') {
        this.newLine(stmtIndent + INDENT_SIZE);
        this.emitToken(this.advance()); // ON
        this.emit(' ');
        this.writeInlineUntil(
          () => this.isClauseKeyword() || this.isStatementStart() || this.peek()?.type === 'cparen',
        );
        continue;
      }

      if (u === 'WHERE') {
        this.formatWhereClause(stmtIndent);
        continue;
      }

      if (u === 'GROUP BY') {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // GROUP BY
        this.emit(' ');
        this.writeInlineUntil(
          () => this.isClauseKeyword() || this.isStatementStart() || this.peek()?.type === 'cparen',
        );
        continue;
      }

      if (u === 'ORDER BY') {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // ORDER BY
        this.emit(' ');
        this.writeInlineUntil(
          () => this.isClauseKeyword() || this.isStatementStart() || this.peek()?.type === 'cparen',
        );
        continue;
      }

      if (u === 'HAVING') {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // HAVING
        this.emit(' ');
        this.writeInlineUntil(
          () => this.isClauseKeyword() || this.isStatementStart() || this.peek()?.type === 'cparen',
        );
        continue;
      }

      if (u === 'OUTPUT') {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // OUTPUT
        this.emit(' ');
        this.writeInlineUntil(
          () => this.isClauseKeyword() || this.isStatementStart() || this.peek()?.type === 'cparen',
        );
        continue;
      }

      if (
        u === 'UNION' ||
        u === 'UNION ALL' ||
        u === 'EXCEPT' ||
        u === 'EXCEPT ALL' ||
        u === 'INTERSECT' ||
        u === 'INTERSECT ALL'
      ) {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // UNION/UNION ALL/EXCEPT/INTERSECT etc.
        this.newLine(stmtIndent);
        if (this.upper() === 'SELECT') {
          this.formatSelectQuery(stmtIndent);
        }
        continue;
      }

      // OFFSET-FETCH pagination: OFFSET <n> ROWS [FETCH NEXT|FIRST <n> ROWS ONLY]
      if (u === 'OFFSET') {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // OFFSET
        this.emit(' ');
        this.writeInlineUntil(
          () =>
            this.isWordAt(0, 'FETCH') ||
            this.isClauseKeyword() ||
            this.isStatementStart() ||
            this.peek()?.type === 'cparen',
        );
        if (this.isWordAt(0, 'FETCH')) {
          this.emit(' ');
          this.emitToken(this.advance()); // FETCH
          this.emit(' ');
          this.writeInlineUntil(
            () =>
              this.isClauseKeyword() || this.isStatementStart() || this.peek()?.type === 'cparen',
          );
        }
        continue;
      }

      if (u === 'FOR XML' || u === 'FOR JSON') {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // FOR XML / FOR JSON
        this.emit(' ');
        this.writeInlineUntil(
          () => this.isClauseKeyword() || this.isStatementStart() || this.peek()?.type === 'cparen',
        );
        continue;
      }

      // Unknown clause - stop
      break;
    }
  }

  // --- JOIN clause ---
  private formatJoinClause(stmtIndent: number): void {
    this.newLine(stmtIndent);

    // With merged tokens, the entire join keyword is a single token
    // (e.g., "LEFT OUTER JOIN", "INNER JOIN", "CROSS APPLY", or plain "JOIN")
    const joinUpper = this.upper();
    this.emitToken(this.advance());

    this.emit(' ');
    // APPLY takes table-valued functions with parenthesized arguments
    const isApply = joinUpper.endsWith('APPLY');
    this.writeTableRef(isApply);

    // ON clause (not used with APPLY or CROSS JOIN)
    if (this.upper() === 'ON') {
      // Trailing space after table ref on the JOIN line
      this.emit(' ');
      this.newLine(stmtIndent + INDENT_SIZE);
      this.emitToken(this.advance()); // ON
      this.emit(' ');
      this.writeInlineUntil(() => this.isClauseKeyword() || this.isStatementStart());
    }
  }

  // --- WHERE clause ---
  private formatWhereClause(stmtIndent: number): void {
    this.newLine(stmtIndent);
    this.emitToken(this.advance()); // WHERE
    this.emit(' ');

    const stopCondition = () =>
      this.isAndOr() ||
      this.isClauseKeywordNotAndOr() ||
      this.isStatementStart() ||
      this.peek()?.type === 'cparen';

    // First condition
    this.writeInlineUntil(stopCondition);
    // Trailing space if AND/OR continuation follows
    if (this.isAndOr()) this.emit(' ');

    // AND/OR continuations - aligned so conditions line up with WHERE condition
    // WHERE has 6 chars (including trailing space), AND has 4, OR has 3
    // AND indent = stmtIndent + 6 - 4 = stmtIndent + 2
    // OR  indent = stmtIndent + 6 - 3 = stmtIndent + 3
    while (this.isAndOr()) {
      const kw = this.upper();
      const alignIndent = kw === 'AND' ? stmtIndent + 2 : stmtIndent + 3;
      this.newLine(alignIndent);
      this.emitToken(this.advance()); // AND or OR
      this.emit(' ');
      this.writeInlineUntil(stopCondition);
    }
  }

  private isClauseKeywordNotAndOr(): boolean {
    const u = this.upper();
    if (u === 'AND' || u === 'OR') return false;
    return this.isClauseKeyword();
  }

  // --- CASE expression ---
  private formatCaseExpression(lineIndent: number): void {
    const caseCol = this.currentLine.length;
    this.emitToken(this.advance()); // CASE

    // Check for simple CASE (CASE expr WHEN ...)
    if (!this.isWordAt(0, 'WHEN', 'ELSE', 'END')) {
      this.emit(' ');
      this.writeInlineUntil(() => this.isWordAt(0, 'WHEN', 'ELSE', 'END'));
    }

    // Trailing space after CASE keyword line
    this.emit(' ');

    // WHEN/ELSE/END clauses
    while (!this.atEnd()) {
      const u = this.upper();

      if (u === 'WHEN' || u === 'ELSE') {
        this.lineAt(caseCol);
        this.emitToken(this.advance()); // WHEN or ELSE
        this.emit(' ');
        this.writeInlineUntil(() => this.isWordAt(0, 'WHEN', 'ELSE', 'END'));
        continue;
      }

      if (u === 'END') {
        this.lineAt(lineIndent + INDENT_SIZE);
        this.emitToken(this.advance()); // END
        break;
      }

      break;
    }
  }

  // --- IF statement ---
  private formatIf(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // IF
    this.emit(' ');

    // Write condition (everything until BEGIN or a statement start that's not part of the condition)
    this.writeInlineUntil(
      () =>
        this.upper() === 'BEGIN' ||
        this.upper() === 'BEGIN TRY' ||
        (this.isStatementStart() && this.upper() !== 'SELECT') ||
        this.atEnd(),
    );

    if (this.upper() === 'BEGIN') {
      // Block body
      this.newLine(stmtIndent);
      this.formatBeginEndBlock();
    } else if (this.upper() === 'BEGIN TRY') {
      // TRY/CATCH body
      this.newLine(stmtIndent);
      this.formatBeginTryCatch();
    } else {
      // Single statement body, indented
      // Trailing space before continuation
      this.emit(' ');
      this.indent = stmtIndent + INDENT_SIZE;
      this.newLine();
      this.formatStatement();
      this.indent = stmtIndent;
    }

    // ELSE
    if (this.upper() === 'ELSE') {
      // Trailing space on END line before ELSE
      this.emit(' ');
      this.newLine(stmtIndent);
      this.emitToken(this.advance()); // ELSE

      if (this.upper() === 'IF') {
        // ELSE IF chain
        this.emit(' ');
        this.formatIf();
      } else if (this.upper() === 'BEGIN') {
        // Trailing space on ELSE line before BEGIN
        this.emit(' ');
        this.newLine(stmtIndent);
        this.formatBeginEndBlock();
      } else if (this.upper() === 'BEGIN TRY') {
        this.emit(' ');
        this.newLine(stmtIndent);
        this.formatBeginTryCatch();
      } else {
        this.indent = stmtIndent + INDENT_SIZE;
        this.newLine();
        this.formatStatement();
        this.indent = stmtIndent;
      }
    }
  }

  // --- BEGIN...END block (plain) ---
  private formatBegin(): void {
    // With merged tokens, BEGIN TRY/CATCH/TRAN are handled by separate cases.
    // This handles only plain BEGIN...END blocks.
    this.formatBeginEndBlock();
  }

  private formatBeginEndBlock(): void {
    const blockIndent = this.indent;
    this.emitToken(this.advance()); // BEGIN

    // Content
    this.indent = blockIndent + INDENT_SIZE;
    this.formatStatementList(true);
    this.indent = blockIndent;

    // END
    if (this.upper() === 'END') {
      this.newLine(blockIndent);
      this.emitToken(this.advance()); // END
    }
  }

  // --- BEGIN TRY...END TRY / BEGIN CATCH...END CATCH ---
  private formatBeginTryCatch(): void {
    const blockIndent = this.indent;

    // BEGIN TRY or BEGIN CATCH (single merged token)
    this.emitToken(this.advance());

    // Block content
    this.indent = blockIndent + INDENT_SIZE;
    this.formatStatementList(true);
    this.indent = blockIndent;

    // END TRY or END CATCH (single merged token)
    if (this.upper() === 'END TRY' || this.upper() === 'END CATCH') {
      this.newLine(blockIndent);
      this.emitToken(this.advance());
    } else if (this.upper() === 'END') {
      this.newLine(blockIndent);
      this.emitToken(this.advance());
    }

    // BEGIN CATCH (immediately follows END TRY, no blank lines)
    if (this.upper() === 'BEGIN CATCH') {
      this.newLine(blockIndent);
      this.formatBeginTryCatch();
    }
  }

  // --- BEGIN TRAN/TRANSACTION ---
  private formatBeginTran(): void {
    this.emitToken(this.advance()); // BEGIN TRAN or BEGIN TRANSACTION (merged)
  }

  // --- Transaction commands ---
  private formatTransactionCmd(): void {
    this.emitToken(this.advance()); // COMMIT or ROLLBACK
    if (this.upper() === 'TRAN' || this.upper() === 'TRANSACTION') {
      this.emit(' ');
      this.emitToken(this.advance()); // TRAN/TRANSACTION
    }
  }

  // --- Simple commands (THROW, RAISERROR, RETURN, etc.) ---
  private formatSimpleCmd(): void {
    this.emitToken(this.advance());
    // Consume any remaining tokens on this statement
    if (!this.atEnd() && !this.isStatementStart() && this.peek()?.type !== 'semicolon') {
      this.emit(' ');
      this.writeInlineUntil(() => this.isStatementStart());
    }
  }

  // --- EXEC/EXECUTE ---
  private formatExec(): void {
    this.emitToken(this.advance()); // EXEC or EXECUTE
    this.emit(' ');
    this.writeInlineUntil(() => this.isStatementStart());
  }

  // --- WHILE ---
  private formatWhile(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // WHILE
    this.emit(' ');

    // Condition
    this.writeInlineUntil(
      () =>
        this.upper() === 'BEGIN' ||
        (this.isStatementStart() && this.upper() !== 'SELECT') ||
        this.atEnd(),
    );

    if (this.upper() === 'BEGIN') {
      this.newLine(stmtIndent);
      this.formatBeginEndBlock();
    } else {
      // Single statement body, indented
      this.emit(' ');
      this.indent = stmtIndent + INDENT_SIZE;
      this.newLine();
      this.formatStatement();
      this.indent = stmtIndent;
    }
  }

  // --- SET (standalone statement, e.g., SET NOCOUNT ON) ---
  private formatSetStatement(): void {
    this.emitToken(this.advance()); // SET
    this.emit(' ');
    this.writeInlineUntil(() => this.isStatementStart());
  }

  // --- PRINT ---
  private formatPrint(): void {
    this.emitToken(this.advance()); // PRINT
    this.emit(' ');
    this.writeInlineUntil(() => this.isStatementStart());
  }

  // --- USE statement ---
  private formatUse(): void {
    this.emitToken(this.advance()); // USE
    // Write the database name / identifier following USE
    if (!this.atEnd() && !this.isStatementStart()) {
      this.emit(' ');
      this.writeInlineUntil(() => this.isStatementStart());
    }
    // Optional trailing semicolon
    if (this.peek()?.type === 'semicolon') {
      this.emit(this.advance().value);
    }
  }

  // --- GO batch separator ---
  private formatGo(): void {
    this.emitToken(this.advance()); // GO
    // Optional repeat count (GO 2)
    if (this.peek()?.type === 'number') {
      this.emit(' ');
      this.emitToken(this.advance());
    }
    // Optional semicolon after GO
    if (this.peek()?.type === 'semicolon') {
      this.emit(this.advance().value);
    }
    // Inline comment on the GO line
    if (this.peek()?.type === 'comment') {
      this.emit(' ');
      const c = this.advance();
      this.emitCommentText(c.value);
    }
  }

  // --- Generic line ---
  private formatGenericLine(): void {
    // Statements dispatched here (TRUNCATE, ALTER, OPEN, CLOSE, FETCH,
    // DEALLOCATE, BACKUP, RESTORE, DBCC, non-TABLE CREATE) are themselves
    // recognized by isStatementStart(). The leading keyword must always be
    // consumed unconditionally before that same check is used as a stop
    // condition, otherwise it stops on its own first token and the
    // statement-list loop spins forever without making progress.
    if (this.atEnd()) return;
    this.emitToken(this.advance());
    if (!this.atEnd() && !this.isStatementStart()) {
      this.emit(' ');
      this.writeInlineUntil(() => this.isStatementStart());
    }
  }

  // --- Table reference (name, possibly schema.name or db.schema.name, or table-valued function) ---
  private writeTableRef(consumeParens: boolean = false): void {
    // Handle derived table (subquery) as table source: (SELECT ...) [AS] alias
    if (this.isSubqueryStart()) {
      this.writeSubquery();
      // Optional alias after closing )
      if (this.peek()?.type === 'word' && !this.isClauseKeyword() && !this.isStatementStart()) {
        const u = this.upper();
        if (u === 'AS') {
          this.emit(' ');
          this.emitToken(this.advance()); // AS
          this.emit(' ');
          if (this.peek()?.type === 'word') {
            this.emitToken(this.advance()); // alias
          }
        } else if (!isKeywordLike(this.peek()!)) {
          this.emit(' ');
          this.emitToken(this.advance()); // alias
        }
      }
      return;
    }

    if (this.atEnd() || this.peek()?.type !== 'word') return;
    this.emitToken(this.advance()); // table name or first part

    while (this.peek()?.type === 'dot') {
      this.emit(this.advance().value); // .
      if (this.peek()?.type === 'word') {
        this.emitToken(this.advance()); // next part
      }
    }

    // Parenthesized arguments (for table-valued functions in APPLY contexts)
    if (consumeParens && this.peek()?.type === 'oparen') {
      this.writeInlineParens();
    }

    // Optional alias. Must be checked before the WITH (hint) below: the real
    // syntax is "table_name [AS] table_alias [WITH (table_hint [,...])]", so
    // the hint follows the alias, not the other way around.
    if (this.peek()?.type === 'word' && !this.isClauseKeyword() && !this.isStatementStart()) {
      const u = this.upper();
      if (u === 'AS') {
        this.emit(' ');
        this.emitToken(this.advance()); // AS
        this.emit(' ');
        if (this.peek()?.type === 'word') {
          this.emitToken(this.advance()); // alias
        }
      } else if (!isKeywordLike(this.peek()!)) {
        this.emit(' ');
        this.emitToken(this.advance()); // alias
      }
    }

    // Optional table hint WITH (NOLOCK), e.g. "dbo.Foo AS f WITH (NOLOCK)"
    if (this.upper() === 'WITH' && this.isType(1, 'oparen')) {
      this.emit(' ');
      this.emitToken(this.advance()); // WITH
      this.emit(' ');
      this.writeInlineParens();
    }
  }

  // --- Inline expression writing ---
  private writeInlineUntil(stop: () => boolean): void {
    let prevToken: Token | null = null;

    while (!this.atEnd() && !stop()) {
      const token = this.peek()!;

      // Handle comment tokens inline.
      // • Single-line (--) comments terminate the current logical line; break out
      //   so the caller's next newLine() call correctly flushes the comment line
      //   and subsequent tokens get their own properly-indented output line.
      // • Block comments (/* */) without newlines are emitted in-place.
      // • Multi-line block comments are split across output lines by emitCommentText;
      //   we then break so the caller can re-establish indentation.
      if (token.type === 'comment') {
        if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
        this.advance();
        this.emitCommentText(token.value);
        if (token.value.startsWith('--') || token.value.includes('\n')) {
          // Comment terminated the logical line; let the caller start a fresh one.
          break;
        }
        prevToken = token;
        continue;
      }

      // Handle parenthesized expressions inline
      if (token.type === 'oparen') {
        if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
        if (this.isSubqueryStart()) {
          this.writeSubquery();
        } else {
          this.writeInlineParens();
        }
        prevToken = makeToken('cparen', ')');
        continue;
      }

      // Handle CASE...END as a single inline unit (prevents END from
      // being mistaken for a block-level END by stop conditions)
      if (token.type === 'word' && token.value.toUpperCase() === 'CASE') {
        if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
        this.writeInlineCase();
        prevToken = makeToken('word', 'END');
        continue;
      }

      this.advance();
      if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
      this.emitToken(token);
      prevToken = token;
    }
  }

  // Write a CASE...END expression entirely inline
  private writeInlineCase(): void {
    this.emitToken(this.advance()); // CASE
    let depth = 1;
    let prevToken: Token = makeToken('word', 'CASE');

    while (!this.atEnd() && depth > 0) {
      const token = this.peek()!;

      if (token.type === 'word') {
        const upper = token.value.toUpperCase();
        if (upper === 'CASE') depth++;
        if (upper === 'END' && --depth === 0) {
          this.advance();
          if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
          this.emitToken(token);
          break;
        }
      }

      // Handle parenthesized sub-expressions
      if (token.type === 'oparen') {
        if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
        if (this.isSubqueryStart()) {
          this.writeSubquery();
        } else {
          this.writeInlineParens();
        }
        prevToken = makeToken('cparen', ')');
        continue;
      }

      // Handle comment tokens (same rules as writeInlineUntil)
      if (token.type === 'comment') {
        if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
        this.advance();
        this.emitCommentText(token.value);
        if (token.value.startsWith('--') || token.value.includes('\n')) {
          break;
        }
        prevToken = token;
        continue;
      }

      this.advance();
      if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
      this.emitToken(token);
      prevToken = token;
    }
  }

  // Format a subquery (SELECT inside parens) with proper indentation.
  // The opening ( is on the current line; content is indented; ) is on its own line.
  private writeSubquery(): void {
    // baseIndent = number of leading spaces on the current line, so ) aligns with
    // the line that contains (, regardless of this.indent (which tracks newLine() default).
    const baseIndent = this.currentLine.length - this.currentLine.trimStart().length;
    this.emit('(');
    this.advance(); // consume (
    const subIndent = baseIndent + INDENT_SIZE;
    this.newLine(subIndent);
    const savedIndent = this.indent;
    this.indent = subIndent;
    // Emit any comment tokens that appear before SELECT
    while (this.peek()?.type === 'comment') {
      const cmt = this.advance();
      this.emitCommentText(cmt.value);
      this.newLine(subIndent);
    }
    if (this.upper() === 'SELECT') {
      this.formatSelectQuery(subIndent);
    }
    this.indent = savedIndent;
    this.newLine(baseIndent);
    if (this.peek()?.type === 'cparen') {
      this.advance(); // consume )
    }
    this.emit(')');
  }

  private writeInlineParens(): void {
    this.emit('(');
    this.advance(); // consume (

    let depth = 1;
    let prevToken: Token | null = makeToken('oparen', '(');

    while (!this.atEnd() && depth > 0) {
      const token = this.peek()!;

      // Detect a SELECT-subquery nested inside parens and format it with proper indentation
      if (token.type === 'oparen' && this.isSubqueryStart()) {
        if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
        this.writeSubquery(); // writeSubquery emits its own ( and )
        prevToken = makeToken('cparen', ')');
        continue;
      }

      if (token.type === 'oparen') depth++;
      if (token.type === 'cparen') {
        depth--;
        if (depth === 0) {
          this.advance();
          this.emit(')');
          break;
        }
      }

      this.advance();
      if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
      this.emitToken(token);
      prevToken = token;
    }
  }
}

// --- VSCode provider ---
export class TsqlFormattingProvider
  implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider
{
  provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
    const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
    return this.provideFormattingEdits(document, fullRange);
  }

  provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.TextEdit[] {
    if (range.isEmpty) {
      return [];
    }

    return this.provideFormattingEdits(document, range);
  }

  private provideFormattingEdits(document: vscode.TextDocument, range: vscode.Range): vscode.TextEdit[] {
    const config = vscode.workspace.getConfiguration('tsqlFormatter');
    const options: FormatterOptions = {
      breakOnKeywords: config.get<boolean>('breakOnKeywords', true),
      identifierCase: config.get<CaseOption>('identifierCase', 'preserve'),
      keywordCase: config.get<KeywordCaseOption>('keywordCase', 'preserve'),
      linesBetweenQueries: Math.max(0, config.get<number>('linesBetweenQueries', 2)),
      maxLineLength: Math.max(20, config.get<number>('maxLineLength', 100)),
      useBrackets: config.get<boolean>('useBrackets', false),
      useMaxLineLength: config.get<boolean>('useMaxLineLength', true),
    };

    const source = document.getText(range);

    try {
      const formatted = formatTsql(source, options);

      if (formatted === source) {
        return [];
      }

      return [vscode.TextEdit.replace(range, formatted)];
    } catch (err) {
      // Ensure we have an Error-like object
      const error = err instanceof Error ? err : new Error(String(err));
      getOutputChannel().appendLine(`[tsql-formatter] Formatting failed: ${error.message}`);
      getOutputChannel().appendLine(error.stack ?? 'no stack');
      getOutputChannel().show(true);
      void vscode.window.showErrorMessage(
        'tsql-formatter: failed to format document. See "TSQL Formatter" output for details.',
      );
      // Fall back to no edits so VS Code leaves the document unchanged
      return [];
    }
  }
}

let _outputChannel: vscode.OutputChannel | null = null;
export function getOutputChannel(): vscode.OutputChannel {
  if (!_outputChannel) _outputChannel = vscode.window.createOutputChannel('TSQL Formatter');
  return _outputChannel;
}

function formatTsql(input: string, options: FormatterOptions): string {
  const normalized = input.replace(/\r\n?/g, '\n').trim();
  if (!normalized) {
    return input;
  }

  const rawTokens = tokenize(normalized);
  const tokens = mergeMultiWordKeywords(rawTokens);
  const formatter = new SqlFormatter(tokens, options);
  return formatter.format();
}
