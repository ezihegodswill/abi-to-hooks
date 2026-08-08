import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { deriveContractName, ensureWagmiConfigStub, generateHooksFromFile } from './generator';

describe('Phase 4: CLI Generator Pipeline Integration', () => {
  const testDir = path.resolve(__dirname, '../../tmp_test_cli');
  const sampleAbiPath = path.join(testDir, 'ERC20Sample.json');

  const sampleAbiContent = JSON.stringify([
    {
      type: 'function',
      name: 'name',
      inputs: [],
      outputs: [{ name: '', type: 'string' }],
      stateMutability: 'view',
    },
    {
      type: 'function',
      name: 'approve',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'nonpayable',
    },
  ]);

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(sampleAbiPath, sampleAbiContent, 'utf-8');
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should derive clean contract name from file path', () => {
    expect(deriveContractName('./contracts/ERC20.json')).toBe('ERC20');
    expect(deriveContractName('./contracts/my-token.json')).toBe('mytoken');
    expect(deriveContractName('./contracts/Token.json', 'CustomToken')).toBe('CustomToken');
  });

  test('should create wagmi config.ts stub if missing', () => {
    const configDir = path.join(testDir, 'config_test');
    const createdPath = ensureWagmiConfigStub(configDir);

    expect(createdPath).toBeDefined();
    if (createdPath) {
      expect(fs.existsSync(createdPath)).toBe(true);
      const content = fs.readFileSync(createdPath, 'utf-8');
      expect(content).toContain('createConfig');
      expect(content).toContain('mainnet');
    }
  });

  test('should execute full end-to-end hook generation from ABI file', async () => {
    const outputDir = path.join(testDir, 'output');
    const result = await generateHooksFromFile({
      abiPath: sampleAbiPath,
      outputPath: outputDir,
      contractName: 'ERC20Sample',
    });

    expect(fs.existsSync(result.outputPath)).toBe(true);
    expect(result.code).toContain('useReadContract');
    expect(result.code).toContain('useWriteContract');
    expect(result.code).toContain('export const erc20sampleAbi = [');
    expect(result.code).toContain('export function useReadERC20SampleName');
    expect(result.code).toContain('export function useWriteERC20SampleApprove');
  });
});
