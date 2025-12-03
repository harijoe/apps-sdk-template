// react-llm-describe.tsx
import { createContext, useContext, useEffect, useId, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type LLMDescribeContent = string;

export interface LLMDescribeNode {
  id: string;
  parentId: string | null;
  content: string | null;
}

/* ------------------------------------------------------------------ */
/*  In-memory tree store                                               */
/* ------------------------------------------------------------------ */

const nodes = new Map<string, LLMDescribeNode>();

function setNode(node: LLMDescribeNode) {
  nodes.set(node.id, node);
  onChange();
}

function removeNode(id: string) {
  nodes.delete(id);
  onChange();
}

function onChange() {
  const description = getLLMDescriptionString();
  window.openai.setWidgetState({
    ...window.openai.widgetState,
    __widget_context: description,
  });
}

/* ------------------------------------------------------------------ */
/*  Context to track current parent                                    */
/* ------------------------------------------------------------------ */

const ParentIdContext = createContext<string | null>(null);

/* ------------------------------------------------------------------ */
/*  Component API                                                      */
/* ------------------------------------------------------------------ */

interface LLMDescribeProps {
  content: LLMDescribeContent | null | undefined;
  children?: ReactNode;
}

/**
 * LLMDescribe wraps a subtree and declares a description for that subtree.
 * The hierarchy of these components mirrors the React component hierarchy.
 */
export function LLMDescribe({ content, children }: LLMDescribeProps) {
  const parentId = useContext(ParentIdContext);
  const id = useId();

  useEffect(() => {
    // null/undefined means "this node has no description, but still exists
    // as a structural parent"
    setNode({
      id,
      parentId,
      content: content ?? null,
    });

    return () => {
      removeNode(id);
    };
  }, [id, parentId, content]);

  return <ParentIdContext.Provider value={id}>{children}</ParentIdContext.Provider>;
}

/* ------------------------------------------------------------------ */
/*  Read helpers                                                       */
/* ------------------------------------------------------------------ */

/** Get a snapshot of the tree as a list of nodes. */
// eslint-disable-next-line react-refresh/only-export-components
export function getLLMDescriptionNodes(): LLMDescribeNode[] {
  return Array.from(nodes.values());
}

/**
 * Build a hierarchical string, suitable to pass to an LLM.
 * This is a simple DFS with indentation based on depth.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getLLMDescriptionString(): string {
  const all = getLLMDescriptionNodes();

  // index by parentId
  const byParent = new Map<string | null, LLMDescribeNode[]>();
  for (const node of all) {
    const key = node.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(node);
  }

  // deterministic order: by id
  for (const list of byParent.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }

  const lines: string[] = [];

  function dfs(parentId: string | null, depth: number) {
    const children = byParent.get(parentId);
    if (!children) return;

    for (const child of children) {
      if (child.content && child.content.trim()) {
        const indent = "  ".repeat(depth);
        lines.push(`${indent}- ${child.content.trim()}`);
      }
      dfs(child.id, depth + 1);
    }
  }

  // start from roots (parentId === null)
  dfs(null, 0);

  return lines.join("\n");
}
