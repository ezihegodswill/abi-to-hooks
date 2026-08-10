import template from "@babel/template";
import * as t from "@babel/types";
import { capitalize } from "../ir/sanitizer";
import type { IREvent, IRFunction } from "../ir/types";

/**
 * Generates an AST Node for a wagmi useReadContract hook.
 *
 * @param contractName Name of smart contract (e.g., "ERC20")
 * @param fn Normalized IRFunction definition
 * @param abiVarName Exported ABI constant name (e.g., "erc20Abi")
 */
export function generateReadHookAst(
  contractName: string,
  fn: IRFunction,
  abiVarName: string,
): t.ExportNamedDeclaration {
  const hookName = `useRead${capitalize(contractName)}${capitalize(fn.safeName)}`;

  const statement = template.statement.ast(
    `
    export function ${hookName}(
      parameters?: UseReadContractParameters
    ) {
      return useReadContract({
        abi: ${abiVarName},
        functionName: '${fn.originalName}',
        ...parameters,
      });
    }
  `,
    { plugins: ["typescript"] },
  );

  if (!t.isExportNamedDeclaration(statement)) {
    throw new Error(`Failed to generate read hook AST for ${hookName}`);
  }

  return statement;
}

/**
 * Generates an AST Node for a wagmi useWriteContract hook.
 *
 * @param contractName Name of smart contract (e.g., "ERC20")
 * @param fn Normalized IRFunction definition
 */
export function generateWriteHookAst(
  contractName: string,
  fn: IRFunction,
): t.ExportNamedDeclaration {
  const hookName = `useWrite${capitalize(contractName)}${capitalize(fn.safeName)}`;

  const statement = template.statement.ast(
    `
    export function ${hookName}(
      parameters?: UseWriteContractParameters
    ) {
      return useWriteContract(parameters);
    }
  `,
    { plugins: ["typescript"] },
  );

  if (!t.isExportNamedDeclaration(statement)) {
    throw new Error(`Failed to generate write hook AST for ${hookName}`);
  }

  return statement;
}

/**
 * Generates an AST Node for a wagmi useWatchContractEvent hook.
 *
 * @param contractName Name of smart contract (e.g., "ERC20")
 * @param evt Normalized IREvent definition
 * @param abiVarName Exported ABI constant name (e.g., "erc20Abi")
 */
export function generateEventHookAst(
  contractName: string,
  evt: IREvent,
  abiVarName: string,
): t.ExportNamedDeclaration {
  const hookName = `useWatch${capitalize(contractName)}${capitalize(evt.safeName)}`;

  const statement = template.statement.ast(
    `
    export function ${hookName}(
      parameters?: UseWatchContractEventParameters
    ) {
      return useWatchContractEvent({
        abi: ${abiVarName},
        eventName: '${evt.originalName}',
        ...parameters,
      });
    }
  `,
    { plugins: ["typescript"] },
  );

  if (!t.isExportNamedDeclaration(statement)) {
    throw new Error(`Failed to generate event hook AST for ${hookName}`);
  }

  return statement;
}
