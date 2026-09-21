const assert = require('assert');
const { formatTsql, formatTsqlAsync } = require('../out/formatter');
const { tokenizeAsync, mergeMultiWordKeywordsAsync } = require('../out/tokenizer');

const defaultOptions = {
  breakOnKeywords: true,
  identifierCase: 'preserve',
  keywordCase: 'upper',
  linesBetweenQueries: 2,
  maxLineLength: 100,
  useBrackets: false,
  useMaxLineLength: true,
};

async function runTests() {
  console.log('--- Testing Advanced Async Execution & Cancellation ---\n');

  // Test 1: Cancellation during tokenizeAsync
  {
    const longScript = 'SELECT id, name FROM dbo.Users WHERE active = 1;\n'.repeat(5000);
    const token = { isCancellationRequested: true };
    const tokens = await tokenizeAsync(longScript, token);
    assert.strictEqual(tokens.length, 0, 'tokenizeAsync should return empty array when cancelled');
    console.log('✓ tokenizeAsync respects cancellation token');
  }

  // Test 2: Cancellation during mergeMultiWordKeywordsAsync
  {
    const rawTokens = [];
    for (let i = 0; i < 10000; i++) {
      rawTokens.push({ type: 'word', value: 'ORDER', upper: 'ORDER', hasPrecedingNewline: false });
      rawTokens.push({ type: 'word', value: 'BY', upper: 'BY', hasPrecedingNewline: false });
    }
    const token = { isCancellationRequested: true };
    const merged = await mergeMultiWordKeywordsAsync(rawTokens, token);
    assert.strictEqual(
      merged.length,
      0,
      'mergeMultiWordKeywordsAsync should return empty array when cancelled',
    );
    console.log('✓ mergeMultiWordKeywordsAsync respects cancellation token');
  }

  // Test 3: Cancellation during nested BEGIN...END formatting
  {
    const statement = 'SELECT id, col1, col2 FROM tbl WHERE id = 1;\n';
    const blockScript = 'BEGIN\n' + statement.repeat(10000) + 'END;\n';
    const token = { isCancellationRequested: false };

    // Trigger cancellation after 15ms
    setTimeout(() => {
      token.isCancellationRequested = true;
    }, 15);

    const result = await formatTsqlAsync(blockScript, defaultOptions, token);
    assert.strictEqual(result, blockScript, 'Cancelled formatting should return input unchanged');
    console.log('✓ formatTsqlAsync aborts promptly when cancelled inside BEGIN...END');
  }

  // Test 4: Nested IF/WHILE/TRY-CATCH blocks format asynchronously with identical results to sync
  {
    const complexScript = `
CREATE OR ALTER PROCEDURE dbo.ProcessBatch
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @counter INT = 0;

    WHILE @counter < 10
    BEGIN
        IF @counter % 2 = 0
        BEGIN
            BEGIN TRY
                INSERT INTO dbo.AuditLog (Step, Timestamp)
                VALUES (@counter, SYSDATETIME());
            END TRY
            BEGIN CATCH
                PRINT 'Error logged';
            END CATCH;
        END
        ELSE
        BEGIN
            SELECT @counter AS OddStep;
        END;

        SET @counter += 1;
    END;
END;
    `.trim();

    const syncResult = formatTsql(complexScript, defaultOptions);
    const asyncResult = await formatTsqlAsync(complexScript, defaultOptions);
    assert.strictEqual(
      asyncResult,
      syncResult,
      'Async result must match sync result for nested blocks',
    );
    console.log('✓ formatTsqlAsync matches formatTsql on nested IF/WHILE/TRY-CATCH blocks');
  }

  console.log('\nAll async cancellation tests passed successfully!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
