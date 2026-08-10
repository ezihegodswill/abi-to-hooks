import type { StateMutability } from "../ingestion/types";

/**
 * Normalized parameter in the Intermediate Representation
 */
export interface IRParameter {
  originalName: string;
  safeName: string;
  evmType: string;
  tsType: string;
  components?: IRParameter[];
  indexed?: boolean;
}

/**
 * Normalized function in the Intermediate Representation
 */
export interface IRFunction {
  originalName: string;
  safeName: string;
  inputs: IRParameter[];
  outputs: IRParameter[];
  stateMutability: StateMutability;
  isRead: boolean;
  isWrite: boolean;
}

/**
 * Normalized event in the Intermediate Representation
 */
export interface IREvent {
  originalName: string;
  safeName: string;
  inputs: IRParameter[];
  anonymous: boolean;
}

/**
 * Normalized custom error in the Intermediate Representation
 */
export interface IRError {
  originalName: string;
  safeName: string;
  inputs: IRParameter[];
}

/**
 * Complete Intermediate Representation of a Smart Contract
 */
export interface IRContract {
  name: string;
  readFunctions: IRFunction[];
  writeFunctions: IRFunction[];
  events: IREvent[];
  errors: IRError[];
}
