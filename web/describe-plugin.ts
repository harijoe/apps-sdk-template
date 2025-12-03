// tools/llm-describe-babel-plugin.ts
import type { PluginObj } from "@babel/core";
import { types as t } from "@babel/core";

const LLM_IMPORT_SOURCE = "@/widgets/llm-describe"; // <-- adjust to your actual path

interface State {
  hasLLMDescribeImport?: boolean;
  needsLLMDescribeImport?: boolean;
}

export default function describePlugin(): PluginObj<State> {
  return {
    name: "llm-describe-babel",

    visitor: {
      Program: {
        enter(path, state) {
          state.hasLLMDescribeImport = false;
          state.needsLLMDescribeImport = false;

          // Detect existing `import { LLMDescribe } from "@/web/llm-describe"`
          for (const node of path.node.body) {
            if (!t.isImportDeclaration(node)) continue;
            if (node.source.value !== LLM_IMPORT_SOURCE) continue;

            const hasSpecifier = node.specifiers.some(
              (s) => t.isImportSpecifier(s) && t.isIdentifier(s.imported, { name: "LLMDescribe" }),
            );

            if (hasSpecifier) {
              state.hasLLMDescribeImport = true;
              break;
            }
          }
        },

        exit(path, state) {
          if (state.needsLLMDescribeImport && !state.hasLLMDescribeImport) {
            const importDecl = t.importDeclaration(
              [t.importSpecifier(t.identifier("LLMDescribe"), t.identifier("LLMDescribe"))],
              t.stringLiteral(LLM_IMPORT_SOURCE),
            );

            path.node.body.unshift(importDecl);
          }
        },
      },

      JSXElement(path, state) {
        const opening = path.node.openingElement;
        const attrs = opening.attributes;

        // Find `llm` attribute
        const llmAttrIndex = attrs.findIndex(
          (attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: "llm" }),
        );

        if (llmAttrIndex === -1) return;

        const llmAttr = attrs[llmAttrIndex] as t.JSXAttribute;

        // Remove the `llm` prop from the original element
        const newAttrs = [...attrs];
        newAttrs.splice(llmAttrIndex, 1);
        opening.attributes = newAttrs;

        // Resolve value for `content`
        // Support: llm="string" and llm={expr}
        let contentExpression: t.Expression;

        if (!llmAttr.value) {
          // `<Foo llm />` -> empty string
          contentExpression = t.stringLiteral("");
        } else if (t.isStringLiteral(llmAttr.value)) {
          contentExpression = llmAttr.value;
        } else if (t.isJSXExpressionContainer(llmAttr.value)) {
          contentExpression = llmAttr.value.expression as t.Expression;
        } else {
          // Unhandled pattern; skip transform
          return;
        }

        const contentAttr = t.jsxAttribute(
          t.jsxIdentifier("content"),
          t.isStringLiteral(contentExpression) ? contentExpression : t.jsxExpressionContainer(contentExpression),
        );

        // Build <LLMDescribe content={...}>{originalElement}</LLMDescribe>
        const llmOpening = t.jsxOpeningElement(t.jsxIdentifier("LLMDescribe"), [contentAttr]);
        const llmClosing = t.jsxClosingElement(t.jsxIdentifier("LLMDescribe"));

        const wrapped = t.jsxElement(llmOpening, llmClosing, [path.node], false);

        state.needsLLMDescribeImport = true;
        path.replaceWith(wrapped);
      },
    },
  };
}
