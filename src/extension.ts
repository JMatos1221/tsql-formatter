import * as vscode from "vscode";
import { TsqlFormattingProvider } from "./formatter";

export function activate(context: vscode.ExtensionContext): void {
    const selector: vscode.DocumentSelector = [
        { language: "sql", scheme: "file" },
        { language: "sql", scheme: "untitled" },
    ];

    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            selector,
            new TsqlFormattingProvider(),
        ),
    );
}

export function deactivate(): void {
    // no-op
}
