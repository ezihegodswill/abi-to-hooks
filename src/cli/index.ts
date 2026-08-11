#!/usr/bin/env node

import { Command } from "commander";
import packageJson from "../../package.json";
import { ABIParseError } from "../core/ingestion";
import { generateHooksFromFile } from "./generator";

const program = new Command();

program
  .name("abi-to-hooks")
  .description(
    "CLI code generator converting Smart Contract ABIs into strictly-typed wagmi React hooks",
  )
  .version(packageJson.version)
  .argument(
    "<abi-path>",
    "Path to JSON ABI file, artifact payload, or directory of ABIs",
  )
  .option(
    "-o, --output <path>",
    "Output directory or target file path (defaults to ./generated)",
  )
  .option(
    "-n, --name <contractName>",
    "Custom contract display name (for single file generation)",
  )
  .option(
    "-f, --force",
    "Force hook regeneration bypassing SHA-256 content-hash cache",
  )
  .action(
    async (
      abiPath: string,
      options: { output?: string; name?: string; force?: boolean },
    ) => {
      try {
        console.log(
          `\n\x1b[36m[abi-to-hooks]\x1b[0m Ingesting ABI from ${abiPath}...`,
        );

        const result = await generateHooksFromFile({
          abiPath,
          outputPath: options.output,
          contractName: options.name,
          force: options.force,
        });

        if (result.skipped) {
          console.log(
            `\x1b[33m⚡\x1b[0m Content hash unchanged. Skipped generation for: \x1b[1m${result.outputPath}\x1b[0m`,
          );
        } else {
          console.log(
            `\x1b[32m✔\x1b[0m Successfully generated React hooks at: \x1b[1m${result.outputPath}\x1b[0m`,
          );
        }
        if (result.generatedFiles && result.generatedFiles.length > 0) {
          console.log(
            `\x1b[32m✔\x1b[0m Generated ${result.generatedFiles.length} files in batch mode.`,
          );
        }
        console.log("\n\x1b[32mDone!\x1b[0m\n");
      } catch (err) {
        if (err instanceof ABIParseError) {
          console.error(
            `\n\x1b[31m✖ ABI Validation Error:\x1b[0m ${err.message}\n`,
          );
        } else {
          console.error(
            `\n\x1b[31m✖ Generation Failed:\x1b[0m ${(err as Error).message}\n`,
          );
        }
        process.exit(1);
      }
    },
  );

program.parse(process.argv);
