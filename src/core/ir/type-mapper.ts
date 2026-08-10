import type { ABIParameter } from "../ingestion/types";
import { sanitizeParamName } from "./sanitizer";

/**
 * Maps a validated EVM parameter (including recursive struct tuples) into a target TypeScript type string representation.
 *
 * Examples:
 * - address -> "`0x${string}`"
 * - uint256 -> "bigint"
 * - uint32 -> "number"
 * - bool -> "boolean"
 * - tuple -> "{ owner: `0x${string}`; value: bigint }"
 * - address[] -> "`0x${string}`[]"
 */
export function mapEVMToTSType(param: ABIParameter): string {
  const evmType = param.type.trim();

  // Handle dynamic array types (e.g., address[], tuple[], uint256[][])
  if (evmType.endsWith("[]")) {
    const baseType = evmType.slice(0, -2);
    const baseParam: ABIParameter = { ...param, type: baseType };
    const baseTSType = mapEVMToTSType(baseParam);
    // If base type is an inline object (tuple), wrap in parentheses before appending []
    return baseTSType.startsWith("{")
      ? `Array<${baseTSType}>`
      : `${baseTSType}[]`;
  }

  // Handle fixed-size array types (e.g., uint256[5], address[2])
  const fixedArrayMatch = evmType.match(/^(.+)\[(\d+)\]$/);
  if (fixedArrayMatch) {
    const baseType = fixedArrayMatch[1];
    const length = Number.parseInt(fixedArrayMatch[2] ?? "0", 10);
    if (baseType && length > 0) {
      const baseParam: ABIParameter = { ...param, type: baseType };
      const baseTSType = mapEVMToTSType(baseParam);
      return `readonly [${Array(length).fill(baseTSType).join(", ")}]`;
    }
  }

  // Handle recursive struct tuple types
  if (evmType === "tuple" || evmType.startsWith("tuple")) {
    if (!param.components || param.components.length === 0) {
      return "Record<string, unknown>";
    }
    const fields = param.components.map((comp, idx) => {
      const safeName = sanitizeParamName(comp.name, idx);
      const tsType = mapEVMToTSType(comp);
      return `${safeName}: ${tsType}`;
    });
    return `{ ${fields.join("; ")} }`;
  }

  // Handle EVM primitives
  if (evmType === "address") {
    return "`0x${string}`";
  }

  if (evmType === "bool") {
    return "boolean";
  }

  if (evmType === "string") {
    return "string";
  }

  if (evmType === "bytes" || /^bytes\d+$/.test(evmType)) {
    return "`0x${string}`";
  }

  // Integer types: uint8..uint48 mapped to number, uint56..uint256 mapped to bigint
  const uintMatch = evmType.match(/^uint(\d+)$/);
  if (uintMatch) {
    const bits = Number.parseInt(uintMatch[1] ?? "256", 10);
    return bits <= 48 ? "number" : "bigint";
  }

  const intMatch = evmType.match(/^int(\d+)$/);
  if (intMatch) {
    const bits = Number.parseInt(intMatch[1] ?? "256", 10);
    return bits <= 48 ? "number" : "bigint";
  }

  // Default fallback for unrecognized EVM types
  return "unknown";
}
