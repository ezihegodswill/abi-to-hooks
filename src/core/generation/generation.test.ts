import { describe, expect, test } from 'bun:test';
import generate from '@babel/generator';
import { parseABI } from '../ingestion';
import { buildIR } from '../ir';
import { generateContractFileAst } from './index';

describe('Phase 3: AST Generation', () => {
  test('should generate a complete valid Babel AST for a smart contract', () => {
    const rawAbi = [
      {
        type: 'function',
        name: 'balanceOf',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: 'balance', type: 'uint256' }],
        stateMutability: 'view',
      },
      {
        type: 'function',
        name: 'transfer',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: 'success', type: 'bool' }],
        stateMutability: 'nonpayable',
      },
    ];

    const parsedAbi = parseABI(rawAbi);
    const ir = buildIR(parsedAbi, 'ERC20');
    const astFile = generateContractFileAst(ir, parsedAbi);

    expect(astFile.type).toBe('File');
    expect(astFile.program.body.length).toBeGreaterThanOrEqual(4);

    // Render AST to string to verify AST node output
    const outputCode = generate(astFile).code;

    expect(outputCode).toContain('import { useReadContract, useWriteContract');
    expect(outputCode).toContain('export const erc20Abi = [');
    expect(outputCode).toContain('as const;');
    expect(outputCode).toContain('export function useReadERC20BalanceOf');
    expect(outputCode).toContain('export function useWriteERC20Transfer');
  });
});
