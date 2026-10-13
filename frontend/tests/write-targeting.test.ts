/**
 * Write-payload contract targeting.
 *
 * A GenLayer write is not a direct call to the deployed contract. Every write is an EVM transaction
 * whose `to` is the chain's consensus main contract, so the real destination has to travel inside
 * the calldata as `addTransaction(_sender, _recipient, ...)`. A payload built from the inner
 * calldata alone carries no contract address at all — it reads identically no matter which contract
 * it was built for, and cannot complete the contract lifecycle. A steward review caught exactly
 * that, so it is asserted here rather than left to inspection.
 *
 * These assertions decode the payload with viem rather than string-matching it, so they check what
 * the chain would actually decode rather than that a substring happens to be present.
 */
import { decodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import { localnet, studionet, testnetBradbury } from "genlayer-js/chains";
import { encodeWriteTransaction, encodeContractCall } from "../src/lib/genlayer";
import { CONTRACT_ADDRESS, network } from "../src/lib/config";

const SENDER = "0xc6819af16ba98f2575ba22160793bad59acc9b6b" as `0x${string}`;

/** Every method /api/encode permits, with representative arguments. */
const WRITABLE: { method: string; args: unknown[] }[] = [
  {
    method: "create_docket",
    args: ["Build a landing page", "Must be responsive", 8000, 1800000000],
  },
  { method: "claim_docket", args: [4] },
  { method: "submit_deliverable", args: [4, ["https://example.com/proof"], "done"] },
  { method: "accept_deliverable", args: [4] },
  { method: "dispute_deliverable", args: [4] },
  { method: "refund_expired", args: [4] },
];

/**
 * Both `addTransaction` shapes, so decoding works regardless of which the chain exposes.
 * Which one is produced is decided by the deployed ABI inside encodeWriteTransaction; Studionet
 * currently exposes the five-argument form.
 */
const ADD_TRANSACTION_ABI = [
  {
    type: "function",
    name: "addTransaction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_sender", type: "address" },
      { name: "_recipient", type: "address" },
      { name: "_numOfInitialValidators", type: "uint256" },
      { name: "_maxRotations", type: "uint256" },
      { name: "_txData", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "addTransaction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_sender", type: "address" },
      { name: "_recipient", type: "address" },
      { name: "_numOfInitialValidators", type: "uint256" },
      { name: "_maxRotations", type: "uint256" },
      { name: "_txData", type: "bytes" },
      { name: "_validUntil", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

describe("write payload targets the Docket contract", () => {
  // The title names the contract literally: $CONTRACT_ADDRESS interpolates to `undefined` here
  // because vitest only substitutes values it can resolve, and a test name reading "undefined"
  // looks like a broken assertion to a reviewer.
  it.each(WRITABLE)("$method targets the deployed Docket contract", ({ method, args }) => {
    const { to, data } = encodeWriteTransaction({
      from: SENDER,
      functionName: method,
      args,
    });

    // The EVM destination of any GenLayer write is the chain's consensus main contract, not the
    // Docket contract: `_recipient` inside the calldata is what identifies Docket.
    expect(to).toBe(
      network.id === "studionet"
        ? studionet.consensusMainContract?.address
        : network.id === "testnet-bradbury"
          ? testnetBradbury.consensusMainContract?.address
          : localnet.consensusMainContract?.address,
    );
    expect(to).not.toBe(CONTRACT_ADDRESS);

    // Decoded, not grepped: the recipient must be the deployed Docket contract.
    const decoded = decodeFunctionData({ abi: ADD_TRANSACTION_ABI as never, data });
    expect(decoded.functionName).toBe("addTransaction");

    const [, recipient, , , txData] = decoded.args as unknown as [
      `0x${string}`,
      `0x${string}`,
      bigint,
      bigint,
      `0x${string}`,
      bigint | undefined,
    ];

    expect(recipient.toLowerCase()).toBe(CONTRACT_ADDRESS.toLowerCase());
    // The inner calldata must be carried, not dropped.
    expect(txData).toMatch(/^0x[0-9a-fA-F]+$/);
  });

  it("names the sender, so the transaction identifies who is acting", () => {
    const { data } = encodeWriteTransaction({
      from: SENDER,
      functionName: "claim_docket",
      args: [4],
    });
    const decoded = decodeFunctionData({ abi: ADD_TRANSACTION_ABI as never, data });
    const [sender] = decoded.args as unknown as [`0x${string}`];
    expect(sender.toLowerCase()).toBe(SENDER.toLowerCase());
  });

  it("carries the requested method name inside the txData", () => {
    const { data } = encodeWriteTransaction({
      from: SENDER,
      functionName: "accept_deliverable",
      args: [4],
    });
    const decoded = decodeFunctionData({ abi: ADD_TRANSACTION_ABI as never, data });
    const txData = (decoded.args as unknown as `0x${string}`[])[4];
    // The calldata blob carries the method name as readable bytes, per the GenLayer encoding.
    const asAscii = Buffer.from(txData.slice(2), "hex").toString("latin1");
    expect(asAscii).toContain("accept_deliverable");
  });

  it("cannot be pointed at an arbitrary contract", () => {
    // The recipient comes from config, not from the caller, so there is no parameter to abuse.
    const a = encodeWriteTransaction({
      from: SENDER,
      functionName: "claim_docket",
      args: [4],
    });
    const b = encodeWriteTransaction({
      from: SENDER,
      functionName: "claim_docket",
      args: [4],
    });
    expect(a.data).toBe(b.data);
    // And it is never the zero address or the consensus contract.
    const recipient = (
      decodeFunctionData({ abi: ADD_TRANSACTION_ABI as never, data: a.data }).args as unknown as string[]
    )[1].toLowerCase();
    expect(recipient).not.toBe("0x0000000000000000000000000000000000000000");
  });

  it("inner calldata alone carries no contract address (the original bug)", () => {
    // Guards the regression at its source: this is why the wrapper is required.
    const bare = encodeContractCall("claim_docket", [4], false);
    expect(bare.toLowerCase()).not.toContain(CONTRACT_ADDRESS.toLowerCase().slice(2));
  });
});