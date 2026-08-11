import * as t from "@babel/types";
import type { IRContract } from "../ir/types";
import {
  generateEventHookAst,
  generateReadHookAst,
  generateSimulateHookAst,
  generateWriteHookAst,
} from "./hook-generator";
import { buildAbiExportAst, importsAst } from "./templates";

export * from "./hook-generator";
export * from "./templates";
export * from "./type-builder";

/**
 * Derives a clean camelCase variable name for the exported ABI constant (e.g., "ERC20" -> "erc20Abi").
 */
export function getAbiVarName(contractName: string): string {
  if (!contractName) return "contractAbi";
  const clean = contractName.trim();
  if (/^ERC\d+/i.test(clean)) {
    return `${clean.toLowerCase()}Abi`;
  }
  return `${clean.charAt(0).toLowerCase()}${clean.slice(1)}Abi`;
}

/**
 * Assembles the complete Babel AST Program (t.File) for a Smart Contract.
 *
 * @param ir Normalized IRContract structure
 * @param rawAbi Sanitized ABI payload to emit as constant
 * @returns Complete, valid Babel t.File AST node
 */
export function generateContractFileAst(
  ir: IRContract,
  rawAbi: unknown,
): t.File {
  const bodyNodes: t.Statement[] = [];

  // 1. Add wagmi imports
  bodyNodes.push(importsAst);

  // 2. Add raw ABI export constant (`export const <contract>Abi = [...] as const;`)
  const abiVarName = getAbiVarName(ir.name);
  const rawAbiJsonString = JSON.stringify(rawAbi, null, 2);
  const abiExportAst = buildAbiExportAst(abiVarName, rawAbiJsonString);
  bodyNodes.push(abiExportAst);

  // 3. Generate Read Hooks
  for (const readFn of ir.readFunctions) {
    const hookAst = generateReadHookAst(ir.name, readFn, abiVarName);
    bodyNodes.push(hookAst);
  }

  // 4. Generate Write Hooks & Simulation Hooks
  for (const writeFn of ir.writeFunctions) {
    const writeHookAst = generateWriteHookAst(ir.name, writeFn);
    const simulateHookAst = generateSimulateHookAst(
      ir.name,
      writeFn,
      abiVarName,
    );
    bodyNodes.push(writeHookAst);
    bodyNodes.push(simulateHookAst);
  }

  // 5. Generate Event Hooks
  for (const evt of ir.events) {
    const hookAst = generateEventHookAst(ir.name, evt, abiVarName);
    bodyNodes.push(hookAst);
  }

  const program = t.program(bodyNodes, [], "module");
  return t.file(program);
}

/**
 * Assembles a Babel AST Program (t.File) for an index.ts file re-exporting modules.
 *
 * @param moduleNames List of module basenames (e.g. ['ERC20', 'Vault'])
 */
export function generateIndexFileAst(moduleNames: string[]): t.File {
  const bodyNodes: t.Statement[] = moduleNames.map((name) =>
    t.exportAllDeclaration(t.stringLiteral(`./${name}`)),
  );
  const program = t.program(bodyNodes, [], "module");
  return t.file(program);
}
