import { describe, expect, test } from 'bun:test';
import type { SmartContractABI } from '../ingestion/types';
import { buildIR, mapEVMToTSType, sanitizeParamName } from './index';

describe('Phase 2: Intermediate Representation (IR)', () => {
  describe('EVM to TS Type Mapper', () => {
    test('should map EVM primitives to TypeScript type strings', () => {
      expect(mapEVMToTSType({ name: 'owner', type: 'address' })).toBe('`0x${string}`');
      expect(mapEVMToTSType({ name: 'val', type: 'uint256' })).toBe('bigint');
      expect(mapEVMToTSType({ name: 'small', type: 'uint32' })).toBe('number');
      expect(mapEVMToTSType({ name: 'flag', type: 'bool' })).toBe('boolean');
      expect(mapEVMToTSType({ name: 'hash', type: 'bytes32' })).toBe('`0x${string}`');
      expect(mapEVMToTSType({ name: 'text', type: 'string' })).toBe('string');
    });

    test('should map dynamic and fixed arrays correctly', () => {
      expect(mapEVMToTSType({ name: 'list', type: 'address[]' })).toBe('`0x${string}`[]');
      expect(mapEVMToTSType({ name: 'fixed', type: 'uint256[3]' })).toBe(
        'readonly [bigint, bigint, bigint]',
      );
    });

    test('should map struct tuples recursively', () => {
      const tupleParam = {
        name: 'user',
        type: 'tuple',
        components: [
          { name: 'wallet', type: 'address' },
          { name: 'balance', type: 'uint256' },
        ],
      };
      expect(mapEVMToTSType(tupleParam)).toBe('{ wallet: `0x${string}`; balance: bigint }');
    });
  });

  describe('Parameter Sanitizer', () => {
    test('should prefix TypeScript reserved words with an underscore', () => {
      expect(sanitizeParamName('type', 0)).toBe('_type');
      expect(sanitizeParamName('class', 1)).toBe('_class');
      expect(sanitizeParamName('function', 2)).toBe('_function');
    });

    test('should generate positional arg names for unnamed parameters', () => {
      expect(sanitizeParamName('', 0)).toBe('arg0');
      expect(sanitizeParamName('  ', 1)).toBe('arg1');
    });
  });

  describe('Symbol Table & Overload Resolution Algorithm', () => {
    test('should correctly separate read and write functions', () => {
      const abi: SmartContractABI = [
        {
          type: 'function',
          name: 'balanceOf',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
        },
        {
          type: 'function',
          name: 'transfer',
          inputs: [
            { name: 'recipient', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
        },
      ];

      const ir = buildIR(abi, 'MyToken');
      expect(ir.name).toBe('MyToken');
      expect(ir.readFunctions).toHaveLength(1);
      expect(ir.writeFunctions).toHaveLength(1);
      expect(ir.readFunctions[0]?.safeName).toBe('balanceOf');
      expect(ir.writeFunctions[0]?.safeName).toBe('transfer');
    });

    test('should resolve function overloading by creating unique safeName suffixes', () => {
      const abi: SmartContractABI = [
        {
          type: 'function',
          name: 'transfer',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
        },
        {
          type: 'function',
          name: 'transfer',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
          ],
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
        },
      ];

      const ir = buildIR(abi, 'OverloadedContract');
      expect(ir.writeFunctions).toHaveLength(2);
      expect(ir.writeFunctions[0]?.safeName).toBe('transferAddressUint256');
      expect(ir.writeFunctions[1]?.safeName).toBe('transferAddressUint256Bytes');
    });
  });
});
