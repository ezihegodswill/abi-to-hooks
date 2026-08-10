#!/usr/bin/env node

import { Command } from "commander";
import packageJson from "../../package.json";
import { ABIParseError } from "../core/ingestion";
import { generateHooksFromFile, watchAbiPath } from "./generator";

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
    "-w, --watch",
    "Watch input ABI file or directory for changes and regenerate automatically",
  )
  .action(
    async (
      abiPath: string,
      options: { output?: string; name?: string; watch?: boolean },
    ) => {
      try {
        console.log(
          `\n\x1b[36m[abi-to-hooks]\x1b[0m Ingesting ABI from ${abiPath}...`,
        );

        const result = await generateHooksFromFile({
          abiPath,
          outputPath: options.output,
          contractName: options.name,
        });

        console.log(
          `\x1b[32m✔\x1b[0m Successfully generated React hooks at: \x1b[1m${result.outputPath}\x1b[0m`,
        );
        if (result.generatedFiles && result.generatedFiles.length > 0) {
          console.log(
            `\x1b[32m✔\x1b[0m Generated ${result.generatedFiles.length} files in batch mode.`,
          );
        }
        console.log("\n\x1b[32mDone!\x1b[0m\n");

        if (options.watch) {
          console.log(
            `\x1b[33m[watch]\x1b[0m Watching for ABI changes in ${abiPath}... (Press Ctrl+C to exit)\n`,
          );
          watchAbiPath(
            {
              abiPath,
              outputPath: options.output,
              contractName: options.name,
            },
            (res) => {
              console.log(
                `\x1b[32m✔ [watch]\x1b[0m Regenerated hooks at: \x1b[1m${res.outputPath}\x1b[0m`,
              );
            },
          );
        }
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
