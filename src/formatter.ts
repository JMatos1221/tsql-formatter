import * as vscode from 'vscode';

type CaseOption = 'upper' | 'lower' | 'preserve' | 'matchTable';
type KeywordCaseOption = 'upper' | 'lower' | 'preserve';

interface FormatterOptions {
  linesBetweenQueries: number;
  breakOnKeywords: boolean;
  keywordCase: KeywordCaseOption;
  elementCase: CaseOption;
  useBrackets: boolean;
}

const KEYWORDS = new Set([
  'SELECT', 'DELETE', 'UPDATE', 'INSERT', 'MERGE', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN',
  'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'ON', 'GROUP', 'BY', 'ORDER',
  'HAVING', 'AS', 'INTO', 'VALUES', 'SET', 'TOP', 'DISTINCT', 'UNION', 'ALL', 'GO'
]);

const QUERY_BOUNDARY_KEYWORDS = new Set(['SELECT', 'DELETE', 'UPDATE', 'INSERT', 'MERGE']);
const BREAK_KEYWORDS = ['WHERE', 'JOIN', 'AND', 'OR'];

export class TsqlFormattingProvider implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
    const config = vscode.workspace.getConfiguration('tsqlFormatter');
    const options: FormatterOptions = {
      linesBetweenQueries: Math.max(0, config.get<number>('linesBetweenQueries', 2)),
      breakOnKeywords: config.get<boolean>('breakOnKeywords', true),
      keywordCase: config.get<KeywordCaseOption>('keywordCase', 'preserve'),
      elementCase: config.get<CaseOption>('elementCase', 'preserve'),
      useBrackets: config.get<boolean>('useBrackets', false)
    };

    const source = document.getText();
    const formatted = formatTsql(source, options);

    if (formatted === source) {
      return [];
    }

    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(source.length)
    );

    return [vscode.TextEdit.replace(fullRange, formatted)];
  }
}

export function formatTsql(input: string, options: FormatterOptions): string {
  const normalized = input.replace(/\r\n?/g, '\n').trim();
  if (!normalized) {
    return input;
  }

  let text = transformOutsideStringLiterals(normalized, (code) => transformTokens(code, options));

  if (options.breakOnKeywords) {
    for (const keyword of BREAK_KEYWORDS) {
      const breakRegex = new RegExp(`\\s+(${keyword})\\b`, 'gi');
      text = text.replace(breakRegex, '\n$1');
    }
  }

  text = normalizeQuerySpacing(text, options.linesBetweenQueries);

  return `${text.trim()}\n`;
}

function transformTokens(code: string, options: FormatterOptions): string {
  let previousKeyword: string | null = null;
  let lastTableCase: 'upper' | 'lower' | 'preserve' = 'preserve';

  return code.replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, (token, offset, source) => {
    const upper = token.toUpperCase();
    const isKeyword = KEYWORDS.has(upper);
    const isFunction = /^\s*\(/.test(source.slice(offset + token.length));

    let output = token;

    if (isKeyword) {
      output = applyCase(token, options.keywordCase);
    } else if (!isFunction) {
      output = applyElementCase(token, options.elementCase, source, offset, lastTableCase);

      if (options.useBrackets && !isAlreadyBracketed(source, offset, token.length)) {
        output = `[${output}]`;
      }
    }

    if (isKeyword) {
      previousKeyword = upper;
    } else {
      if (previousKeyword && ['FROM', 'JOIN', 'UPDATE', 'INTO'].includes(previousKeyword)) {
        lastTableCase = detectCase(token);
      }
      previousKeyword = null;
    }

    return output;
  });
}

function applyElementCase(
  token: string,
  option: CaseOption,
  source: string,
  offset: number,
  lastTableCase: 'upper' | 'lower' | 'preserve'
): string {
  if (option === 'preserve') {
    return token;
  }

  if (option === 'upper' || option === 'lower') {
    return applyCase(token, option);
  }

  const previousChar = source[offset - 1];
  if (option === 'matchTable' && previousChar === '.') {
    return applyCase(token, lastTableCase);
  }

  return token;
}

function applyCase(value: string, option: KeywordCaseOption | 'upper' | 'lower' | 'preserve'): string {
  if (option === 'upper') {
    return value.toUpperCase();
  }

  if (option === 'lower') {
    return value.toLowerCase();
  }

  return value;
}

function detectCase(value: string): 'upper' | 'lower' | 'preserve' {
  if (value === value.toUpperCase() && value !== value.toLowerCase()) {
    return 'upper';
  }

  if (value === value.toLowerCase() && value !== value.toUpperCase()) {
    return 'lower';
  }

  return 'preserve';
}

function isAlreadyBracketed(source: string, offset: number, length: number): boolean {
  return source[offset - 1] === '[' && source[offset + length] === ']';
}

function normalizeQuerySpacing(text: string, linesBetweenQueries: number): string {
  const lines = text.split('\n');
  const output: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      output.push('');
      continue;
    }

    const isBoundary = QUERY_BOUNDARY_KEYWORDS.has(trimmed.split(/\s+/, 1)[0].toUpperCase());

    if (isBoundary && output.length > 0) {
      while (output.length > 0 && output[output.length - 1] === '') {
        output.pop();
      }

      for (let i = 0; i < linesBetweenQueries; i += 1) {
        output.push('');
      }
    }

    output.push(trimmed.replace(/\s+/g, ' '));
  }

  return output.join('\n');
}

function transformOutsideStringLiterals(text: string, transform: (code: string) => string): string {
  const parts = text.split(/('(?:''|[^'])*')/g);
  return parts
    .map((part, index) => (index % 2 === 0 ? transform(part) : part))
    .join('');
}
