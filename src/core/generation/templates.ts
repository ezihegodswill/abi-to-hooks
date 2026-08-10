import template from "@babel/template";
import * as t from "@babel/types";

/**
 * AST statement for wagmi React imports
 */
export const importsAst = template.statement.ast(
  `import { useReadContract, useWriteContract, useSimulateContract, useWatchContractEvent, type UseReadContractParameters, type UseWriteContractParameters, type UseSimulateContractParameters, type UseWatchContractEventParameters } from 'wagmi';`,
  { plugins: ["typescript"] },
);

/**
 * Skeleton template for raw ABI constant export (`export const erc20Abi = [...] as const;`)
 */
export function buildAbiExportAst(
  abiVariableName: string,
  rawAbiJson: string,
): t.ExportNamedDeclaration {
  const ast = template.statement.ast(
    `export const ${abiVariableName} = ${rawAbiJson} as const;`,
    {
      plugins: ["typescript"],
    },
  );

  if (!t.isExportNamedDeclaration(ast)) {
    throw new Error(`Failed to create AST export for ${abiVariableName}`);
  }

  return ast;
}
