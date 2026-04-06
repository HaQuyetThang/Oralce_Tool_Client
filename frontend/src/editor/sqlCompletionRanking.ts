import * as monaco from "monaco-editor";
import type { SqlCompletionSituation } from "./sqlCompletionSituation";

const Kind = monaco.languages.CompletionItemKind;

export function completionItemLabel(
  item: monaco.languages.CompletionItem
): string {
  const l = item.label;
  return typeof l === "string" ? l : l.label;
}

export function starSelectCompletionItem(
  range: monaco.Range
): monaco.languages.CompletionItem {
  return {
    label: "*",
    kind: Kind.Value,
    detail: "All columns",
    insertText: "* ",
    sortText: "0_star",
    range,
  };
}

/** Adjust sortText tiers so relevant groups float for the current keyword context. */
export function applySqlCompletionSituationRanking(
  situation: SqlCompletionSituation,
  items: monaco.languages.CompletionItem[]
): monaco.languages.CompletionItem[] {
  if (situation === "general") {
    return items;
  }

  return items.map((item) => {
    const kind = item.kind;
    const label = completionItemLabel(item);
    const base = item.sortText ?? label;
    let tier = "";

    switch (situation) {
      case "from_join":
        if (
          kind === Kind.Module ||
          kind === Kind.Struct ||
          kind === Kind.Interface
        ) {
          tier = "0_";
        } else if (kind === Kind.Keyword || kind === Kind.Function) {
          tier = "6_";
        } else {
          tier = "3_";
        }
        break;

      case "select_list":
        if (
          kind === Kind.Field ||
          (kind === Kind.Value && label === "*") ||
          (kind === Kind.Keyword && label === "*")
        ) {
          tier = "0_";
        } else if (kind === Kind.Function) {
          tier = "1_";
        } else if (
          kind === Kind.Module ||
          kind === Kind.Struct ||
          kind === Kind.Interface
        ) {
          tier = "7_";
        } else if (kind === Kind.Keyword) {
          tier = "5_";
        } else {
          tier = "4_";
        }
        break;

      case "where_expr":
        if (kind === Kind.Field) {
          tier = "0_";
        } else if (kind === Kind.Function) {
          tier = "1_";
        } else if (
          kind === Kind.Module ||
          kind === Kind.Struct ||
          kind === Kind.Interface
        ) {
          tier = "7_";
        } else if (kind === Kind.Keyword) {
          tier = "5_";
        } else {
          tier = "4_";
        }
        break;

      case "plsql":
        if (
          kind === Kind.Module ||
          kind === Kind.Struct ||
          kind === Kind.Interface
        ) {
          tier = "8_";
        } else if (kind === Kind.Keyword) {
          tier = "2_";
        } else {
          tier = "4_";
        }
        break;

      default:
        return item;
    }

    return { ...item, sortText: tier + base };
  });
}
