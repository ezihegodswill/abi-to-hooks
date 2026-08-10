import { ABIEnvelopeSchema } from "./schema";
import type { SmartContractABI } from "./types";

export * from "./types";
export * from "./schema";

export class ABIParseError extends Error {
  constructor(
    message: string,
    public readonly rawError?: unknown,
  ) {
    super(message);
    this.name = "ABIParseError";
  }
}

/**
 * Ingests, unwraps, and strictly validates an untrusted ABI payload (raw JSON or object).
 *
 * @param input Raw input object or parsed JSON structure
 * @returns Sanitized and typed SmartContractABI
 * @throws ABIParseError on structural validation failure
 */
export function parseABI(input: unknown): SmartContractABI {
  if (!input || (typeof input !== "object" && !Array.isArray(input))) {
    throw new ABIParseError(
      "Invalid ABI payload: Input must be a non-null JSON array or object artifact.",
    );
  }

  const result = ABIEnvelopeSchema.safeParse(input);

  if (!result.success) {
    const formattedError = result.error.issues
      .map((issue) => `[${issue.path.join(".")}]: ${issue.message}`)
      .join("; ");
    throw new ABIParseError(
      `ABI Validation Failed: ${formattedError}`,
      result.error,
    );
  }

  return result.data;
}
