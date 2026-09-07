import type * as vscode from 'vscode';
import { formatTsqlAsync, FormatterOptions, CaseOption, KeywordCaseOption } from './formatter';

let _outputChannel: vscode.OutputChannel | null = null;
export function getOutputChannel(): vscode.OutputChannel {
  if (!_outputChannel) {
    const vscodeMod: typeof import('vscode') = require('vscode');
    _outputChannel = vscodeMod.window.createOutputChannel('TSQL Formatter');
  }
  return _outputChannel;
}

export class TsqlFormattingProvider
  implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider
{
  async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    _options?: vscode.FormattingOptions,
    token?: vscode.CancellationToken,
  ): Promise<vscode.TextEdit[]> {
    const vscodeMod: typeof import('vscode') = require('vscode');
    const fullRange = new vscodeMod.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length),
    );
    return this.provideFormattingEdits(document, fullRange, token);
  }

  async provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    _options?: vscode.FormattingOptions,
    token?: vscode.CancellationToken,
  ): Promise<vscode.TextEdit[]> {
    if (range.isEmpty) {
      return [];
    }
    return this.provideFormattingEdits(document, range, token);
  }

  private async provideFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    token?: vscode.CancellationToken,
  ): Promise<vscode.TextEdit[]> {
    const vscodeMod: typeof import('vscode') = require('vscode');
    const config = vscodeMod.workspace.getConfiguration('tsqlFormatter');
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
      const formatted = await formatTsqlAsync(source, options, token);

      if (token?.isCancellationRequested) {
        return [];
      }

      if (formatted === source) {
        return [];
      }

      return [vscodeMod.TextEdit.replace(range, formatted)];
    } catch (err) {
      if (token?.isCancellationRequested) {
        return [];
      }
      const error = err instanceof Error ? err : new Error(String(err));
      getOutputChannel().appendLine(`[tsql-formatter] Formatting failed: ${error.message}`);
      getOutputChannel().appendLine(error.stack ?? 'no stack');
      getOutputChannel().show(true);
      void vscodeMod.window.showErrorMessage(
        'tsql-formatter: failed to format document. See "TSQL Formatter" output for details.',
      );
      return [];
    }
  }
}
