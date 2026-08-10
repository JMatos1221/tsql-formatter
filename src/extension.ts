import * as vscode from 'vscode';
import { TsqlFormattingProvider, getOutputChannel } from './formatter';

export function activate(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [
    { language: 'sql', scheme: 'file' },
    { language: 'sql', scheme: 'untitled' },
  ];
  const formatter = new TsqlFormattingProvider();

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(selector, formatter),
    vscode.languages.registerDocumentRangeFormattingEditProvider(selector, formatter),
  );

  // Ensure the extension has an Output channel tab visible in the Output panel.
  const out = getOutputChannel();
  context.subscriptions.push(out);
  out.appendLine('TSQL Formatter activated');
}

export function deactivate(): void {
  // no-op
}
