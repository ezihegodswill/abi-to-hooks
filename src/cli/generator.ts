import crypto from "node:crypto";
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
  force?: boolean;
}

export interface GenerateResult {
  outputPath: string;
  code: string;
  generatedFiles?: string[];
  skipped?: boolean;
}

interface CacheStore {
  [contractName: string]: string;
}

function getCacheFilePath(outputDir: string): string {
  return path.join(outputDir, ".cache", "abi-to-hooks.json");
}

function loadCacheStore(cacheFilePath: string): CacheStore {
  try {
    if (fs.existsSync(cacheFilePath)) {
      return JSON.parse(fs.readFileSync(cacheFilePath, "utf-8"));
    }
  } catch {
    // fallback if unreadable
  }
  return {};
}

function saveCacheStore(cacheFilePath: string, store: CacheStore): void {
  try {
    const dir = path.dirname(cacheFilePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cacheFilePath, JSON.stringify(store, null, 2), "utf-8");
  } catch {
    // fallback if unwritable
  }
}

function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
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
 * Helper to process a single JSON ABI file -> AST -> Formatted TS File with caching
 */
async function processSingleAbiFile(
  filePath: string,
  outputFilePath: string,
  customContractName?: string,
  cacheStore?: CacheStore,
  force?: boolean,
): Promise<{ code: string; contractName: string; skipped: boolean }> {
  let fileContent: string;
  try {
    fileContent = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read ABI file at ${filePath}: ${(err as Error).message}`,
    );
  }

  const contractName = deriveContractName(filePath, customContractName);
  const fileHash = computeHash(fileContent);

  if (
    !force &&
    cacheStore &&
    cacheStore[contractName] === fileHash &&
    fs.existsSync(outputFilePath)
  ) {
    const existingCode = fs.readFileSync(outputFilePath, "utf-8");
    return { code: existingCode, contractName, skipped: true };
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
  const ir = buildIR(parsedAbi, contractName);
  const astFile = generateContractFileAst(ir, parsedAbi);
  const rawCode = generate(astFile).code;
  const formattedCode = await formatTypeScriptCode(rawCode);

  const outputDir = path.dirname(outputFilePath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFilePath, formattedCode, "utf-8");

  if (cacheStore) {
    cacheStore[contractName] = fileHash;
  }

  return { code: formattedCode, contractName, skipped: false };
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

    const cacheFilePath = getCacheFilePath(targetDir);
    const cacheStore = loadCacheStore(cacheFilePath);

    const entries = fs.readdirSync(absoluteAbiPath);
    const jsonFiles = entries.filter((file) => file.endsWith(".json"));

    if (jsonFiles.length === 0) {
      throw new Error(
        `No .json ABI files found in directory: ${absoluteAbiPath}`,
      );
    }

    const generatedModules: string[] = [];
    const generatedFiles: string[] = [];
    let allSkipped = true;

    for (const jsonFile of jsonFiles) {
      const fullInputPath = path.join(absoluteAbiPath, jsonFile);
      const contractName = deriveContractName(jsonFile);
      const outputFilePath = path.join(targetDir, `${contractName}.ts`);

      const res = await processSingleAbiFile(
        fullInputPath,
        outputFilePath,
        undefined,
        cacheStore,
        options.force,
      );
      if (!res.skipped) {
        allSkipped = false;
      }
      generatedModules.push(contractName);
      generatedFiles.push(outputFilePath);
    }

    const indexPath = path.join(targetDir, "index.ts");
    let formattedIndexCode = "";

    if (!allSkipped || !fs.existsSync(indexPath) || options.force) {
      const indexAst = generateIndexFileAst(generatedModules);
      const rawIndexCode = generate(indexAst).code;
      formattedIndexCode = await formatTypeScriptCode(rawIndexCode);
      fs.writeFileSync(indexPath, formattedIndexCode, "utf-8");
    } else {
      formattedIndexCode = fs.readFileSync(indexPath, "utf-8");
    }

    generatedFiles.push(indexPath);
    saveCacheStore(cacheFilePath, cacheStore);

    return {
      outputPath: targetDir,
      code: formattedIndexCode,
      generatedFiles,
      skipped: allSkipped,
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

  const outputDir = path.dirname(finalOutputPath);
  const cacheFilePath = getCacheFilePath(outputDir);
  const cacheStore = loadCacheStore(cacheFilePath);

  const res = await processSingleAbiFile(
    absoluteAbiPath,
    finalOutputPath,
    options.contractName,
    cacheStore,
    options.force,
  );

  saveCacheStore(cacheFilePath, cacheStore);

  return {
    outputPath: finalOutputPath,
    code: res.code,
    skipped: res.skipped,
  };
}
