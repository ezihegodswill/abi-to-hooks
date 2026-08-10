import { describe, expect, test } from "bun:test";
import generate from "@babel/generator";
import { parseABI } from "../ingestion";
import { buildIR } from "../ir";
import { generateContractFileAst } from "./index";

describe("Phase 3: AST Generation", () => {
  test("should generate a complete valid Babel AST for a smart contract including read, write, and event hooks", () => {
    const rawAbi = [
      {
        type: "function",
        name: "balanceOf",
        inputs: [{ name: "owner", type: "address" }],
        outputs: [{ name: "balance", type: "uint256" }],
        stateMutability: "view",
      },
      {
        type: "function",
        name: "transfer",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "success", type: "bool" }],
        stateMutability: "nonpayable",
      },
      {
        type: "event",
        name: "Transfer",
        inputs: [
          { name: "from", type: "address", indexed: true },
          { name: "to", type: "address", indexed: true },
          { name: "value", type: "uint256", indexed: false },
        ],
      },
    ];

    const parsedAbi = parseABI(rawAbi);
    const ir = buildIR(parsedAbi, "ERC20");
    const astFile = generateContractFileAst(ir, parsedAbi);

    expect(astFile.type).toBe("File");

    // Render AST to string to verify AST node output
    const outputCode = generate(astFile).code;

    expect(outputCode).toContain(
      "import { useReadContract, useWriteContract, useWatchContractEvent",
    );
    expect(outputCode).toContain("export const erc20Abi = [");
    expect(outputCode).toContain("as const;");
    expect(outputCode).toContain("export function useReadERC20BalanceOf");
    expect(outputCode).toContain("export function useWriteERC20Transfer");
    expect(outputCode).toContain("export function useWatchERC20Transfer");

    // Verify zero 'as any' exists in generated code output
    expect(outputCode).not.toContain("as any");
  });
});
