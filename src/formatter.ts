import * as vscode from "vscode";

type CaseOption = "upper" | "lower" | "preserve" | "matchTable";
type KeywordCaseOption = "upper" | "lower" | "preserve";

interface FormatterOptions {
  linesBetweenQueries: number;
  breakOnKeywords: boolean;
  keywordCase: KeywordCaseOption;
  elementCase: CaseOption;
}

// --- Token definition ---
interface Token {
  type:
    | "word"
    | "string"
    | "number"
    | "operator"
    | "comma"
    | "oparen"
    | "cparen"
    | "dot"
    | "semicolon"
    | "star"
    | "comment";
  value: string;
}

// --- Keyword and function sets ---
const KEYWORDS = new Set([
  // DML
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "MERGE",
  "FROM",
  "WHERE",
  "SET",
  "VALUES",
  "INTO",
  // Joins
  "JOIN",
  "INNER",
  "LEFT",
  "RIGHT",
  "FULL",
  "OUTER",
  "CROSS",
  "ON",
  "APPLY",
  // Clauses
  "GROUP",
  "BY",
  "ORDER",
  "HAVING",
  "TOP",
  "DISTINCT",
  "UNION",
  "ALL",
  "EXCEPT",
  "INTERSECT",
  // Expressions
  "AS",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "NULL",
  "LIKE",
  "BETWEEN",
  "EXISTS",
  "ASC",
  "DESC",
  // Window functions
  "OVER",
  "PARTITION",
  "ROWS",
  "RANGE",
  "UNBOUNDED",
  "PRECEDING",
  "FOLLOWING",
  "CURRENT",
  "ROW",
  // DDL
  "CREATE",
  "ALTER",
  "DROP",
  "TABLE",
  "VIEW",
  "INDEX",
  "PROCEDURE",
  "FUNCTION",
  "TRIGGER",
  "SCHEMA",
  "DATABASE",
  "PRIMARY",
  "KEY",
  "IDENTITY",
  "UNIQUE",
  "CLUSTERED",
  "NONCLUSTERED",
  "CONSTRAINT",
  "DEFAULT",
  "CHECK",
  "FOREIGN",
  "REFERENCES",
  "CASCADE",
  "ADD",
  "COLUMN",
  // Data types
  "INT",
  "BIGINT",
  "SMALLINT",
  "TINYINT",
  "BIT",
  "DECIMAL",
  "NUMERIC",
  "FLOAT",
  "REAL",
  "MONEY",
  "SMALLMONEY",
  "CHAR",
  "VARCHAR",
  "NCHAR",
  "NVARCHAR",
  "TEXT",
  "NTEXT",
  "DATE",
  "DATETIME",
  "DATETIME2",
  "SMALLDATETIME",
  "TIME",
  "DATETIMEOFFSET",
  "BINARY",
  "VARBINARY",
  "IMAGE",
  "UNIQUEIDENTIFIER",
  "XML",
  "SQL_VARIANT",
  "TIMESTAMP",
  "ROWVERSION",
  "MAX",
  // Control flow
  "IF",
  "BEGIN",
  "END",
  "WHILE",
  "BREAK",
  "CONTINUE",
  "RETURN",
  "GOTO",
  "WAITFOR",
  "TRY",
  "CATCH",
  "THROW",
  // Transaction
  "COMMIT",
  "ROLLBACK",
  "TRAN",
  "TRANSACTION",
  "SAVE",
  // Other
  "DECLARE",
  "PRINT",
  "EXEC",
  "EXECUTE",
  "WITH",
  "NOLOCK",
  "HOLDLOCK",
  "UPDLOCK",
  "ROWLOCK",
  "TABLOCK",
  "GO",
  "USE",
  "GRANT",
  "REVOKE",
  "DENY",
  "TRUNCATE",
  "OUTPUT",
  "INSERTED",
  "DELETED",
  "SOME",
  "ANY",
  "PIVOT",
  "UNPIVOT",
  "TABLESAMPLE",
  "OPENXML",
  "OPENQUERY",
  "OPENROWSET",
  "OPENDATASOURCE",
]);

const FUNCTIONS = new Set([
  // Aggregate
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "COUNT_BIG",
  "GROUPING",
  "GROUPING_ID",
  "CHECKSUM_AGG",
  "STDEV",
  "STDEVP",
  "VAR",
  "VARP",
  // Ranking/Window
  "ROW_NUMBER",
  "RANK",
  "DENSE_RANK",
  "NTILE",
  "LAG",
  "LEAD",
  "FIRST_VALUE",
  "LAST_VALUE",
  // String
  "LEN",
  "DATALENGTH",
  "SUBSTRING",
  "CHARINDEX",
  "PATINDEX",
  "REPLACE",
  "STUFF",
  "REPLICATE",
  "REVERSE",
  "SPACE",
  "LTRIM",
  "RTRIM",
  "TRIM",
  "UPPER",
  "LOWER",
  "CONCAT",
  "CONCAT_WS",
  "STRING_AGG",
  "STRING_SPLIT",
  "FORMAT",
  "ASCII",
  "UNICODE",
  "QUOTENAME",
  // Date
  "GETDATE",
  "GETUTCDATE",
  "SYSDATETIME",
  "SYSUTCDATETIME",
  "SYSDATETIMEOFFSET",
  "DATEADD",
  "DATEDIFF",
  "DATEDIFF_BIG",
  "DATENAME",
  "DATEPART",
  "DATETRUNC",
  "YEAR",
  "MONTH",
  "DAY",
  "EOMONTH",
  "ISDATE",
  "SWITCHOFFSET",
  "TODATETIMEOFFSET",
  // Conversion
  "CAST",
  "CONVERT",
  "TRY_CAST",
  "TRY_CONVERT",
  "PARSE",
  "TRY_PARSE",
  // Math
  "ABS",
  "CEILING",
  "FLOOR",
  "ROUND",
  "POWER",
  "SQRT",
  "SIGN",
  "LOG",
  "LOG10",
  "EXP",
  "PI",
  "RAND",
  "SQUARE",
  "SIN",
  "COS",
  "TAN",
  "ASIN",
  "ACOS",
  "ATAN",
  "ATN2",
  // Logical
  "IIF",
  "CHOOSE",
  "COALESCE",
  "NULLIF",
  // System
  "NEWID",
  "NEWSEQUENTIALID",
  "SCOPE_IDENTITY",
  "IDENT_CURRENT",
  "OBJECT_ID",
  "OBJECT_NAME",
  "DB_ID",
  "DB_NAME",
  "SCHEMA_ID",
  "SCHEMA_NAME",
  "TYPE_ID",
  "TYPE_NAME",
  "COL_NAME",
  "COL_LENGTH",
  "COLUMNPROPERTY",
  "OBJECTPROPERTY",
  "DATABASEPROPERTYEX",
  "SERVERPROPERTY",
  "ERROR_NUMBER",
  "ERROR_MESSAGE",
  "ERROR_SEVERITY",
  "ERROR_STATE",
  "ERROR_PROCEDURE",
  "ERROR_LINE",
  "APP_NAME",
  "HOST_NAME",
  "SUSER_NAME",
  "SUSER_SNAME",
  "SUSER_ID",
  "SUSER_SID",
  "USER_NAME",
  "USER_ID",
  // JSON
  "JSON_VALUE",
  "JSON_QUERY",
  "JSON_MODIFY",
  "ISJSON",
  "JSON_OBJECT",
  "JSON_ARRAY",
  "OPENJSON",
  // Other
  "ISNULL",
  "ISNUMERIC",
  "HASHBYTES",
  "CHECKSUM",
  "BINARY_CHECKSUM",
  "COMPRESS",
  "DECOMPRESS",
]);

// Data types that take a size/precision parameter in parentheses
const TYPES_WITH_PARAMS = new Set([
  "VARCHAR",
  "NVARCHAR",
  "CHAR",
  "NCHAR",
  "DECIMAL",
  "NUMERIC",
  "FLOAT",
  "VARBINARY",
  "BINARY",
  "DATETIME2",
  "DATETIMEOFFSET",
  "TIME",
]);

// --- Tokenizer ---
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }

    // String literal
    if (input[i] === "'") {
      let end = i + 1;
      while (end < input.length) {
        if (input[end] === "'" && input[end + 1] === "'") {
          end += 2;
        } else if (input[end] === "'") {
          end++;
          break;
        } else {
          end++;
        }
      }
      tokens.push({ type: "string", value: input.slice(i, end) });
      i = end;
      continue;
    }

    // Single-line comment
    if (input[i] === "-" && input[i + 1] === "-") {
      let end = i + 2;
      while (end < input.length && input[end] !== "\n") end++;
      tokens.push({
        type: "comment",
        value: input.slice(i, end).trim(),
      });
      i = end;
      continue;
    }

    // Block comment
    if (input[i] === "/" && input[i + 1] === "*") {
      let end = i + 2;
      while (
        end < input.length &&
        !(input[end] === "*" && input[end + 1] === "/")
      )
        end++;
      end += 2;
      tokens.push({ type: "comment", value: input.slice(i, end) });
      i = end;
      continue;
    }

    // Word (identifier, keyword, variable, system variable)
    if (/[A-Za-z_@#]/.test(input[i])) {
      let end = i;
      if (input[i] === "@" && input[i + 1] === "@") end = i + 2;
      else if (input[i] === "@" || input[i] === "#") end = i + 1;

      while (end < input.length && /[A-Za-z0-9_]/.test(input[end])) end++;
      tokens.push({ type: "word", value: input.slice(i, end) });
      i = end;
      continue;
    }

    // Number
    if (/[0-9]/.test(input[i])) {
      let end = i;
      while (end < input.length && /[0-9.]/.test(input[end])) end++;
      tokens.push({ type: "number", value: input.slice(i, end) });
      i = end;
      continue;
    }

    // Punctuation and operators
    if (input[i] === "(") {
      tokens.push({ type: "oparen", value: "(" });
      i++;
      continue;
    }
    if (input[i] === ")") {
      tokens.push({ type: "cparen", value: ")" });
      i++;
      continue;
    }
    if (input[i] === ",") {
      tokens.push({ type: "comma", value: "," });
      i++;
      continue;
    }
    if (input[i] === ".") {
      tokens.push({ type: "dot", value: "." });
      i++;
      continue;
    }
    if (input[i] === ";") {
      tokens.push({ type: "semicolon", value: ";" });
      i++;
      continue;
    }
    if (input[i] === "*") {
      tokens.push({ type: "star", value: "*" });
      i++;
      continue;
    }

    // Multi-char operators
    if (input[i] === "<" && input[i + 1] === ">") {
      tokens.push({ type: "operator", value: "<>" });
      i += 2;
      continue;
    }
    if (input[i] === "!" && input[i + 1] === "=") {
      tokens.push({ type: "operator", value: "!=" });
      i += 2;
      continue;
    }
    if (input[i] === ">" && input[i + 1] === "=") {
      tokens.push({ type: "operator", value: ">=" });
      i += 2;
      continue;
    }
    if (input[i] === "<" && input[i + 1] === "=") {
      tokens.push({ type: "operator", value: "<=" });
      i += 2;
      continue;
    }

    // Single char operators
    if ("=<>+-/%".includes(input[i])) {
      tokens.push({ type: "operator", value: input[i] });
      i++;
      continue;
    }

    // Anything else (e.g. brackets)
    tokens.push({ type: "operator", value: input[i] });
    i++;
  }

  return tokens;
}

// --- Casing helpers ---
function applyCase(value: string, option: string): string {
  if (option === "upper") return value.toUpperCase();
  if (option === "lower") return value.toLowerCase();
  return value;
}

function detectCase(value: string): "upper" | "lower" | "preserve" {
  if (value === value.toUpperCase() && value !== value.toLowerCase())
    return "upper";
  if (value === value.toLowerCase() && value !== value.toUpperCase())
    return "lower";
  return "preserve";
}

function isKeywordLike(word: string): boolean {
  const upper = word.toUpperCase();
  return KEYWORDS.has(upper) || FUNCTIONS.has(upper) || word.startsWith("@@");
}

// --- Formatter class ---
const INDENT_SIZE = 4;

class SqlFormatter {
  private tokens: Token[];
  private pos: number = 0;
  private lines: string[] = [];
  private currentLine: string = "";
  private indent: number = 0;
  private options: FormatterOptions;
  private lastTableCase: "upper" | "lower" | "preserve" = "preserve";
  private prevTableKeyword: string | null = null;

  constructor(tokens: Token[], options: FormatterOptions) {
    this.tokens = tokens;
    this.options = options;
  }

  format(): string {
    this.formatStatementList(false);
    this.finishLine();
    return this.lines.join("\n").trim() + "\n";
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
    return t?.type === "word" ? t.value.toUpperCase() : "";
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
    this.lines.push(line.trim() === "" ? "" : line);
    this.currentLine = "";
  }

  private newLine(indentSpaces?: number): void {
    this.finishLine();
    this.currentLine = " ".repeat(indentSpaces ?? this.indent);
  }

  private blankLines(count: number): void {
    this.finishLine();
    for (let i = 0; i < count; i++) this.lines.push("");
  }

  private lineAt(col: number): void {
    this.finishLine();
    this.currentLine = " ".repeat(col);
  }

  // --- Casing ---
  private caseWord(token: Token): string {
    if (token.type !== "word") return token.value;
    const upper = token.value.toUpperCase();
    if (isKeywordLike(token.value)) {
      return applyCase(token.value, this.options.keywordCase);
    }
    return this.applyElementCasing(token);
  }

  private applyElementCasing(token: Token): string {
    const opt = this.options.elementCase;
    if (opt === "preserve") return token.value;
    if (opt === "upper" || opt === "lower") return applyCase(token.value, opt);
    return token.value;
  }

  private emitToken(token: Token): void {
    if (token.type === "word") {
      const upper = token.value.toUpperCase();
      // Track table case for matchTable mode
      if (
        this.prevTableKeyword &&
        !isKeywordLike(token.value) &&
        !token.value.startsWith("@")
      ) {
        this.lastTableCase = detectCase(token.value);
        this.prevTableKeyword = null;
      }
      if (
        ["FROM", "JOIN", "UPDATE", "INTO"].includes(upper) ||
        (upper === "DELETE" && this.upper(1) === "FROM")
      ) {
        this.prevTableKeyword = upper;
      }

      // Apply matchTable casing for dotted references
      if (this.options.elementCase === "matchTable") {
        const prevTok = this.tokens[this.pos - 2];
        if (
          prevTok?.type === "dot" &&
          !isKeywordLike(token.value) &&
          !token.value.startsWith("@")
        ) {
          this.emit(applyCase(token.value, this.lastTableCase));
          return;
        }
      }
    }
    this.emit(this.caseWord(token));
  }

  // --- Spacing logic ---
  private needsSpaceBefore(token: Token, prev: Token | null): boolean {
    if (!prev) return false;
    if (prev.type === "oparen") return false;
    if (token.type === "cparen") return false;
    if (token.type === "comma") return false;
    if (prev.type === "dot" || token.type === "dot") return false;
    if (token.type === "semicolon") return false;

    // No space between function/type name and (
    if (token.type === "oparen" && prev.type === "word") {
      const upper = prev.value.toUpperCase();
      if (
        FUNCTIONS.has(upper) ||
        TYPES_WITH_PARAMS.has(upper) ||
        upper === "OVER"
      )
        return false;
    }

    return true;
  }

  // --- Statement boundary detection ---
  private isStatementStart(): boolean {
    const u = this.upper();
    const u1 = this.upper(1);

    if (
      [
        "DECLARE",
        "INSERT",
        "UPDATE",
        "DELETE",
        "SELECT",
        "MERGE",
        "WITH",
        "IF",
        "WHILE",
        "RETURN",
        "COMMIT",
        "ROLLBACK",
        "THROW",
        "PRINT",
        "EXEC",
        "EXECUTE",
        "TRUNCATE",
        "USE",
        "GO",
        "GRANT",
        "REVOKE",
        "DENY",
        "ALTER",
      ].includes(u)
    )
      return true;
    if (
      u === "CREATE" &&
      [
        "TABLE",
        "VIEW",
        "PROCEDURE",
        "FUNCTION",
        "INDEX",
        "SCHEMA",
        "DATABASE",
        "TRIGGER",
      ].includes(u1)
    )
      return true;
    if (
      u === "DROP" &&
      [
        "TABLE",
        "VIEW",
        "PROCEDURE",
        "FUNCTION",
        "INDEX",
        "SCHEMA",
        "DATABASE",
        "TRIGGER",
      ].includes(u1)
    )
      return true;
    if (u === "BEGIN") return true;
    if (u === "END") return true;
    return false;
  }

  // Is current position a clause keyword within a DML statement?
  private isClauseKeyword(): boolean {
    const u = this.upper();
    if (["FROM", "WHERE", "SET", "VALUES", "HAVING"].includes(u)) return true;
    if (u === "GROUP" && this.upper(1) === "BY") return true;
    if (u === "ORDER" && this.upper(1) === "BY") return true;
    if (this.isJoinStart()) return true;
    if (u === "ON") return true;
    if (u === "UNION") return true;
    return false;
  }

  private isJoinStart(): boolean {
    const u = this.upper();
    const u1 = this.upper(1);
    if (u === "JOIN") return true;
    if (
      u === "INNER" &&
      (u1 === "JOIN" || (u1 === "LOOP" && this.upper(2) === "JOIN"))
    )
      return true;
    if (
      (u === "LEFT" || u === "RIGHT" || u === "FULL") &&
      (u1 === "JOIN" || u1 === "OUTER")
    )
      return true;
    if (u === "CROSS" && (u1 === "JOIN" || u1 === "APPLY")) return true;
    if (u === "OUTER" && u1 === "APPLY") return true;
    return false;
  }

  private isAndOr(): boolean {
    const u = this.upper();
    return u === "AND" || u === "OR";
  }

  // --- Statement list formatter ---
  private formatStatementList(insideBlock: boolean): void {
    let first = true;
    while (!this.atEnd()) {
      // Check for block end
      if (insideBlock) {
        const u = this.upper();
        if (u === "END" || u === "ELSE") break;
      }

      // Skip semicolons between statements
      while (this.peek()?.type === "semicolon") this.advance();
      if (this.atEnd()) break;
      if (insideBlock && (this.upper() === "END" || this.upper() === "ELSE"))
        break;

      if (first) {
        // Flush any content the caller left on the current line
        // (e.g., "BEGIN TRY" from formatBeginTryCatch)
        this.finishLine();
      } else {
        this.blankLines(this.options.linesBetweenQueries);
      }
      this.currentLine = " ".repeat(this.indent);

      this.formatStatement();
      first = false;
    }
  }

  // --- Statement dispatcher ---
  private formatStatement(): void {
    const u = this.upper();
    switch (u) {
      case "DECLARE":
        return this.formatDeclare();
      case "CREATE":
        return this.formatCreate();
      case "DROP":
        return this.formatDrop();
      case "INSERT":
        return this.formatInsert();
      case "UPDATE":
        return this.formatUpdate();
      case "DELETE":
        return this.formatDelete();
      case "SELECT":
        return this.formatSelectStatement();
      case "WITH":
        return this.formatWith();
      case "IF":
        return this.formatIf();
      case "BEGIN":
        return this.formatBegin();
      case "COMMIT":
      case "ROLLBACK":
        return this.formatTransactionCmd();
      case "THROW":
        return this.formatSimpleCmd();
      case "PRINT":
        return this.formatPrint();
      default:
        return this.formatGenericLine();
    }
  }

  // --- DECLARE ---
  private formatDeclare(): void {
    this.emitToken(this.advance()); // DECLARE
    this.emit(" ");
    this.writeInlineUntil(() => this.isStatementStart());
  }

  // --- CREATE TABLE ---
  private formatCreate(): void {
    const u1 = this.upper(1);
    if (u1 === "TABLE") {
      this.formatCreateTable();
    } else {
      this.formatGenericLine();
    }
  }

  private formatCreateTable(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // CREATE
    this.emit(" ");
    this.emitToken(this.advance()); // TABLE
    this.emit(" ");

    // Table name (possibly schema.table)
    this.writeTableRef();

    // Expect (
    if (this.peek()?.type !== "oparen") return;

    this.emit(" ");
    this.emit(this.advance().value); // (

    // Column definitions - one per line
    const colIndent = stmtIndent + INDENT_SIZE;
    while (!this.atEnd() && this.peek()?.type !== "cparen") {
      this.newLine(colIndent);
      this.writeInlineUntil(
        () => this.peek()?.type === "comma" || this.peek()?.type === "cparen",
      );
      if (this.peek()?.type === "comma") {
        this.emit(this.advance().value); // ,
      }
    }

    // Closing )
    this.newLine(stmtIndent);
    if (this.peek()?.type === "cparen") {
      this.emit(this.advance().value); // )
    }
  }

  // --- DROP ---
  private formatDrop(): void {
    this.emitToken(this.advance()); // DROP
    this.emit(" ");
    this.emitToken(this.advance()); // TABLE/VIEW/etc
    this.emit(" ");
    this.writeInlineUntil(() => this.isStatementStart());
  }

  // --- INSERT ---
  private formatInsert(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // INSERT
    this.emit(" ");

    // INTO (optional)
    if (this.upper() === "INTO") {
      this.emitToken(this.advance());
      this.emit(" ");
    }

    // Table name and optional column list
    this.writeInlineUntil(
      () =>
        this.isWordAt(0, "VALUES", "SELECT", "EXEC", "EXECUTE") ||
        this.isStatementStart(),
    );

    if (this.upper() === "VALUES") {
      this.newLine(stmtIndent);
      this.emitToken(this.advance()); // VALUES
      this.emit(" ");
      this.writeInlineUntil(() => this.isStatementStart());
    } else if (this.upper() === "SELECT") {
      this.newLine(stmtIndent);
      this.formatSelectQuery(stmtIndent);
    }
  }

  // --- UPDATE ---
  private formatUpdate(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // UPDATE
    this.emit(" ");
    this.writeTableRef();

    // SET clause
    if (this.upper() === "SET") {
      this.newLine(stmtIndent);
      this.emitToken(this.advance()); // SET
      this.emit(" ");
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
      if (token.type === "word" && token.value.toUpperCase() === "CASE") {
        if (this.needsSpaceBefore(token, prevToken)) this.emit(" ");
        this.formatCaseExpression(stmtIndent);
        prevToken = null;
        continue;
      }

      if (token.type === "oparen") {
        if (this.needsSpaceBefore(token, prevToken)) this.emit(" ");
        this.writeInlineParens();
        prevToken = { type: "cparen", value: ")" };
        continue;
      }

      this.advance();
      if (this.needsSpaceBefore(token, prevToken)) this.emit(" ");
      this.emitToken(token);
      prevToken = token;
    }
  }

  // --- DELETE ---
  private formatDelete(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // DELETE

    // Optional FROM
    if (this.upper() === "FROM") {
      this.emit(" ");
      this.emitToken(this.advance()); // FROM
    }

    this.emit(" ");
    this.writeTableRef();

    // Trailing space if WHERE follows
    if (this.upper() === "WHERE") this.emit(" ");

    this.formatOptionalClauses(stmtIndent);
  }

  // --- SELECT (standalone) ---
  private formatSelectStatement(): void {
    this.formatSelectQuery(this.indent);
  }

  private formatSelectQuery(stmtIndent: number): void {
    this.emitToken(this.advance()); // SELECT

    // DISTINCT / TOP N - keep on SELECT line
    if (this.upper() === "DISTINCT") {
      this.emit(" ");
      this.emitToken(this.advance());
    }
    if (this.upper() === "TOP") {
      this.emit(" ");
      this.emitToken(this.advance()); // TOP
      this.emit(" ");
      // Number or expression
      if (this.peek()?.type === "oparen") {
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
      if (this.upper() === "END") break;
      // Stop at close paren (for subqueries in parentheses)
      if (this.peek()?.type === "cparen") break;

      if (!firstCol) {
        // Consume the comma token from the stream
        if (this.peek()?.type === "comma") this.advance();
      }

      this.newLine(colIndent);
      this.writeInlineUntil(() => {
        if (this.peek()?.type === "comma") return true;
        if (this.peek()?.type === "cparen") return true;
        if (this.isClauseKeyword()) return true;
        if (this.isStatementStart()) return true;
        if (this.upper() === "END") return true;
        return false;
      });

      // Emit the comma at the end of the column line (if more columns follow)
      if (this.peek()?.type === "comma") {
        this.emit(",");
      }

      firstCol = false;
    }
  }

  // --- WITH (CTE) ---
  private formatWith(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // WITH
    this.emit(" ");

    // CTE definitions (possibly multiple, comma-separated)
    let firstCte = true;
    while (!this.atEnd()) {
      if (!firstCte) {
        this.emit(",");
        this.newLine(stmtIndent);
      }

      // CTE name
      this.emitToken(this.advance());
      this.emit(" ");

      // AS
      if (this.upper() === "AS") {
        this.emitToken(this.advance());
        this.emit(" ");
      }

      // (
      if (this.peek()?.type === "oparen") {
        this.emit(this.advance().value); // (

        // Format the CTE body (a SELECT query)
        const bodyIndent = stmtIndent + INDENT_SIZE;
        this.newLine(bodyIndent);
        this.indent = bodyIndent;
        this.formatSelectQuery(bodyIndent);
        this.indent = stmtIndent;

        // )
        this.newLine(stmtIndent);
        if (this.peek()?.type === "cparen") {
          this.emit(this.advance().value); // )
        }
      }

      firstCte = false;

      // Check for another CTE
      if (this.peek()?.type === "comma") {
        continue;
      }
      break;
    }

    // The DML statement after the CTE
    this.newLine(stmtIndent);
    this.formatDmlAfterCte();
  }

  private formatDmlAfterCte(): void {
    switch (this.upper()) {
      case "UPDATE":
        return this.formatUpdate();
      case "INSERT":
        return this.formatInsert();
      case "DELETE":
        return this.formatDelete();
      case "SELECT":
        return this.formatSelectStatement();
      case "MERGE":
        return this.formatGenericLine();
      default:
        return this.formatGenericLine();
    }
  }

  // --- Optional clauses (FROM, WHERE, JOIN, GROUP BY, ORDER BY, HAVING) ---
  private formatOptionalClauses(stmtIndent: number): void {
    while (!this.atEnd()) {
      const u = this.upper();

      if (this.isStatementStart()) break;
      // Stop at close paren (e.g., end of CTE body)
      if (this.peek()?.type === "cparen") break;

      if (u === "FROM") {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // FROM
        this.emit(" ");
        this.writeTableRef();
        continue;
      }

      if (this.isJoinStart()) {
        this.formatJoinClause(stmtIndent);
        continue;
      }

      if (u === "ON") {
        this.newLine(stmtIndent + INDENT_SIZE);
        this.emitToken(this.advance()); // ON
        this.emit(" ");
        this.writeInlineUntil(
          () =>
            this.isClauseKeyword() ||
            this.isStatementStart() ||
            this.peek()?.type === "cparen",
        );
        continue;
      }

      if (u === "WHERE") {
        this.formatWhereClause(stmtIndent);
        continue;
      }

      if (u === "GROUP" && this.upper(1) === "BY") {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // GROUP
        this.emit(" ");
        this.emitToken(this.advance()); // BY
        this.emit(" ");
        this.writeInlineUntil(
          () =>
            this.isClauseKeyword() ||
            this.isStatementStart() ||
            this.peek()?.type === "cparen",
        );
        continue;
      }

      if (u === "ORDER" && this.upper(1) === "BY") {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // ORDER
        this.emit(" ");
        this.emitToken(this.advance()); // BY
        this.emit(" ");
        this.writeInlineUntil(
          () =>
            this.isClauseKeyword() ||
            this.isStatementStart() ||
            this.peek()?.type === "cparen",
        );
        continue;
      }

      if (u === "HAVING") {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // HAVING
        this.emit(" ");
        this.writeInlineUntil(
          () =>
            this.isClauseKeyword() ||
            this.isStatementStart() ||
            this.peek()?.type === "cparen",
        );
        continue;
      }

      if (u === "UNION") {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // UNION
        if (this.upper() === "ALL") {
          this.emit(" ");
          this.emitToken(this.advance()); // ALL
        }
        this.newLine(stmtIndent);
        if (this.upper() === "SELECT") {
          this.formatSelectQuery(stmtIndent);
        }
        continue;
      }

      // Unknown clause - stop
      break;
    }
  }

  // --- JOIN clause ---
  private formatJoinClause(stmtIndent: number): void {
    this.newLine(stmtIndent);

    // Consume the JOIN keyword combination
    const u = this.upper();
    if (u === "INNER") {
      this.emitToken(this.advance()); // INNER
      this.emit(" ");
      this.emitToken(this.advance()); // JOIN
    } else if (u === "LEFT" || u === "RIGHT" || u === "FULL") {
      this.emitToken(this.advance()); // LEFT/RIGHT/FULL
      this.emit(" ");
      if (this.upper() === "OUTER") {
        this.emitToken(this.advance()); // OUTER
        this.emit(" ");
      }
      this.emitToken(this.advance()); // JOIN
    } else if (u === "CROSS") {
      this.emitToken(this.advance()); // CROSS
      this.emit(" ");
      this.emitToken(this.advance()); // JOIN or APPLY
    } else if (u === "OUTER") {
      this.emitToken(this.advance()); // OUTER
      this.emit(" ");
      this.emitToken(this.advance()); // APPLY
    } else {
      this.emitToken(this.advance()); // JOIN
    }

    this.emit(" ");
    this.writeTableRef();

    // ON clause
    if (this.upper() === "ON") {
      // Trailing space after table ref on the JOIN line
      this.emit(" ");
      this.newLine(stmtIndent + INDENT_SIZE);
      this.emitToken(this.advance()); // ON
      this.emit(" ");
      this.writeInlineUntil(
        () => this.isClauseKeyword() || this.isStatementStart(),
      );
    }
  }

  // --- WHERE clause ---
  private formatWhereClause(stmtIndent: number): void {
    this.newLine(stmtIndent);
    this.emitToken(this.advance()); // WHERE
    this.emit(" ");

    const stopCondition = () =>
      this.isAndOr() ||
      this.isClauseKeywordNotAndOr() ||
      this.isStatementStart() ||
      this.peek()?.type === "cparen";

    // First condition
    this.writeInlineUntil(stopCondition);
    // Trailing space if AND/OR continuation follows
    if (this.isAndOr()) this.emit(" ");

    // AND/OR continuations - aligned so conditions line up with WHERE condition
    // WHERE has 6 chars (including trailing space), AND has 4, OR has 3
    // AND indent = stmtIndent + 6 - 4 = stmtIndent + 2
    // OR  indent = stmtIndent + 6 - 3 = stmtIndent + 3
    while (this.isAndOr()) {
      const kw = this.upper();
      const alignIndent = kw === "AND" ? stmtIndent + 2 : stmtIndent + 3;
      this.newLine(alignIndent);
      this.emitToken(this.advance()); // AND or OR
      this.emit(" ");
      this.writeInlineUntil(stopCondition);
    }
  }

  private isClauseKeywordNotAndOr(): boolean {
    const u = this.upper();
    if (u === "AND" || u === "OR") return false;
    return this.isClauseKeyword();
  }

  // --- CASE expression ---
  private formatCaseExpression(lineIndent: number): void {
    const caseCol = this.currentLine.length;
    this.emitToken(this.advance()); // CASE

    // Check for simple CASE (CASE expr WHEN ...)
    if (!this.isWordAt(0, "WHEN", "ELSE", "END")) {
      this.emit(" ");
      this.writeInlineUntil(() => this.isWordAt(0, "WHEN", "ELSE", "END"));
    }

    // Trailing space after CASE keyword line
    this.emit(" ");

    // WHEN/ELSE/END clauses
    while (!this.atEnd()) {
      const u = this.upper();

      if (u === "WHEN" || u === "ELSE") {
        this.lineAt(caseCol);
        this.emitToken(this.advance()); // WHEN or ELSE
        this.emit(" ");
        this.writeInlineUntil(() => this.isWordAt(0, "WHEN", "ELSE", "END"));
        continue;
      }

      if (u === "END") {
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
    this.emit(" ");

    // Write condition (everything until BEGIN or a statement start that's not part of the condition)
    this.writeInlineUntil(
      () =>
        this.upper() === "BEGIN" ||
        (this.isStatementStart() && this.upper() !== "SELECT") ||
        this.atEnd(),
    );

    if (this.upper() === "BEGIN") {
      // Block body
      this.newLine(stmtIndent);
      this.formatBeginEndBlock();
    } else {
      // Single statement body, indented
      // Trailing space before continuation
      this.emit(" ");
      this.indent = stmtIndent + INDENT_SIZE;
      this.newLine();
      this.formatStatement();
      this.indent = stmtIndent;
    }

    // ELSE
    if (this.upper() === "ELSE") {
      // Trailing space on END line before ELSE
      this.emit(" ");
      this.newLine(stmtIndent);
      this.emitToken(this.advance()); // ELSE

      if (this.upper() === "IF") {
        // ELSE IF chain
        this.emit(" ");
        this.formatIf();
      } else if (this.upper() === "BEGIN") {
        // Trailing space on ELSE line before BEGIN
        this.emit(" ");
        this.newLine(stmtIndent);
        this.formatBeginEndBlock();
      } else {
        this.indent = stmtIndent + INDENT_SIZE;
        this.newLine();
        this.formatStatement();
        this.indent = stmtIndent;
      }
    }
  }

  // --- BEGIN...END block (plain, TRY, CATCH) ---
  private formatBegin(): void {
    const u1 = this.upper(1);

    if (u1 === "TRY" || u1 === "CATCH") {
      this.formatBeginTryCatch();
    } else if (u1 === "TRAN" || u1 === "TRANSACTION") {
      // BEGIN TRAN is not a block - it's a statement
      this.emitToken(this.advance()); // BEGIN
      this.emit(" ");
      this.emitToken(this.advance()); // TRAN/TRANSACTION
    } else {
      // Plain BEGIN...END block
      this.formatBeginEndBlock();
    }
  }

  private formatBeginEndBlock(): void {
    const blockIndent = this.indent;
    this.emitToken(this.advance()); // BEGIN

    // Content
    this.indent = blockIndent + INDENT_SIZE;
    this.formatStatementList(true);
    this.indent = blockIndent;

    // END
    if (this.upper() === "END") {
      this.newLine(blockIndent);
      this.emitToken(this.advance()); // END
    }
  }

  private formatBeginTryCatch(): void {
    const blockIndent = this.indent;

    // BEGIN TRY
    this.emitToken(this.advance()); // BEGIN
    this.emit(" ");
    this.emitToken(this.advance()); // TRY

    // TRY content
    this.indent = blockIndent + INDENT_SIZE;
    this.formatStatementList(true);
    this.indent = blockIndent;

    // END TRY
    if (this.upper() === "END") {
      this.newLine(blockIndent);
      this.emitToken(this.advance()); // END
      if (this.upper() === "TRY" || this.upper() === "CATCH") {
        this.emit(" ");
        this.emitToken(this.advance()); // TRY or CATCH
      }
    }

    // BEGIN CATCH (immediately follows END TRY, no blank lines)
    if (this.upper() === "BEGIN" && this.isWordAt(1, "CATCH")) {
      this.newLine(blockIndent);
      this.emitToken(this.advance()); // BEGIN
      this.emit(" ");
      this.emitToken(this.advance()); // CATCH

      // CATCH content
      this.indent = blockIndent + INDENT_SIZE;
      this.formatStatementList(true);
      this.indent = blockIndent;

      // END CATCH
      if (this.upper() === "END") {
        this.newLine(blockIndent);
        this.emitToken(this.advance()); // END
        if (this.upper() === "CATCH") {
          this.emit(" ");
          this.emitToken(this.advance()); // CATCH
        }
      }
    }
  }

  // --- Transaction commands ---
  private formatTransactionCmd(): void {
    this.emitToken(this.advance()); // COMMIT or ROLLBACK
    if (this.upper() === "TRAN" || this.upper() === "TRANSACTION") {
      this.emit(" ");
      this.emitToken(this.advance()); // TRAN/TRANSACTION
    }
  }

  // --- Simple commands (THROW, etc.) ---
  private formatSimpleCmd(): void {
    this.emitToken(this.advance());
    // Consume any remaining tokens on this statement
    if (
      !this.atEnd() &&
      !this.isStatementStart() &&
      this.peek()?.type !== "semicolon"
    ) {
      this.emit(" ");
      this.writeInlineUntil(() => this.isStatementStart());
    }
  }

  // --- PRINT ---
  private formatPrint(): void {
    this.emitToken(this.advance()); // PRINT
    this.emit(" ");
    this.writeInlineUntil(() => this.isStatementStart());
  }

  // --- Generic line ---
  private formatGenericLine(): void {
    this.writeInlineUntil(() => this.isStatementStart());
  }

  // --- Table reference (name, possibly schema.name or db.schema.name) ---
  private writeTableRef(): void {
    if (this.atEnd() || this.peek()?.type !== "word") return;
    this.emitToken(this.advance()); // table name or first part

    while (this.peek()?.type === "dot") {
      this.emit(this.advance().value); // .
      if (this.peek()?.type === "word") {
        this.emitToken(this.advance()); // next part
      }
    }

    // Optional alias
    if (
      this.peek()?.type === "word" &&
      !this.isClauseKeyword() &&
      !this.isStatementStart()
    ) {
      const u = this.upper();
      if (u === "AS") {
        this.emit(" ");
        this.emitToken(this.advance()); // AS
        this.emit(" ");
        if (this.peek()?.type === "word") {
          this.emitToken(this.advance()); // alias
        }
      } else if (!isKeywordLike(this.peek()!.value)) {
        this.emit(" ");
        this.emitToken(this.advance()); // alias
      }
    }
  }

  // --- Inline expression writing ---
  private writeInlineUntil(stop: () => boolean): void {
    let prevToken: Token | null = null;

    while (!this.atEnd() && !stop()) {
      const token = this.peek()!;

      // Handle parenthesized expressions inline
      if (token.type === "oparen") {
        if (this.needsSpaceBefore(token, prevToken)) this.emit(" ");
        this.writeInlineParens();
        prevToken = { type: "cparen", value: ")" };
        continue;
      }

      this.advance();
      if (this.needsSpaceBefore(token, prevToken)) this.emit(" ");
      this.emitToken(token);
      prevToken = token;
    }
  }

  private writeInlineParens(): void {
    this.emit("(");
    this.advance(); // consume (

    let depth = 1;
    let prevToken: Token | null = { type: "oparen", value: "(" };

    while (!this.atEnd() && depth > 0) {
      const token = this.peek()!;

      if (token.type === "oparen") depth++;
      if (token.type === "cparen") {
        depth--;
        if (depth === 0) {
          this.advance();
          this.emit(")");
          break;
        }
      }

      this.advance();
      if (this.needsSpaceBefore(token, prevToken)) this.emit(" ");
      this.emitToken(token);
      prevToken = token;
    }
  }
}

// --- VSCode provider ---
export class TsqlFormattingProvider
  implements vscode.DocumentFormattingEditProvider
{
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
  ): vscode.TextEdit[] {
    const config = vscode.workspace.getConfiguration("tsqlFormatter");
    const options: FormatterOptions = {
      linesBetweenQueries: Math.max(
        0,
        config.get<number>("linesBetweenQueries", 2),
      ),
      breakOnKeywords: config.get<boolean>("breakOnKeywords", true),
      keywordCase: config.get<KeywordCaseOption>("keywordCase", "preserve"),
      elementCase: config.get<CaseOption>("elementCase", "preserve"),
    };

    const source = document.getText();
    const formatted = formatTsql(source, options);

    if (formatted === source) {
      return [];
    }

    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(source.length),
    );

    return [vscode.TextEdit.replace(fullRange, formatted)];
  }
}

function formatTsql(input: string, options: FormatterOptions): string {
  const normalized = input.replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return input;
  }

  const tokens = tokenize(normalized);
  const formatter = new SqlFormatter(tokens, options);
  return formatter.format();
}
