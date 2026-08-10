import { describe, expect, test } from "bun:test";
import { ABIParseError, parseABI } from "./index";

describe("Phase 1: Ingestion & Typing (Anti-Corruption Layer)", () => {
  test("should parse a raw ABI array containing standard functions and events", () => {
    const rawAbi = [
      {
        type: "function",
        name: "balanceOf",
        inputs: [{ name: "owner", type: "address" }],
        outputs: [{ name: "balance", type: "uint256" }],
        stateMutability: "view",
      },
      {
        type: "event",
        name: "Transfer",
        inputs: [
          { name: "from", type: "address", indexed: true },
          { name: "to", type: "address", indexed: true },
          { name: "value", type: "uint256", indexed: false },
        ],
      },
    ];

    const parsed = parseABI(rawAbi);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.type).toBe("function");
    expect(parsed[1]?.type).toBe("event");
  });

  test("should unwrap Hardhat/Foundry artifact envelopes `{ abi: [...] }`", () => {
    const artifact = {
      contractName: "ERC20",
      bytecode: "0x6080604052...",
      abi: [
        {
          type: "function",
          name: "totalSupply",
          inputs: [],
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
        },
      ],
    };

    const parsed = parseABI(artifact);
    expect(parsed).toHaveLength(1);
    const item = parsed[0];
    expect(item?.type).toBe("function");
    if (item && item.type === "function") {
      expect(item.name).toBe("totalSupply");
    }
  });

  test("should strip unknown dynamic metadata properties from ABI items", () => {
    const rawAbi = [
      {
        type: "function",
        name: "mint",
        inputs: [{ name: "amount", type: "uint256" }],
        outputs: [],
        stateMutability: "nonpayable",
        // Unknown extra metadata from solc
        devdoc: "Mints new tokens",
        gasEstimated: 50000,
      },
    ];

    const parsed = parseABI(rawAbi);
    expect(parsed[0]).not.toHaveProperty("devdoc");
    expect(parsed[0]).not.toHaveProperty("gasEstimated");
  });

  test("should recursively parse nested struct tuples using z.lazy()", () => {
    const rawAbi = [
      {
        type: "function",
        name: "setProfile",
        inputs: [
          {
            name: "user",
            type: "tuple",
            components: [
              { name: "id", type: "uint256" },
              {
                name: "details",
                type: "tuple",
                components: [
                  { name: "email", type: "string" },
                  { name: "active", type: "bool" },
                ],
              },
            ],
          },
        ],
        outputs: [],
        stateMutability: "nonpayable",
      },
    ];

    const parsed = parseABI(rawAbi);
    const fn = parsed[0];
    expect(fn?.type).toBe("function");
    if (fn && fn.type === "function") {
      const tupleArg = fn.inputs[0];
      expect(tupleArg?.type).toBe("tuple");
      expect(tupleArg?.components).toHaveLength(2);
      expect(tupleArg?.components?.[1]?.components).toHaveLength(2);
    }
  });

  test("should throw ABIParseError on invalid payload structures", () => {
    expect(() => parseABI("invalid_string")).toThrow(ABIParseError);
    expect(() => parseABI([{ type: "function", name: "" }])).toThrow(
      ABIParseError,
    );
  });
});
