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

/**
 * Runs an interactive terminal prompt wizard using the prompts package.
 */
export async function runInteractiveWizard(
  initialAbiPath?: string,
): Promise<GenerateOptions> {
  const prompts = (await import("prompts")).default;

  const response = await prompts(
    [
      {
        type: initialAbiPath ? null : "text",
        name: "abiPath",
        message: "Enter path to JSON ABI file or directory of ABIs:",
        validate: (val: string) =>
          val && val.trim().length > 0
            ? true
            : "ABI file or directory path is required",
      },
      {
        type: "text",
        name: "outputPath",
        message: "Enter target output path (defaults to ./generated):",
        initial: "./generated",
      },
      {
        type: (_prev: unknown, values: { abiPath?: string }) => {
          const targetPath = initialAbiPath || values.abiPath;
          if (targetPath) {
            try {
              const fullPath = path.resolve(process.cwd(), targetPath);
              if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                return "text";
              }
            } catch {
              // fallback
            }
          }
          return null;
        },
        name: "contractName",
        message: "Enter custom contract display name (optional):",
      },
    ],
    {
      onCancel: () => {
        console.log("\n\x1b[33mInteractive prompt cancelled.\x1b[0m\n");
        process.exit(0);
      },
    },
  );

  const finalAbiPath = initialAbiPath || response.abiPath;
  if (!finalAbiPath) {
    throw new Error("ABI path is required to generate contract hooks.");
  }

  return {
    abiPath: finalAbiPath,
    outputPath: response.outputPath || "./generated",
    contractName: response.contractName,
  };
}
