import fs from "node:fs";
import path from "node:path";
import generate from "@babel/generator";
import prettier from "prettier";
import {
  generateContractFileAst,
  generateIndexFileAst,
} from "../core/generation";
import { ABIParseError, parseABI } from "../core/ingestion";
import { buildIR } from "../core/ir";

export interface GenerateOptions {
  abiPath: string;
  outputPath?: string;
  contractName?: string;
}

export interface GenerateResult {
  outputPath: string;
  code: string;
  generatedFiles?: string[];
}

/**
 * Formats TypeScript code string with Prettier, falling back cleanly to raw code on error.
 */
async function formatTypeScriptCode(rawCode: string): Promise<string> {
  try {
    return await prettier.format(rawCode, {
      parser: "typescript",
      singleQuote: true,
      trailingComma: "es5",
      printWidth: 100,
    });
  } catch {
    return rawCode;
  }
}

/**
 * Derives a clean contract display name from an input file path (e.g. "./abis/ERC20.json" -> "ERC20").
 */
export function deriveContractName(
  abiPath: string,
  customName?: string,
): string {
  if (customName && customName.trim() !== "") {
    return customName.trim();
  }

  const baseName = path.basename(abiPath, path.extname(abiPath));
  return baseName.replace(/[^a-zA-Z0-9_$]/g, "") || "Contract";
}

/**
 * Helper to process a single JSON ABI file -> AST -> Formatted TS File
 */
async function processSingleAbiFile(
  filePath: string,
  outputFilePath: string,
  customContractName?: string,
): Promise<{ code: string; contractName: string }> {
  let fileContent: string;
  try {
    fileContent = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read ABI file at ${filePath}: ${(err as Error).message}`,
    );
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(fileContent);
  } catch (err) {
    throw new ABIParseError(
      `Invalid JSON in file ${filePath}: ${(err as Error).message}`,
    );
  }

  const parsedAbi = parseABI(rawJson);
  const contractName = deriveContractName(filePath, customContractName);
  const ir = buildIR(parsedAbi, contractName);
  const astFile = generateContractFileAst(ir, parsedAbi);
  const rawCode = generate(astFile).code;
  const formattedCode = await formatTypeScriptCode(rawCode);

  const outputDir = path.dirname(outputFilePath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFilePath, formattedCode, "utf-8");

  return { code: formattedCode, contractName };
}

/**
 * End-to-end generator processing ABI file/directory -> Ingestion -> IR -> AST -> Formatted TS Files
 */
export async function generateHooksFromFile(
  options: GenerateOptions,
): Promise<GenerateResult> {
  const absoluteAbiPath = path.resolve(process.cwd(), options.abiPath);

  if (!fs.existsSync(absoluteAbiPath)) {
    throw new Error(`ABI path not found: ${absoluteAbiPath}`);
  }

  const stat = fs.statSync(absoluteAbiPath);

  if (stat.isDirectory()) {
    const targetDir = options.outputPath
      ? path.resolve(process.cwd(), options.outputPath)
      : path.resolve(process.cwd(), "generated");

    const entries = fs.readdirSync(absoluteAbiPath);
    const jsonFiles = entries.filter((file) => file.endsWith(".json"));

    if (jsonFiles.length === 0) {
      throw new Error(
        `No .json ABI files found in directory: ${absoluteAbiPath}`,
      );
    }

    const generatedModules: string[] = [];
    const generatedFiles: string[] = [];

    for (const jsonFile of jsonFiles) {
      const fullInputPath = path.join(absoluteAbiPath, jsonFile);
      const contractName = deriveContractName(jsonFile);
      const outputFilePath = path.join(targetDir, `${contractName}.ts`);

      await processSingleAbiFile(fullInputPath, outputFilePath);
      generatedModules.push(contractName);
      generatedFiles.push(outputFilePath);
    }

    // Generate top-level index.ts re-exporting all modules
    const indexAst = generateIndexFileAst(generatedModules);
    const rawIndexCode = generate(indexAst).code;
    const formattedIndexCode = await formatTypeScriptCode(rawIndexCode);
    const indexPath = path.join(targetDir, "index.ts");

    fs.writeFileSync(indexPath, formattedIndexCode, "utf-8");
    generatedFiles.push(indexPath);

    return {
      outputPath: targetDir,
      code: formattedIndexCode,
      generatedFiles,
    };
  }

  // Single file execution path
  const targetDir = options.outputPath
    ? path.resolve(process.cwd(), options.outputPath)
    : path.resolve(process.cwd(), "generated");

  const contractName = deriveContractName(
    options.abiPath,
    options.contractName,
  );
  const finalOutputPath = targetDir.endsWith(".ts")
    ? targetDir
    : path.join(targetDir, `${contractName}.ts`);

  const { code } = await processSingleAbiFile(
    absoluteAbiPath,
    finalOutputPath,
    options.contractName,
  );

  return {
    outputPath: finalOutputPath,
    code,
  };
}

export interface ConfigContract {
  name?: string;
  abi: string;
}

export interface ConfigObject {
  output?: string;
  contracts: ConfigContract[];
}

/**
 * Loads and parses an abi-to-hooks.config.json file if present or specified.
 */
export function loadConfigFile(
  customPath?: string,
): { config: ConfigObject; configPath: string } | undefined {
  const targetPath = customPath
    ? path.resolve(process.cwd(), customPath)
    : path.resolve(process.cwd(), "abi-to-hooks.config.json");

  if (!fs.existsSync(targetPath)) {
    if (customPath) {
      throw new Error(`Config file not found at path: ${targetPath}`);
    }
    return undefined;
  }

  try {
    const rawContent = fs.readFileSync(targetPath, "utf-8");
    const json = JSON.parse(rawContent);

    if (!json || typeof json !== "object" || !Array.isArray(json.contracts)) {
      throw new Error(
        "Invalid config format: Expected object containing a 'contracts' array.",
      );
    }

    return { config: json as ConfigObject, configPath: targetPath };
  } catch (err) {
    throw new Error(
      `Failed to parse config file at ${targetPath}: ${(err as Error).message}`,
    );
  }
}

/**
 * Executes batch generation for all contracts specified in a ConfigObject.
 */
export async function generateHooksFromConfig(
  config: ConfigObject,
  configDir: string = process.cwd(),
): Promise<GenerateResult> {
  const targetDir = config.output
    ? path.resolve(configDir, config.output)
    : path.resolve(configDir, "generated");

  const generatedModules: string[] = [];
  const generatedFiles: string[] = [];

  for (const contract of config.contracts) {
    const fullAbiPath = path.resolve(configDir, contract.abi);
    const contractName = deriveContractName(fullAbiPath, contract.name);
    const outputFilePath = path.join(targetDir, `${contractName}.ts`);

    await processSingleAbiFile(fullAbiPath, outputFilePath, contract.name);

    generatedModules.push(contractName);
    generatedFiles.push(outputFilePath);
  }

  const indexAst = generateIndexFileAst(generatedModules);
  const rawIndexCode = generate(indexAst).code;
  const formattedIndexCode = await formatTypeScriptCode(rawIndexCode);
  const indexPath = path.join(targetDir, "index.ts");

  fs.writeFileSync(indexPath, formattedIndexCode, "utf-8");
  generatedFiles.push(indexPath);

  return {
    outputPath: targetDir,
    code: formattedIndexCode,
    generatedFiles,
  };
}
