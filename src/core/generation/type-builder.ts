import * as t from "@babel/types";
import type { IRParameter } from "../ir/types";

/**
 * Converts a TS type string (derived from IR) into a Babel TSType AST node.
 */
export function parseTSTypeToAst(tsTypeString: string): t.TSType {
  const clean = tsTypeString.trim();

  if (clean === "bigint") {
    return t.tsBigIntKeyword();
  }
  if (clean === "number") {
    return t.tsNumberKeyword();
  }
  if (clean === "boolean") {
    return t.tsBooleanKeyword();
  }
  if (clean === "string") {
    return t.tsStringKeyword();
  }
  if (clean === "`0x${string}`") {
    // Template literal type `0x${string}`
    return t.tsTemplateLiteralType(
      [t.templateElement({ raw: "0x", cooked: "0x" })],
      [t.tsStringKeyword()],
    );
  }
  if (clean.endsWith("[]")) {
    const elementType = parseTSTypeToAst(clean.slice(0, -2));
    return t.tsArrayType(elementType);
  }

  // Fallback for custom or unknown inline object types
  return t.tsUnknownKeyword();
}

/**
 * Constructs a Babel TSTupleType node for function input argument arrays.
 * Example: `[owner: `0x${string}`, amount: bigint]`
 */
export function buildArgsTupleAst(inputs: IRParameter[]): t.TSTupleType {
  const tupleMembers = inputs.map((param) => {
    const paramType = parseTSTypeToAst(param.tsType);
    const label = t.identifier(param.safeName);
    return t.tsNamedTupleMember(label, paramType, false);
  });

  return t.tsTupleType(tupleMembers);
}
