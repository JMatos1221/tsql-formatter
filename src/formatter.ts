import type * as vscode from 'vscode';
import {
  KEYWORDS,
  FUNCTIONS,
  TYPES_WITH_PARAMS,
  WITH_OPTION_KEYWORDS,
  STATEMENT_START_KEYWORDS,
  CREATE_DROP_OBJECT_KEYWORDS,
  CLAUSE_KEYWORDS,
  JOIN_START_KEYWORDS,
} from './keywords';
import { Token, makeToken, tokenize, mergeMultiWordKeywords } from './tokenizer';
import { TsqlFormattingProvider, getOutputChannel } from './provider';

export type CaseOption = 'upper' | 'lower' | 'preserve';
export type KeywordCaseOption = 'upper' | 'lower' | 'preserve';

export interface FormatterOptions {
  breakOnKeywords: boolean;
  identifierCase: CaseOption;
  keywordCase: KeywordCaseOption;
  linesBetweenQueries: number;
  maxLineLength: number;
  useBrackets: boolean;
  useMaxLineLength: boolean;
}

// Re-exports for backwards compatibility
export {
  Token,
  makeToken,
  tokenize,
  mergeMultiWordKeywords,
  TsqlFormattingProvider,
  getOutputChannel,
};

// --- Casing helpers ---
function applyCase(value: string, option: string): string {
  if (option === 'upper') return value.toUpperCase();
  if (option === 'lower') return value.toLowerCase();
  return value;
}

function isKeywordLike(token: Token): boolean {
  const v = token.value;
  if (v.charCodeAt(0) === 91 || v.charCodeAt(0) === 34) return false; // [ or "
  return (
    KEYWORDS.has(token.upper) ||
    FUNCTIONS.has(token.upper) ||
    (v.charCodeAt(0) === 64 && v.charCodeAt(1) === 64) // @@
  );
}

const NON_WRAPPING_TYPES = new Set(['comma', 'cparen', 'semicolon', 'dot']);
const INDENT_SIZE = 4;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

// --- Formatter class ---
export class SqlFormatter {
  private tokens: Token[];
  private pos: number = 0;
  private lines: string[] = [];
  private currentLine: string = '';
  private currentLineTouched: boolean = false;
  private indent: number = 0;
  private options: FormatterOptions;
  private cancellationToken?: { readonly isCancellationRequested: boolean };

  constructor(
    tokens: Token[],
    options: FormatterOptions,
    cancellationToken?: { readonly isCancellationRequested: boolean },
  ) {
    this.tokens = tokens;
    this.options = options;
    this.cancellationToken = cancellationToken;
  }

  format(): string {
    this.formatStatementList(false);
    this.finishLine();
    return this.lines.join('\n').trim() + '\n';
  }

  async formatAsync(): Promise<string> {
    await this.formatStatementListAsync(false);
    if (this.cancellationToken?.isCancellationRequested) {
      return '';
    }
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

  private isWordAt(offset: number, w1: string, w2?: string, w3?: string, w4?: string): boolean {
    const u = this.upper(offset);
    if (u === w1) return true;
    if (w2 !== undefined && u === w2) return true;
    if (w3 !== undefined && u === w3) return true;
    if (w4 !== undefined && u === w4) return true;
    return false;
  }

  private isType(offset: number, type: string): boolean {
    return this.peek(offset)?.type === type;
  }

  // --- Output helpers ---
  private emit(text: string): void {
    this.currentLine += text;
    this.currentLineTouched = true;
  }

  private finishLine(): void {
    if (!this.currentLineTouched) {
      this.currentLine = '';
      return;
    }
    const line = this.currentLine;
    const isBlank = line.trim() === '';
    if (isBlank && this.lines.length > 0 && this.lines[this.lines.length - 1] === '') {
      this.currentLine = '';
      this.currentLineTouched = false;
      return;
    }
    this.lines.push(isBlank ? '' : line);
    this.currentLine = '';
    this.currentLineTouched = false;
  }

  private newLine(indentSpaces?: number): void {
    this.finishLine();
    this.currentLine = ' '.repeat(indentSpaces ?? this.indent);
    this.currentLineTouched = false;
  }

  private blankLines(count: number): void {
    this.finishLine();
    let existingBlanks = 0;
    while (
      existingBlanks < this.lines.length &&
      this.lines[this.lines.length - 1 - existingBlanks] === ''
    ) {
      existingBlanks++;
    }
    for (let i = existingBlanks; i < count; i++) this.lines.push('');
  }

  private pushBlankLineIfNeeded(): void {
    if (this.lines.length === 0) return;
    if (this.lines[this.lines.length - 1] === '') return;
    this.lines.push('');
  }

  private lineAt(col: number): void {
    this.finishLine();
    this.currentLine = ' '.repeat(col);
    this.currentLineTouched = false;
  }

  private wrapBeforeTokenIfNeeded(token: Token, tokenText: string): void {
    if (!this.options.useMaxLineLength) return;
    if (this.options.maxLineLength <= 0) return;
    if (!this.currentLineTouched) return;
    if (NON_WRAPPING_TYPES.has(token.type)) return;
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
    if (token.value.charCodeAt(0) === 91 || token.value.charCodeAt(0) === 34) return token.value;
    if (isKeywordLike(token)) {
      return applyCase(token.value, this.options.keywordCase);
    }
    return this.applyIdentifierCasing(token);
  }

  private applyIdentifierCasing(token: Token): string {
    if (token.value.charCodeAt(0) === 91 || token.value.charCodeAt(0) === 34) return token.value;
    const opt = this.options.identifierCase;
    let value = token.value;
    if (opt === 'upper' || opt === 'lower') value = applyCase(value, opt);
    if (this.options.useBrackets && !token.value.startsWith('@') && !token.value.startsWith('#')) {
      value = `[${value}]`;
    }
    return value;
  }

  // --- Comment emission ---
  private emitCommentText(text: string): void {
    if (!text.includes('\n')) {
      this.emit(text);
      return;
    }
    const parts = text.split('\n');
    this.emit(parts[0].trimEnd());
    for (let i = 1; i < parts.length; i++) {
      this.finishLine();
      this.currentLine = parts[i].trimEnd();
      this.currentLineTouched = true;
    }
  }

  private emitCommentRun(indent: number): void {
    let first = true;
    while (!this.atEnd() && this.peek()?.type === 'comment') {
      const token = this.advance();
      const isBlockComment = token.value.startsWith('/*');

      if (first || isBlockComment) {
        this.finishLine();
        this.pushBlankLineIfNeeded();
      }
      this.currentLine = ' '.repeat(indent);
      this.currentLineTouched = false;
      this.emitCommentText(token.value);

      this.finishLine();
      if (isBlockComment) {
        this.pushBlankLineIfNeeded();
      }
      this.currentLine = ' '.repeat(indent);
      this.currentLineTouched = false;

      first = false;
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
      const upper = prev.upper;
      if (
        FUNCTIONS.has(upper) ||
        TYPES_WITH_PARAMS.has(upper) ||
        upper === 'OVER' ||
        upper.endsWith('PATH') ||
        upper.endsWith('ROOT')
      )
        return false;
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
    if (u === 'ELSE') return true;
    if (u === 'WITH') return !WITH_OPTION_KEYWORDS.has(this.upper(1));
    if (STATEMENT_START_KEYWORDS.has(u)) return true;
    if (u === 'CREATE' && CREATE_DROP_OBJECT_KEYWORDS.has(this.upper(1))) return true;
    if (u === 'DROP' && CREATE_DROP_OBJECT_KEYWORDS.has(this.upper(1))) return true;
    if (u === 'BEGIN') return true;
    if (this.isEndKeyword()) return true;
    return false;
  }

  private formatInlineStatementToTerminator(): void {
    if (this.atEnd()) return;
    this.emitToken(this.advance());
    const atTerminator = () => this.peek()?.type === 'semicolon' || this.upper() === 'GO';
    if (!this.atEnd() && !atTerminator()) {
      this.emit(' ');
      this.writeInlineUntil(atTerminator);
    }
    if (this.peek()?.type === 'semicolon') {
      this.emit(this.advance().value);
    }
  }

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

  private isSubqueryStart(): boolean {
    if (this.peek()?.type !== 'oparen') return false;
    let offset = 1;
    while (this.peek(offset)?.type === 'comment') offset++;
    const inner = this.peek(offset);
    if (!inner || inner.type !== 'word') return false;
    return inner.upper === 'SELECT';
  }

  // --- Statement list formatter (synchronous) ---
  private formatStatementList(insideBlock: boolean): void {
    let first = true;
    while (!this.atEnd()) {
      if (insideBlock) {
        const u = this.upper();
        if (this.isEndKeyword() || u === 'ELSE') break;
      }

      while (this.peek()?.type === 'semicolon') this.advance();
      if (this.atEnd()) break;
      if (insideBlock && (this.isEndKeyword() || this.upper() === 'ELSE')) break;

      const hasLeadingComments = this.peek()?.type === 'comment';

      if (first) {
        this.finishLine();
      } else if (!hasLeadingComments) {
        const nextToken = this.peek();
        const nextWord = nextToken?.type === 'word' ? nextToken.upper : '';
        if (nextWord === 'GO') {
          this.finishLine();
        } else {
          this.blankLines(this.options.linesBetweenQueries);
        }
      }
      this.finishLine();
      this.currentLine = ' '.repeat(this.indent);
      this.currentLineTouched = false;

      this.emitCommentRun(this.indent);
      if (this.atEnd()) break;
      if (insideBlock && (this.isEndKeyword() || this.upper() === 'ELSE')) break;

      const posBefore = this.pos;
      this.formatStatement();
      if (this.pos === posBefore && !this.atEnd()) {
        this.emitToken(this.advance());
      }
      first = false;
    }
  }

  // --- Statement list formatter (asynchronous, non-blocking) ---
  private async formatStatementListAsync(insideBlock: boolean): Promise<void> {
    let first = true;
    let lastYieldTime = performance.now();

    while (!this.atEnd()) {
      if (this.cancellationToken?.isCancellationRequested) {
        return;
      }

      // Cooperative yielding to event loop if more than 10ms have elapsed
      if (performance.now() - lastYieldTime > 10) {
        await yieldToEventLoop();
        lastYieldTime = performance.now();
        if (this.cancellationToken?.isCancellationRequested) {
          return;
        }
      }

      if (insideBlock) {
        const u = this.upper();
        if (this.isEndKeyword() || u === 'ELSE') break;
      }

      while (this.peek()?.type === 'semicolon') this.advance();
      if (this.atEnd()) break;
      if (insideBlock && (this.isEndKeyword() || this.upper() === 'ELSE')) break;

      const hasLeadingComments = this.peek()?.type === 'comment';

      if (first) {
        this.finishLine();
      } else if (!hasLeadingComments) {
        const nextToken = this.peek();
        const nextWord = nextToken?.type === 'word' ? nextToken.upper : '';
        if (nextWord === 'GO') {
          this.finishLine();
        } else {
          this.blankLines(this.options.linesBetweenQueries);
        }
      }
      this.finishLine();
      this.currentLine = ' '.repeat(this.indent);
      this.currentLineTouched = false;

      this.emitCommentRun(this.indent);
      if (this.atEnd()) break;
      if (insideBlock && (this.isEndKeyword() || this.upper() === 'ELSE')) break;

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
      case 'CREATE OR ALTER':
        return this.formatCreate();
      case 'DROP':
      case 'DROP TABLE IF EXISTS':
      case 'DROP PROCEDURE IF EXISTS':
      case 'DROP FUNCTION IF EXISTS':
      case 'DROP VIEW IF EXISTS':
      case 'DROP TRIGGER IF EXISTS':
      case 'DROP SCHEMA IF EXISTS':
      case 'DROP DATABASE IF EXISTS':
      case 'DROP TYPE IF EXISTS':
      case 'DROP SEQUENCE IF EXISTS':
      case 'DROP SYNONYM IF EXISTS':
      case 'DROP INDEX IF EXISTS':
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
      case 'BULK':
      case 'BULK INSERT':
      case 'REVERT':
      case 'GRANT':
      case 'REVOKE':
      case 'DENY':
      case 'KILL':
      case 'RECONFIGURE':
      case 'SHUTDOWN':
      case 'SECURITYAUDIT':
      case 'ENABLE TRIGGER':
      case 'DISABLE TRIGGER':
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
      case 'SAVE':
      case 'SAVE TRAN':
      case 'SAVE TRANSACTION':
      case 'COMMIT TRAN':
      case 'COMMIT TRANSACTION':
      case 'COMMIT WORK':
      case 'ROLLBACK TRAN':
      case 'ROLLBACK TRANSACTION':
      case 'ROLLBACK WORK':
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
      case 'TRUNCATE TABLE':
      case 'CHECKPOINT':
        return this.formatGenericLine();
      case 'USE':
        return this.formatUse();
      case 'GO':
        return this.formatGo();
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
    if (this.upper() === 'CREATE OR ALTER') {
      this.emitToken(this.advance());
      this.emit(' ');
      if (this.upper() === 'TABLE') {
        this.formatCreateTableBody();
      } else {
        this.writeInlineUntil(() => this.isStatementStart());
      }
      return;
    }
    const u1 = this.upper(1);
    if (u1 === 'TABLE') {
      this.formatCreateTable();
    } else {
      this.formatGenericLine();
    }
  }

  private formatCreateTableBody(): void {
    this.emitToken(this.advance()); // TABLE
    this.emit(' ');
    this.writeTableRef();
    if (this.peek()?.type !== 'oparen') return;

    this.emit(' ');
    this.emit(this.advance().value); // (

    const colIndent = this.indent + INDENT_SIZE;
    while (!this.atEnd() && this.peek()?.type !== 'cparen') {
      if (this.peek()?.type === 'comment') {
        this.emitCommentRun(colIndent);
        continue;
      }
      this.newLine(colIndent);
      this.writeInlineUntil(() => this.peek()?.type === 'comma' || this.peek()?.type === 'cparen');
      if (this.peek()?.type === 'comma') {
        this.emit(this.advance().value); // ,
      }
    }

    this.newLine(this.indent);
    if (this.peek()?.type === 'cparen') {
      this.emit(this.advance().value); // )
    }
    if (this.peek()?.type === 'semicolon') {
      this.emit(this.advance().value);
    }
  }

  private formatCreateTable(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // CREATE
    this.emit(' ');
    this.emitToken(this.advance()); // TABLE
    this.emit(' ');

    this.writeTableRef();

    if (this.peek()?.type !== 'oparen') return;

    this.emit(' ');
    this.emit(this.advance().value); // (

    const colIndent = stmtIndent + INDENT_SIZE;
    while (!this.atEnd() && this.peek()?.type !== 'cparen') {
      if (this.peek()?.type === 'comment') {
        this.emitCommentRun(colIndent);
        continue;
      }
      this.newLine(colIndent);
      this.writeInlineUntil(() => this.peek()?.type === 'comma' || this.peek()?.type === 'cparen');
      if (this.peek()?.type === 'comma') {
        this.emit(this.advance().value); // ,
      }
    }

    this.newLine(stmtIndent);
    if (this.peek()?.type === 'cparen') {
      this.emit(this.advance().value); // )
    }
    if (this.peek()?.type === 'semicolon') {
      this.emit(this.advance().value);
    }
  }

  // --- DROP ---
  private formatDrop(): void {
    this.emitToken(this.advance()); // DROP or DROP TABLE IF EXISTS (merged)
    if (!this.atEnd() && !this.isStatementStart() && this.peek()?.type !== 'semicolon') {
      this.emit(' ');
      this.writeInlineUntil(() => this.isStatementStart() || this.peek()?.type === 'semicolon');
    }
    if (this.peek()?.type === 'semicolon') {
      this.emit(this.advance().value);
    }
  }

  // --- INSERT ---
  private formatInsert(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // INSERT or INSERT INTO (merged)
    this.emit(' ');

    if (this.upper() === 'INTO') {
      this.emitToken(this.advance());
      this.emit(' ');
    }

    this.writeInlineUntil(
      () => this.isWordAt(0, 'VALUES', 'SELECT', 'EXEC', 'EXECUTE') || this.isStatementStart(),
    );

    if (this.peek()?.type === 'comment') {
      this.emitCommentRun(stmtIndent);
    }

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

      if (token.type === 'comment') {
        this.emitCommentRun(stmtIndent);
        prevToken = null;
        continue;
      }

      if (token.type === 'word' && token.upper === 'CASE') {
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

    if (this.upper() === 'FROM') {
      this.emit(' ');
      this.emitToken(this.advance()); // FROM
    }

    this.emit(' ');
    this.writeTableRef();

    if (this.upper() === 'WHERE') this.emit(' ');

    this.formatOptionalClauses(stmtIndent);
  }

  // --- SELECT (standalone) ---
  private formatSelectStatement(): void {
    this.formatSelectQuery(this.indent);
  }

  private formatSelectQuery(stmtIndent: number): void {
    if (this.peek()?.type === 'comment') {
      this.emitCommentRun(stmtIndent);
    }
    this.emitToken(this.advance()); // SELECT

    if (this.upper() === 'DISTINCT') {
      this.emit(' ');
      this.emitToken(this.advance());
    }
    if (this.upper() === 'TOP') {
      this.emit(' ');
      this.emitToken(this.advance()); // TOP
      this.emit(' ');
      if (this.peek()?.type === 'oparen') {
        this.writeInlineParens();
      } else {
        this.emitToken(this.advance());
      }
    }

    this.formatSelectColumns(stmtIndent);
    this.formatOptionalClauses(stmtIndent);
  }

  private formatSelectColumns(stmtIndent: number): void {
    const colIndent = stmtIndent + INDENT_SIZE;
    let firstCol = true;

    while (!this.atEnd()) {
      if (this.isClauseKeyword() || this.isStatementStart()) break;
      if (this.isEndKeyword()) break;
      if (this.peek()?.type === 'cparen' || this.peek()?.type === 'semicolon') break;

      if (!firstCol && this.peek()?.type === 'comma') {
        this.advance();
      }

      if (this.peek()?.type === 'comment') {
        this.emitCommentRun(colIndent);
        firstCol = false;
        continue;
      }

      this.newLine(colIndent);
      this.writeInlineUntil(() => {
        if (this.peek()?.type === 'comma') return true;
        if (this.peek()?.type === 'cparen') return true;
        if (this.peek()?.type === 'semicolon') return true;
        if (this.isClauseKeyword()) return true;
        if (this.isStatementStart()) return true;
        if (this.isEndKeyword()) return true;
        return false;
      });

      if (this.peek()?.type === 'comma') {
        this.emit(',');
      }
      if (this.peek()?.type === 'semicolon') {
        this.emit(';');
        this.advance();
        break;
      }

      firstCol = false;
    }
  }

  // --- WITH (CTE) ---
  private formatWith(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // WITH
    this.emit(' ');

    let firstCte = true;
    while (!this.atEnd()) {
      if (this.peek()?.type === 'comment') {
        this.emitCommentRun(stmtIndent);
      }
      if (!firstCte) {
        this.emit(',');
        this.newLine(stmtIndent);
      }

      this.emitToken(this.advance()); // CTE name
      this.emit(' ');

      if (this.upper() === 'AS') {
        this.emitToken(this.advance());
        this.emit(' ');
      }

      if (this.peek()?.type === 'comment') {
        this.emitCommentRun(stmtIndent);
      }

      if (this.peek()?.type === 'oparen') {
        this.emit(this.advance().value); // (

        const bodyIndent = stmtIndent + INDENT_SIZE;
        this.newLine(bodyIndent);
        this.indent = bodyIndent;
        if (this.peek()?.type === 'comment') {
          this.emitCommentRun(bodyIndent);
        }
        if (this.upper() === 'SELECT') {
          this.formatSelectQuery(bodyIndent);
        }
        if (this.peek()?.type === 'comment') {
          this.emitCommentRun(bodyIndent);
        }
        this.indent = stmtIndent;

        this.newLine(stmtIndent);
        if (this.peek()?.type === 'cparen') {
          this.emit(this.advance().value); // )
        }
      }

      firstCte = false;

      if (this.peek()?.type === 'comment') {
        this.emitCommentRun(stmtIndent);
      }

      if (this.peek()?.type !== 'comma') break;
      this.advance(); // consume comma
    }

    if (this.peek()?.type === 'comment') {
      this.emitCommentRun(stmtIndent);
    }

    this.newLine(stmtIndent);
    this.formatDmlAfterCte();
  }

  private formatDmlAfterCte(): void {
    if (this.peek()?.type === 'comment') {
      this.emitCommentRun(this.indent);
    }
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

  // --- Optional clauses (FROM, WHERE, JOIN, GROUP BY, ORDER BY, WINDOW, OPTION, etc.) ---
  private formatOptionalClauses(stmtIndent: number): void {
    while (!this.atEnd()) {
      const u = this.upper();

      if (this.isStatementStart()) break;
      if (this.peek()?.type === 'cparen') break;

      if (this.peek()?.type === 'semicolon') {
        this.emit(this.advance().value);
        break;
      }

      if (this.peek()?.type === 'comment') {
        let offset = 1;
        while (this.peek(offset)?.type === 'comment') offset++;
        const nextTok = this.peek(offset);
        const nextUpper = nextTok?.type === 'word' ? nextTok.upper : '';
        const isClauseNext =
          CLAUSE_KEYWORDS.has(nextUpper) ||
          JOIN_START_KEYWORDS.has(nextUpper) ||
          nextUpper === 'ON';

        if (isClauseNext) {
          this.emitCommentRun(stmtIndent);
          continue;
        } else {
          break;
        }
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

      if (u === 'WINDOW') {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // WINDOW
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
        this.emitToken(this.advance());
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
            this.upper() === 'FETCH' ||
            this.isClauseKeyword() ||
            this.isStatementStart() ||
            this.peek()?.type === 'cparen',
        );
        if (this.upper() === 'FETCH') {
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

      if (u === 'OPTION') {
        this.newLine(stmtIndent);
        this.emitToken(this.advance()); // OPTION
        this.emit(' ');
        if (this.peek()?.type === 'oparen') {
          this.writeInlineParens();
        } else {
          this.writeInlineUntil(
            () =>
              this.isClauseKeyword() || this.isStatementStart() || this.peek()?.type === 'cparen',
          );
        }
        continue;
      }

      if (
        u === 'FOR XML' ||
        u === 'FOR JSON' ||
        u === 'FOR BROWSE' ||
        u === 'FOR XML PATH' ||
        u === 'FOR XML RAW' ||
        u === 'FOR XML AUTO' ||
        u === 'FOR XML EXPLICIT' ||
        u === 'FOR JSON PATH' ||
        u === 'FOR JSON AUTO'
      ) {
        this.newLine(stmtIndent);
        this.emitToken(this.advance());
        if (
          !this.atEnd() &&
          !this.isClauseKeyword() &&
          !this.isStatementStart() &&
          this.peek()?.type !== 'semicolon'
        ) {
          if (this.peek()?.type !== 'oparen') {
            this.emit(' ');
          }
          this.writeInlineUntil(
            () =>
              this.isClauseKeyword() || this.isStatementStart() || this.peek()?.type === 'cparen',
          );
        }
        continue;
      }

      break;
    }
  }

  // --- JOIN clause ---
  private formatJoinClause(stmtIndent: number): void {
    this.newLine(stmtIndent);
    const joinUpper = this.upper();
    this.emitToken(this.advance());
    this.emit(' ');

    const isApply = joinUpper.endsWith('APPLY');
    this.writeTableRef(isApply);

    if (this.upper() === 'ON') {
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
      this.isClauseKeyword() ||
      this.isStatementStart() ||
      this.peek()?.type === 'cparen';

    this.writeInlineUntil(stopCondition);
    if (this.isAndOr()) this.emit(' ');

    while (this.isAndOr()) {
      const kw = this.upper();
      const alignIndent = kw === 'AND' ? stmtIndent + 2 : stmtIndent + 3;
      this.newLine(alignIndent);
      this.emitToken(this.advance()); // AND or OR
      this.emit(' ');
      this.writeInlineUntil(stopCondition);
    }
  }

  // --- CASE expression ---
  private formatCaseExpression(lineIndent: number): void {
    const caseCol = this.currentLine.length;
    this.emitToken(this.advance()); // CASE

    if (!this.isWordAt(0, 'WHEN', 'ELSE', 'END')) {
      this.emit(' ');
      this.writeInlineUntil(() => this.isWordAt(0, 'WHEN', 'ELSE', 'END'));
    }

    this.emit(' ');

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

    this.writeInlineUntil(
      () =>
        this.upper() === 'BEGIN' ||
        this.upper() === 'BEGIN TRY' ||
        (this.isStatementStart() && this.upper() !== 'SELECT') ||
        this.atEnd(),
    );

    if (this.peek()?.type === 'comment') {
      this.emitCommentRun(stmtIndent);
    }

    if (this.upper() === 'BEGIN') {
      this.newLine(stmtIndent);
      this.formatBeginEndBlock();
    } else if (this.upper() === 'BEGIN TRY') {
      this.newLine(stmtIndent);
      this.formatBeginTryCatch();
    } else {
      this.indent = stmtIndent + INDENT_SIZE;
      this.newLine();
      this.formatStatement();
      this.indent = stmtIndent;
    }

    // ELSE
    if (this.peek()?.type === 'comment') {
      let offset = 1;
      while (this.peek(offset)?.type === 'comment') offset++;
      if (this.peek(offset)?.upper === 'ELSE') {
        this.emitCommentRun(stmtIndent);
      }
    }

    if (this.upper() === 'ELSE') {
      this.newLine(stmtIndent);
      this.emitToken(this.advance()); // ELSE

      if (this.peek()?.type === 'comment') {
        this.emitCommentRun(stmtIndent);
      }

      if (this.upper() === 'IF') {
        this.emit(' ');
        this.formatIf();
      } else if (this.upper() === 'BEGIN') {
        this.newLine(stmtIndent);
        this.formatBeginEndBlock();
      } else if (this.upper() === 'BEGIN TRY') {
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
    this.formatBeginEndBlock();
  }

  private formatBeginEndBlock(): void {
    const blockIndent = this.indent;
    this.emitToken(this.advance()); // BEGIN

    this.indent = blockIndent + INDENT_SIZE;
    this.formatStatementList(true);
    this.indent = blockIndent;

    if (this.upper() === 'END') {
      this.newLine(blockIndent);
      this.emitToken(this.advance()); // END
    }
  }

  // --- BEGIN TRY...END TRY / BEGIN CATCH...END CATCH ---
  private formatBeginTryCatch(): void {
    const blockIndent = this.indent;

    this.emitToken(this.advance());

    this.indent = blockIndent + INDENT_SIZE;
    this.formatStatementList(true);
    this.indent = blockIndent;

    if (this.upper() === 'END TRY' || this.upper() === 'END CATCH') {
      this.newLine(blockIndent);
      this.emitToken(this.advance());
    } else if (this.upper() === 'END') {
      this.newLine(blockIndent);
      this.emitToken(this.advance());
    }

    if (this.upper() === 'BEGIN CATCH') {
      this.newLine(blockIndent);
      this.formatBeginTryCatch();
    }
  }

  // --- BEGIN TRAN/TRANSACTION ---
  private formatBeginTran(): void {
    this.emitToken(this.advance());
    if (this.peek()?.type === 'semicolon') {
      this.emit(this.advance().value);
    }
  }

  // --- Transaction commands ---
  private formatTransactionCmd(): void {
    this.emitToken(this.advance());
    if (this.isWordAt(0, 'TRAN', 'TRANSACTION', 'WORK')) {
      this.emit(' ');
      this.emitToken(this.advance());
    }
    if (!this.atEnd() && !this.isStatementStart() && this.peek()?.type !== 'semicolon') {
      this.emit(' ');
      this.writeInlineUntil(() => this.isStatementStart() || this.peek()?.type === 'semicolon');
    }
    if (this.peek()?.type === 'semicolon') {
      this.emit(this.advance().value);
    }
  }

  // --- Simple commands (THROW, RAISERROR, RETURN, etc.) ---
  private formatSimpleCmd(): void {
    this.emitToken(this.advance());
    if (!this.atEnd() && !this.isStatementStart() && this.peek()?.type !== 'semicolon') {
      this.emit(' ');
      this.writeInlineUntil(() => this.isStatementStart());
    }
  }

  // --- EXEC/EXECUTE ---
  private formatExec(): void {
    this.emitToken(this.advance());
    this.emit(' ');
    this.writeInlineUntil(() => this.isStatementStart());
  }

  // --- WHILE ---
  private formatWhile(): void {
    const stmtIndent = this.indent;
    this.emitToken(this.advance()); // WHILE
    this.emit(' ');

    this.writeInlineUntil(
      () =>
        this.upper() === 'BEGIN' ||
        (this.isStatementStart() && this.upper() !== 'SELECT') ||
        this.atEnd(),
    );

    if (this.peek()?.type === 'comment') {
      this.emitCommentRun(stmtIndent);
    }

    if (this.upper() === 'BEGIN') {
      this.newLine(stmtIndent);
      this.formatBeginEndBlock();
    } else {
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
    if (!this.atEnd() && !this.isStatementStart()) {
      this.emit(' ');
      this.writeInlineUntil(() => this.isStatementStart());
    }
    if (this.peek()?.type === 'semicolon') {
      this.emit(this.advance().value);
    }
  }

  // --- GO batch separator ---
  private formatGo(): void {
    this.emitToken(this.advance()); // GO
    if (this.peek()?.type === 'number') {
      this.emit(' ');
      this.emitToken(this.advance());
    }
    if (this.peek()?.type === 'semicolon') {
      this.emit(this.advance().value);
    }
    if (this.peek()?.type === 'comment') {
      this.emit(' ');
      const c = this.advance();
      this.emitCommentText(c.value);
    }
  }

  // --- Generic line ---
  private formatGenericLine(): void {
    if (this.atEnd()) return;
    this.emitToken(this.advance());
    if (!this.atEnd() && !this.isStatementStart()) {
      this.emit(' ');
      this.writeInlineUntil(() => this.isStatementStart());
    }
  }

  // --- Table reference ---
  private writeTableRef(consumeParens: boolean = false): void {
    if (this.isSubqueryStart()) {
      this.writeSubquery();
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
    this.emitToken(this.advance());

    while (this.peek()?.type === 'dot') {
      this.emit(this.advance().value); // .
      if (this.peek()?.type === 'word') {
        this.emitToken(this.advance());
      }
    }

    if (consumeParens && this.peek()?.type === 'oparen') {
      this.writeInlineParens();
    }

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

      if (token.type === 'comment') {
        if (token.hasPrecedingNewline) {
          break;
        }
        if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
        this.advance();
        this.emitCommentText(token.value);
        if (token.value.startsWith('--') || token.value.includes('\n')) {
          break;
        }
        prevToken = token;
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

      if (token.type === 'word' && token.upper === 'CASE') {
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

  private writeInlineCase(): void {
    this.emitToken(this.advance()); // CASE
    let depth = 1;
    let prevToken: Token = makeToken('word', 'CASE');

    while (!this.atEnd() && depth > 0) {
      const token = this.peek()!;

      if (token.type === 'word') {
        const upper = token.upper;
        if (upper === 'CASE') depth++;
        if (upper === 'END' && --depth === 0) {
          this.advance();
          if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
          this.emitToken(token);
          break;
        }
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

      if (token.type === 'comment') {
        if (token.hasPrecedingNewline) {
          this.newLine(this.indent + INDENT_SIZE);
          this.advance();
          this.emitCommentText(token.value);
          this.newLine(this.indent + INDENT_SIZE);
          prevToken = token;
          continue;
        }
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

  private writeSubquery(): void {
    const baseIndent = this.currentLine.length - this.currentLine.trimStart().length;
    this.emit('(');
    this.advance(); // consume (
    const subIndent = baseIndent + INDENT_SIZE;
    this.newLine(subIndent);
    const savedIndent = this.indent;
    this.indent = subIndent;
    this.emitCommentRun(subIndent);
    if (this.upper() === 'SELECT') {
      this.formatSelectQuery(subIndent);
    }
    if (this.peek()?.type === 'comment') {
      this.emitCommentRun(subIndent);
    }
    this.indent = savedIndent;
    this.newLine(baseIndent);
    if (this.peek()?.type === 'cparen') {
      this.advance();
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

      if (token.type === 'oparen' && this.isSubqueryStart()) {
        if (this.needsSpaceBefore(token, prevToken)) this.emit(' ');
        this.writeSubquery();
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

export function formatTsql(input: string, options: FormatterOptions): string {
  const normalized = input.replace(/\r\n?/g, '\n').trim();
  if (!normalized) {
    return input;
  }

  const rawTokens = tokenize(normalized);
  const tokens = mergeMultiWordKeywords(rawTokens);
  const formatter = new SqlFormatter(tokens, options);
  return formatter.format();
}

export async function formatTsqlAsync(
  input: string,
  options: FormatterOptions,
  cancellationToken?: { readonly isCancellationRequested: boolean },
): Promise<string> {
  const normalized = input.replace(/\r\n?/g, '\n').trim();
  if (!normalized) {
    return input;
  }

  if (cancellationToken?.isCancellationRequested) {
    return input;
  }

  const rawTokens = tokenize(normalized);
  if (cancellationToken?.isCancellationRequested) {
    return input;
  }

  if (rawTokens.length > 5000) {
    await yieldToEventLoop();
    if (cancellationToken?.isCancellationRequested) {
      return input;
    }
  }

  const tokens = mergeMultiWordKeywords(rawTokens);
  if (cancellationToken?.isCancellationRequested) {
    return input;
  }

  const formatter = new SqlFormatter(tokens, options, cancellationToken);
  return formatter.formatAsync();
}
