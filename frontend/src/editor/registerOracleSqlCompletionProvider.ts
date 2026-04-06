import * as monaco from "monaco-editor";
import { getColumnsFromFromClauseCompletionItems } from "./sqlCompletionFromColumns";
import { getSqlDotColumnCompletionItems, sqlChunkBeforeCursor } from "./sqlCompletionDot";
import { getSqlDynamicCompletionItems } from "./sqlCompletionDynamic";
import { getOracleStaticCompletions } from "./oracleSqlStaticCompletions";
import {
  applySqlCompletionSituationRanking,
  starSelectCompletionItem,
} from "./sqlCompletionRanking";
import { detectSqlCompletionSituation } from "./sqlCompletionSituation";
import { getSqlCompletionConnectionId } from "./sqlCompletionContext";

let didRegister = false;

function replaceRangeAtPosition(
  model: monaco.editor.ITextModel,
  position: monaco.Position
): monaco.Range {
  const w = model.getWordAtPosition(position);
  if (w) {
    return new monaco.Range(
      position.lineNumber,
      w.startColumn,
      position.lineNumber,
      w.endColumn
    );
  }
  return new monaco.Range(
    position.lineNumber,
    position.column,
    position.lineNumber,
    position.column
  );
}

/**
 * Single global provider for `language: sql` (Oracle worksheet).
 * Task 3 will append dynamic schema/object suggestions when `getSqlCompletionConnectionId()` is non-empty.
 */
export function registerOracleSqlCompletionProvider(): void {
  if (didRegister) {
    return;
  }
  didRegister = true;

  monaco.languages.registerCompletionItemProvider("sql", {
    triggerCharacters: [".", "(", ","],
    provideCompletionItems: (model, position, context, token) => {
      return (async (): Promise<monaco.languages.CompletionList> => {
        if (token.isCancellationRequested) {
          return { suggestions: [] };
        }

        const range = replaceRangeAtPosition(model, position);
        const connId = getSqlCompletionConnectionId();

        const staticSuggestions: monaco.languages.CompletionItem[] =
          getOracleStaticCompletions().map((item) => ({
            ...item,
            range,
          }));

        if (!connId) {
          return { suggestions: staticSuggestions };
        }

        try {
          const dotCols = await getSqlDotColumnCompletionItems(
            connId,
            model,
            position,
            range,
            token,
            context
          );
          if (dotCols !== null) {
            const chunkDot = sqlChunkBeforeCursor(model, position);
            const situationDot = detectSqlCompletionSituation(chunkDot);
            const dotMerged = applySqlCompletionSituationRanking(situationDot, [
              ...dotCols,
              ...staticSuggestions,
            ]);
            return { suggestions: dotMerged };
          }

          const chunk = sqlChunkBeforeCursor(model, position);
          const situation = detectSqlCompletionSituation(chunk);

          const fromClauseColumns =
            situation === "select_list" || situation === "where_expr"
              ? await getColumnsFromFromClauseCompletionItems(
                  connId,
                  model,
                  position,
                  range,
                  token
                )
              : [];

          if (token.isCancellationRequested) {
            return { suggestions: [] };
          }

          const dynamic = await getSqlDynamicCompletionItems(
            connId,
            model,
            position,
            range,
            token
          );

          const star =
            situation === "select_list" ? [starSelectCompletionItem(range)] : [];

          const merged = applySqlCompletionSituationRanking(situation, [
            ...staticSuggestions,
            ...star,
            ...fromClauseColumns,
            ...dynamic,
          ]);

          return { suggestions: merged };
        } catch (e) {
          console.warn("[sql-completion]", e);
          return { suggestions: staticSuggestions };
        }
      })();
    },
  });
}
