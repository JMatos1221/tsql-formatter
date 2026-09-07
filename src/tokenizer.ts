import { MULTI_WORD_BY_FIRST_WORD } from './keywords';

// --- Token definition ---
export interface Token {
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
  upper: string;
  hasPrecedingNewline: boolean;
}

export function makeToken(type: Token['type'], value: string, hasPrecedingNewline = false): Token {
  return {
    type,
    value,
    upper: type === 'word' ? value.toUpperCase() : '',
    hasPrecedingNewline,
  };
}

// Character classification by char code
export function isWhitespaceCode(c: number): boolean {
  return c === 32 || (c >= 9 && c <= 13); // space, \t \n \v \f \r
}

export function isDigitCode(c: number): boolean {
  return c >= 48 && c <= 57; // 0-9
}

export function isWordStartCode(c: number): boolean {
  return (
    (c >= 65 && c <= 90) || // A-Z
    (c >= 97 && c <= 122) || // a-z
    c === 95 || // _
    c === 64 || // @
    c === 35 || // #
    c === 36 // $
  );
}

export function isWordCharCode(c: number): boolean {
  return (
    (c >= 65 && c <= 90) || // A-Z
    (c >= 97 && c <= 122) || // a-z
    (c >= 48 && c <= 57) || // 0-9
    c === 95 || // _
    c === 36 || // $
    c === 64 || // @
    c === 35 // #
  );
}

// --- Tokenizer ---
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const len = input.length;
  let i = 0;
  let hasNewline = true;

  const push = (type: Token['type'], value: string) => {
    tokens.push(makeToken(type, value, hasNewline));
    hasNewline = false;
  };

  while (i < len) {
    const code = input.charCodeAt(i);

    // Skip whitespace
    if (isWhitespaceCode(code)) {
      if (code === 10 || code === 13) {
        hasNewline = true;
      }
      i++;
      continue;
    }

    // N-prefixed string literal (N'...')
    if ((code === 78 || code === 110) && input.charCodeAt(i + 1) === 39) {
      let end = i + 2;
      while (end < len) {
        if (input.charCodeAt(end) === 39) {
          if (input.charCodeAt(end + 1) === 39) {
            end += 2;
          } else {
            end++;
            break;
          }
        } else {
          end++;
        }
      }
      push('string', input.slice(i, end));
      i = end;
      continue;
    }

    // String literal ('...')
    if (code === 39) {
      let end = i + 1;
      while (end < len) {
        if (input.charCodeAt(end) === 39) {
          if (input.charCodeAt(end + 1) === 39) {
            end += 2;
          } else {
            end++;
            break;
          }
        } else {
          end++;
        }
      }
      push('string', input.slice(i, end));
      i = end;
      continue;
    }

    // Single-line comment (-- ...)
    if (code === 45 && input.charCodeAt(i + 1) === 45) {
      let end = i + 2;
      while (end < len && input.charCodeAt(end) !== 10 && input.charCodeAt(end) !== 13) end++;
      push('comment', input.slice(i, end).trim());
      i = end;
      continue;
    }

    // Block comment (/* ... */)
    if (code === 47 && input.charCodeAt(i + 1) === 42) {
      let end = i + 2;
      while (end < len && !(input.charCodeAt(end) === 42 && input.charCodeAt(end + 1) === 47))
        end++;
      if (end < len) end += 2;
      push('comment', input.slice(i, end));
      i = end;
      continue;
    }

    // Bracketed identifier [...]
    if (code === 91) {
      let end = i + 1;
      while (end < len && input.charCodeAt(end) !== 93) end++;
      if (end < len) end++;
      push('word', input.slice(i, end));
      i = end;
      continue;
    }

    // Double-quoted identifier "..."
    if (code === 34) {
      let end = i + 1;
      while (end < len && input.charCodeAt(end) !== 34) end++;
      if (end < len) end++;
      push('word', input.slice(i, end));
      i = end;
      continue;
    }

    // Word (identifier, keyword, variable, system variable)
    if (isWordStartCode(code)) {
      let end = i;
      if (code === 64 && input.charCodeAt(i + 1) === 64)
        end = i + 2; // @@
      else if (code === 35 && input.charCodeAt(i + 1) === 35)
        end = i + 2; // ##
      else if (code === 64 || code === 35) end = i + 1; // @ or #

      while (end < len && isWordCharCode(input.charCodeAt(end))) end++;
      push('word', input.slice(i, end));
      i = end;
      continue;
    }

    // Number
    if (isDigitCode(code)) {
      let end = i;
      while (end < len && (isDigitCode(input.charCodeAt(end)) || input.charCodeAt(end) === 46))
        end++;
      push('number', input.slice(i, end));
      i = end;
      continue;
    }

    // Punctuation and operators
    if (code === 40) {
      // (
      push('oparen', '(');
      i++;
      continue;
    }
    if (code === 41) {
      // )
      push('cparen', ')');
      i++;
      continue;
    }
    if (code === 44) {
      // ,
      push('comma', ',');
      i++;
      continue;
    }
    if (code === 46) {
      // .
      push('dot', '.');
      i++;
      continue;
    }
    if (code === 59) {
      // ;
      push('semicolon', ';');
      i++;
      continue;
    }
    if (code === 42) {
      // *
      push('star', '*');
      i++;
      continue;
    }

    // Multi-char operators
    const nextCode = input.charCodeAt(i + 1);
    if (code === 60 && nextCode === 62) {
      // <>
      push('operator', '<>');
      i += 2;
      continue;
    }
    if (code === 33 && nextCode === 61) {
      // !=
      push('operator', '!=');
      i += 2;
      continue;
    }
    if (code === 62 && nextCode === 61) {
      // >=
      push('operator', '>=');
      i += 2;
      continue;
    }
    if (code === 60 && nextCode === 61) {
      // <=
      push('operator', '<=');
      i += 2;
      continue;
    }

    // Single char operators (=, <, >, +, -, /, %)
    if (
      code === 61 ||
      code === 60 ||
      code === 62 ||
      code === 43 ||
      code === 45 ||
      code === 47 ||
      code === 37
    ) {
      push('operator', input[i]);
      i++;
      continue;
    }

    // Anything else (e.g. unknown symbols)
    push('operator', input[i]);
    i++;
  }

  return tokens;
}

// Merge consecutive word tokens that form multi-word keywords
export function mergeMultiWordKeywords(tokens: Token[]): Token[] {
  const result: Token[] = [];
  const len = tokens.length;
  let i = 0;

  while (i < len) {
    const tok = tokens[i];
    if (tok.type === 'word') {
      const candidates = MULTI_WORD_BY_FIRST_WORD.get(tok.upper);
      let matched = false;
      if (candidates) {
        for (let c = 0; c < candidates.length; c++) {
          const pattern = candidates[c];
          const patLen = pattern.length;
          if (i + patLen > len) continue;
          let allMatch = true;
          for (let j = 1; j < patLen; j++) {
            const t = tokens[i + j];
            if (t.type !== 'word' || t.upper !== pattern[j]) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) {
            let combinedValue = tok.value;
            for (let j = 1; j < patLen; j++) {
              combinedValue += ' ' + tokens[i + j].value;
            }
            result.push({
              type: 'word',
              value: combinedValue,
              upper: pattern.join(' '),
              hasPrecedingNewline: tok.hasPrecedingNewline,
            });
            i += patLen;
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
