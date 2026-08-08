import fs from 'node:fs';
import path from 'node:path';
import generate from '@babel/generator';
import prettier from 'prettier';
import { generateContractFileAst } from '../core/generation';
import { ABIParseError, parseABI } from '../core/ingestion';
import { buildIR } from '../core/ir';

export interface GenerateOptions {
  abiPath: string;
  outputPath?: string;
  contractName?: string;
  generateConfigStub?: boolean;
}

export interface GenerateResult {
  outputPath: string;
  configPath?: string;
  code: string;
}

/**
 * Auto-generates a sample wagmi config stub if one does not exist in the output directory.
 */
export function ensureWagmiConfigStub(outputDir: string): string | undefined {
  const configPath = path.join(outputDir, 'config.ts');
  if (fs.existsSync(configPath)) {
    return undefined;
  }

  const stubCode = `import { http, createConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';

export const config = createConfig({
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});
`;

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(configPath, stubCode, 'utf-8');
  return configPath;
}

/**
 * Derives a clean contract display name from an input file path (e.g. "./abis/ERC20.json" -> "ERC20").
 */
export function deriveContractName(abiPath: string, customName?: string): string {
  if (customName && customName.trim() !== '') {
    return customName.trim();
  }

  const baseName = path.basename(abiPath, path.extname(abiPath));
  return baseName.replace(/[^a-zA-Z0-9_$]/g, '') || 'Contract';
}

/**
 * End-to-end generator function processing ABI file -> Ingestion -> IR -> AST -> Formatted TS File
 */
export async function generateHooksFromFile(options: GenerateOptions): Promise<GenerateResult> {
  const absoluteAbiPath = path.resolve(process.cwd(), options.abiPath);

  if (!fs.existsSync(absoluteAbiPath)) {
    throw new Error(`ABI file not found at path: ${absoluteAbiPath}`);
  }

  // 1. Read input JSON
  let fileContent: string;
  try {
    fileContent = fs.readFileSync(absoluteAbiPath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read ABI file: ${(err as Error).message}`);
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(fileContent);
  } catch (err) {
    throw new ABIParseError(`Invalid JSON file content: ${(err as Error).message}`);
  }

  // 2. Ingestion ACL Pass
  const parsedAbi = parseABI(rawJson);

  // 3. IR Pass
  const contractName = deriveContractName(options.abiPath, options.contractName);
  const ir = buildIR(parsedAbi, contractName);

  // 4. AST Generation Pass
  const astFile = generateContractFileAst(ir, parsedAbi);

  // 5. Code Printing Pass
  const rawCode = generate(astFile).code;

  // 6. Prettier Formatting Pass
  let formattedCode = rawCode;
  try {
    formattedCode = await prettier.format(rawCode, {
      parser: 'typescript',
      singleQuote: true,
      trailingComma: 'es5',
      printWidth: 100,
    });
  } catch (_prettierErr) {
    // Fallback to raw generated code if prettier encounters an error
    formattedCode = rawCode;
  }

  // 7. Calculate Output Directory and File Path
  const targetDir = options.outputPath
    ? path.resolve(process.cwd(), options.outputPath)
    : path.resolve(process.cwd(), 'generated');

  const finalOutputPath = targetDir.endsWith('.ts')
    ? targetDir
    : path.join(targetDir, `${contractName}.ts`);

  const outputDir = path.dirname(finalOutputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  // 8. Write generated hooks file to disk
  fs.writeFileSync(finalOutputPath, formattedCode, 'utf-8');

  // 9. Optionally generate wagmi config stub
  let configPath: string | undefined;
  if (options.generateConfigStub !== false) {
    configPath = ensureWagmiConfigStub(outputDir);
  }

  return {
    outputPath: finalOutputPath,
    configPath,
    code: formattedCode,
  };
}
