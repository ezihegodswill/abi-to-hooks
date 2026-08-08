import type {
  ABIError,
  ABIEvent,
  ABIFunction,
  ABIParameter,
  SmartContractABI,
} from '../ingestion/types';
import { sanitizeIdentifier, sanitizeParamName, typeToSuffix } from './sanitizer';
import { mapEVMToTSType } from './type-mapper';
import type { IRContract, IRError, IREvent, IRFunction, IRParameter } from './types';

/**
 * Normalizes an array of ABI parameters into IRParameters with mapped TypeScript types and safe names.
 */
export function buildIRParameters(params: ABIParameter[]): IRParameter[] {
  return params.map((param, index) => {
    const safeName = sanitizeParamName(param.name, index);
    const tsType = mapEVMToTSType(param);
    const components = param.components ? buildIRParameters(param.components) : undefined;

    return {
      originalName: param.name,
      safeName,
      evmType: param.type,
      tsType,
      ...(components ? { components } : {}),
      ...(param.indexed !== undefined ? { indexed: param.indexed } : {}),
    };
  });
}

/**
 * Processes functions, performs Symbol Table overload resolution, and builds IRFunction objects.
 */
function processFunctions(functions: ABIFunction[]): IRFunction[] {
  // Step 1: Calculate frequency count of each function name to detect overloads
  const frequencyMap = new Map<string, number>();
  for (const fn of functions) {
    const count = frequencyMap.get(fn.name) ?? 0;
    frequencyMap.set(fn.name, count + 1);
  }

  // Step 2: Build IRFunctions with overload-safe names
  return functions.map((fn) => {
    const isOverloaded = (frequencyMap.get(fn.name) ?? 0) > 1;
    let safeName = sanitizeIdentifier(fn.name);

    if (isOverloaded) {
      const paramSuffixes = fn.inputs.map((input) => typeToSuffix(input.type)).join('');
      safeName = `${safeName}${paramSuffixes || 'Void'}`;
    }

    const inputs = buildIRParameters(fn.inputs);
    const outputs = buildIRParameters(fn.outputs);
    const isRead = fn.stateMutability === 'view' || fn.stateMutability === 'pure';
    const isWrite = fn.stateMutability === 'nonpayable' || fn.stateMutability === 'payable';

    return {
      originalName: fn.name,
      safeName,
      inputs,
      outputs,
      stateMutability: fn.stateMutability,
      isRead,
      isWrite,
    };
  });
}

/**
 * Transforms a validated SmartContractABI into a target-agnostic IRContract structure.
 *
 * @param abi Ingested and validated Smart Contract ABI
 * @param contractName Display name of the smart contract (e.g. "ERC20")
 */
export function buildIR(abi: SmartContractABI, contractName = 'Contract'): IRContract {
  const rawFunctions: ABIFunction[] = [];
  const rawEvents: ABIEvent[] = [];
  const rawErrors: ABIError[] = [];

  for (const item of abi) {
    if (item.type === 'function') {
      rawFunctions.push(item);
    } else if (item.type === 'event') {
      rawEvents.push(item);
    } else if (item.type === 'error') {
      rawErrors.push(item);
    }
  }

  const allFunctions = processFunctions(rawFunctions);
  const readFunctions = allFunctions.filter((fn) => fn.isRead);
  const writeFunctions = allFunctions.filter((fn) => fn.isWrite);

  const events: IREvent[] = rawEvents.map((evt) => ({
    originalName: evt.name,
    safeName: sanitizeIdentifier(evt.name),
    inputs: buildIRParameters(evt.inputs),
    anonymous: Boolean(evt.anonymous),
  }));

  const errors: IRError[] = rawErrors.map((err) => ({
    originalName: err.name,
    safeName: sanitizeIdentifier(err.name),
    inputs: buildIRParameters(err.inputs),
  }));

  return {
    name: sanitizeIdentifier(contractName),
    readFunctions,
    writeFunctions,
    events,
    errors,
  };
}
