import { z } from "zod";
import type { ABIParameter } from "./types";

/**
 * Recursive Zod schema validating Solidity parameters (including nested tuples).
 * Employs z.lazy() to allow arbitrary depth struct validation.
 */
export const ABIParameterSchema: z.ZodType<ABIParameter> = z.lazy(() =>
  z
    .object({
      name: z.string().default(""),
      type: z.string(),
      internalType: z.string().optional(),
      components: z.array(ABIParameterSchema).optional(),
      indexed: z.boolean().optional(),
    })
    .strip(),
) as z.ZodType<ABIParameter>;

export const StateMutabilitySchema = z.enum([
  "pure",
  "view",
  "nonpayable",
  "payable",
]);

export const ABIFunctionSchema = z
  .object({
    type: z.literal("function"),
    name: z.string().min(1, "Function name cannot be empty"),
    inputs: z.array(ABIParameterSchema).default([]),
    outputs: z.array(ABIParameterSchema).default([]),
    stateMutability: StateMutabilitySchema.default("nonpayable"),
  })
  .strip();

export const ABIEventSchema = z
  .object({
    type: z.literal("event"),
    name: z.string().min(1, "Event name cannot be empty"),
    inputs: z.array(ABIParameterSchema).default([]),
    anonymous: z.boolean().optional(),
  })
  .strip();

export const ABIErrorSchema = z
  .object({
    type: z.literal("error"),
    name: z.string().min(1, "Custom error name cannot be empty"),
    inputs: z.array(ABIParameterSchema).default([]),
  })
  .strip();

export const ABIConstructorSchema = z
  .object({
    type: z.literal("constructor"),
    inputs: z.array(ABIParameterSchema).default([]),
    stateMutability: z.enum(["nonpayable", "payable"]).default("nonpayable"),
  })
  .strip();

export const ABIFallbackSchema = z
  .object({
    type: z.literal("fallback"),
    stateMutability: z.enum(["nonpayable", "payable"]).optional(),
  })
  .strip();

export const ABIReceiveSchema = z
  .object({
    type: z.literal("receive"),
    stateMutability: z.literal("payable"),
  })
  .strip();

/**
 * Discriminated union of ABI items yielding O(1) type branching during parsing.
 */
export const ABIItemSchema = z.discriminatedUnion("type", [
  ABIFunctionSchema,
  ABIEventSchema,
  ABIErrorSchema,
  ABIConstructorSchema,
  ABIFallbackSchema,
  ABIReceiveSchema,
]);

/**
 * Top-level ABI array schema
 */
export const SmartContractABISchema = z.array(ABIItemSchema);

/**
 * Payload envelope schema accommodating artifact outputs from Hardhat, Foundry, and Truffle
 */
export const ABIEnvelopeSchema = z.union([
  SmartContractABISchema,
  z.object({ abi: SmartContractABISchema }).transform((val) => val.abi),
]);
