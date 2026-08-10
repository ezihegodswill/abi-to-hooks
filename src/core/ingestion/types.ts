/**
 * Standard EVM State Mutability types according to Solidity spec
 */
export type StateMutability = "pure" | "view" | "nonpayable" | "payable";

/**
 * ABI Parameter structure representing function inputs, outputs, and event parameters.
 * Supports recursive tuple structures for Solidity structs.
 */
export interface ABIParameter {
  name: string;
  type: string;
  internalType?: string;
  components?: ABIParameter[];
  indexed?: boolean;
}

/**
 * Validated EVM ABI Function definition
 */
export interface ABIFunction {
  type: "function";
  name: string;
  inputs: ABIParameter[];
  outputs: ABIParameter[];
  stateMutability: StateMutability;
}

/**
 * Validated EVM ABI Event definition
 */
export interface ABIEvent {
  type: "event";
  name: string;
  inputs: ABIParameter[];
  anonymous?: boolean;
}

/**
 * Validated EVM ABI Custom Error definition
 */
export interface ABIError {
  type: "error";
  name: string;
  inputs: ABIParameter[];
}

/**
 * Validated EVM ABI Constructor definition
 */
export interface ABIConstructor {
  type: "constructor";
  inputs: ABIParameter[];
  stateMutability: Extract<StateMutability, "nonpayable" | "payable">;
}

/**
 * Validated EVM Fallback function definition
 */
export interface ABIFallback {
  type: "fallback";
  stateMutability?: Extract<StateMutability, "nonpayable" | "payable">;
}

/**
 * Validated EVM Receive function definition
 */
export interface ABIReceive {
  type: "receive";
  stateMutability: "payable";
}

/**
 * Union of all valid top-level Smart Contract ABI items
 */
export type ABIItem =
  | ABIFunction
  | ABIEvent
  | ABIError
  | ABIConstructor
  | ABIFallback
  | ABIReceive;

/**
 * Fully sanitized and type-checked Smart Contract ABI
 */
export type SmartContractABI = ABIItem[];
