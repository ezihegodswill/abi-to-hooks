#!/usr/bin/env node

import { Command } from 'commander';
import { ABIParseError } from '../core/ingestion';
import { generateHooksFromFile } from './generator';

const program = new Command();

program
  .name('abi-to-hooks')
  .description(
    'Enterprise CLI code generator converting Smart Contract ABIs into strictly-typed wagmi React hooks',
  )
  .version('0.1.0')
  .argument('<abi-path>', 'Path to JSON ABI file or artifact payload')
  .option('-o, --output <path>', 'Output directory or target file path (defaults to ./generated)')
  .option('-n, --name <contractName>', 'Custom contract display name')
  .option('--no-config', 'Disable auto-generating wagmi config.ts stub')
  .action(
    async (abiPath: string, options: { output?: string; name?: string; config?: boolean }) => {
      try {
        console.log(`\n\x1b[36m[abi-to-hooks]\x1b[0m Ingesting ABI from ${abiPath}...`);

        const result = await generateHooksFromFile({
          abiPath,
          outputPath: options.output,
          contractName: options.name,
          generateConfigStub: options.config,
        });

        console.log(
          `\x1b[32m✔\x1b[0m Successfully generated React hooks at: \x1b[1m${result.outputPath}\x1b[0m`,
        );
        if (result.configPath) {
          console.log(
            `\x1b[32m✔\x1b[0m Generated Wagmi config stub at: \x1b[1m${result.configPath}\x1b[0m`,
          );
        }
        console.log('\n\x1b[32mDone!\x1b[0m\n');
      } catch (err) {
        if (err instanceof ABIParseError) {
          console.error(`\n\x1b[31m✖ ABI Validation Error:\x1b[0m ${err.message}\n`);
        } else {
          console.error(`\n\x1b[31m✖ Generation Failed:\x1b[0m ${(err as Error).message}\n`);
        }
        process.exit(1);
      }
    },
  );

program.parse(process.argv);
