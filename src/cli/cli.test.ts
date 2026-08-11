import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  deriveContractName,
  generateHooksFromConfig,
  generateHooksFromFile,
  loadConfigFile,
} from "./generator";

describe("Phase 4: CLI Generator Pipeline Integration", () => {
  const testDir = path.resolve(__dirname, "../../tmp_test_cli");
  const sampleAbiPath = path.join(testDir, "ERC20Sample.json");
  const batchDir = path.join(testDir, "batch_abis");
  const configFilePath = path.join(testDir, "abi-to-hooks.config.json");

  const sampleAbiContent = JSON.stringify([
    {
      type: "function",
      name: "name",
      inputs: [],
      outputs: [{ name: "", type: "string" }],
      stateMutability: "view",
    },
    {
      type: "function",
      name: "approve",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ name: "", type: "bool" }],
      stateMutability: "nonpayable",
    },
    {
      type: "event",
      name: "Approval",
      inputs: [
        { name: "owner", type: "address", indexed: true },
        { name: "spender", type: "address", indexed: true },
        { name: "value", type: "uint256", indexed: false },
      ],
    },
  ]);

  const vaultAbiContent = JSON.stringify([
    {
      type: "function",
      name: "deposit",
      inputs: [{ name: "amount", type: "uint256" }],
      outputs: [],
      stateMutability: "payable",
    },
  ]);

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(sampleAbiPath, sampleAbiContent, "utf-8");

    fs.mkdirSync(batchDir, { recursive: true });
    fs.writeFileSync(
      path.join(batchDir, "ERC20.json"),
      sampleAbiContent,
      "utf-8",
    );
    fs.writeFileSync(
      path.join(batchDir, "Vault.json"),
      vaultAbiContent,
      "utf-8",
    );

    const configContent = JSON.stringify({
      output: "./output_config",
      contracts: [
        { name: "ERC20Token", abi: sampleAbiPath },
        { name: "VaultPool", abi: path.join(batchDir, "Vault.json") },
      ],
    });
    fs.writeFileSync(configFilePath, configContent, "utf-8");
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("should derive clean contract name from file path", () => {
    expect(deriveContractName("./contracts/ERC20.json")).toBe("ERC20");
    expect(deriveContractName("./contracts/my-token.json")).toBe("mytoken");
    expect(deriveContractName("./contracts/Token.json", "CustomToken")).toBe(
      "CustomToken",
    );
  });

  test("should execute full end-to-end hook generation from single ABI file", async () => {
    const outputDir = path.join(testDir, "output_single");
    const result = await generateHooksFromFile({
      abiPath: sampleAbiPath,
      outputPath: outputDir,
      contractName: "ERC20Sample",
    });

    expect(fs.existsSync(result.outputPath)).toBe(true);
    expect(result.code).toContain("useReadContract");
    expect(result.code).toContain("useWriteContract");
    expect(result.code).toContain("useWatchContractEvent");
    expect(result.code).toContain("export const erc20sampleAbi = [");
    expect(result.code).toContain("export function useReadERC20SampleName");
    expect(result.code).toContain("export function useWriteERC20SampleApprove");
    expect(result.code).toContain(
      "export function useWatchERC20SampleApproval",
    );
  });

  test("should execute batch directory generation and create index.ts re-export file", async () => {
    const outputDir = path.join(testDir, "output_batch");
    const result = await generateHooksFromFile({
      abiPath: batchDir,
      outputPath: outputDir,
    });

    expect(fs.existsSync(outputDir)).toBe(true);
    expect(result.generatedFiles?.length).toBe(3); // ERC20.ts, Vault.ts, index.ts

    const erc20Path = path.join(outputDir, "ERC20.ts");
    const vaultPath = path.join(outputDir, "Vault.ts");
    const indexPath = path.join(outputDir, "index.ts");

    expect(fs.existsSync(erc20Path)).toBe(true);
    expect(fs.existsSync(vaultPath)).toBe(true);
    expect(fs.existsSync(indexPath)).toBe(true);

    const indexContent = fs.readFileSync(indexPath, "utf-8");
    expect(indexContent).toContain("./ERC20");
    expect(indexContent).toContain("./Vault");
  });

  test("should load config object file and execute batch generation from manifest", async () => {
    const loaded = loadConfigFile(configFilePath);
    expect(loaded).toBeDefined();
    expect(loaded?.config.contracts.length).toBe(2);

    if (loaded) {
      const result = await generateHooksFromConfig(loaded.config, testDir);
      expect(fs.existsSync(result.outputPath)).toBe(true);
      expect(result.generatedFiles?.length).toBe(3); // ERC20Token.ts, VaultPool.ts, index.ts

      const erc20TokenPath = path.join(result.outputPath, "ERC20Token.ts");
      expect(fs.existsSync(erc20TokenPath)).toBe(true);
    }
  });
});
