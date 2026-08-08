# @ezihegodswill/abi-to-hooks

> AST-based CLI code generator converting EVM Smart Contract ABIs into strictly-typed `wagmi` / `viem` React hooks.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.2-black.svg)](https://bun.sh/)
[![Biome](https://img.shields.io/badge/Formatter-Biome-green.svg)](https://biomejs.dev/)

---

## 🌟 Overview

`@ezihegodswill/abi-to-hooks` is a production-grade compiler CLI that ingests raw EVM Application Binary Interfaces (ABIs) from Hardhat, Foundry, Solc, or Etherscan and generates strictly-typed, formatted React custom hooks powered by `@babel/template` AST synthesis.

Unlike traditional string-concatenation generators, `@ezihegodswill/abi-to-hooks` guarantees **100% syntactically valid TypeScript** output by constructing AST nodes in memory and serializing them via Babel and Prettier.

---

## 🚀 Quick Start

Run instantly without installation using `npx`:

```bash
npx @ezihegodswill/abi-to-hooks ./abis/ERC20.json
```

Or install globally:

```bash
npm install -g @ezihegodswill/abi-to-hooks

# Generate hooks for any smart contract ABI
abi-to-hooks ./abis/ERC20.json -o ./src/hooks -n ERC20
```

---

## ⚙️ CLI Options & Flags

| Flag          | Full Name         | Description                                               | Default       |
| :------------ | :---------------- | :-------------------------------------------------------- | :------------ |
| `<abi-path>`  | Positional        | Path to raw ABI JSON file or framework artifact (`.json`) | _Required_    |
| `-o`          | `--output <path>` | Target output directory or file path                      | `./generated` |
| `-n`          | `--name <name>`   | Custom smart contract display name                        | Filename      |
| `--no-config` | `--no-config`     | Disable auto-generating `config.ts` wagmi client stub     | `false`       |
| `-h`          | `--help`          | Display CLI usage guide                                   | —             |

---

## 🏗️ Architecture & Compiler Pipeline

The generator operates as a multi-pass compiler pipeline:

```
  Raw Input ABI (Hardhat / Foundry / Etherscan)
                       │
                       ▼ Phase 1: Ingestion ACL
 ┌──────────────────────────────────────────────────────────┐
 │ Anti-Corruption Layer (Zod Discriminated Unions + lazy)  │  Strips unknown bloat, unwraps payload envelopes
 └─────────────────────┬────────────────────────────────────┘
                       │
                       ▼ Phase 2: Intermediate Representation
 ┌──────────────────────────────────────────────────────────┐
 │ IR Transformation (Symbol Table Overload Engine)         │  Maps EVM primitives, resolves overloads & keywords
 └─────────────────────┬────────────────────────────────────┘
                       │
                       ▼ Phase 3: AST Generation
 ┌──────────────────────────────────────────────────────────┐
 │ AST Engine (@babel/template + @babel/types)              │  Synthesizes AST React Hook Program nodes
 └─────────────────────┬────────────────────────────────────┘
                       │
                       ▼ Phase 4: CLI & Formatting
 ┌──────────────────────────────────────────────────────────┐
 │ CLI Entry (Commander + Prettier + Atomic Write)          │  Prints & formats output to ./generated/ERC20.ts
 └──────────────────────────────────────────────────────────┘
```

---

## 💡 Key Systems Features

1. **Anti-Corruption Layer (ACL):** Uses Zod discriminated unions ($O(1)$ lookup time) and `z.lazy()` to safely parse untrusted JSON inputs and arbitrary-depth Solidity struct tuples.
2. **Overload Resolution Algorithm:** Detects overloaded Solidity methods (`transfer(address,uint256)` vs `transfer(address,uint256,bytes)`) and derives unique, safe hook identifiers (`useWriteTransferAddressUint256`).
3. **Lexical Keyword Escaping:** Sanitizes parameter names conflicting with TypeScript reserved words (`class`, `type`, `function`, `default`) by prepending an underscore (`_type`).
4. **Precision Type Safety:** Maps 256-bit Solidity integers (`uint256`, `int256`) to `bigint` and hex byte arrays to `` `0x${string}` ``.

---

## 🛠️ Local Development & Quality Gates

This repository uses **Bun** as runtime and **Biome** for static analysis.

```bash
# Install dependencies
bun install

# Run type check (tsc)
bun run typecheck

# Run static analysis (Biome)
bun run lint

# Run unit & integration test suite
bun test

# Build executable binary output
bun run build
```

---

## 📜 License

[MIT](LICENSE) © Godswill Ezihe
