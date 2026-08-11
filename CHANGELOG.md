# @ezihegodswill/abi-to-hooks

## 0.2.0

### Minor Changes

- 854b05f: - **Simulate Hooks Generation**: Added synthesis for `useSimulateContract` custom hooks for all `nonpayable` and `payable` write methods alongside `useWriteContract`.
  - **Prettier Dependency Elimination**: Removed `prettier` dependency to achieve an ultra-lean CLI footprint, formatting code output directly via `@babel/generator`.
  - **Batch Generation**: Support batch directory processing and dynamic CLI package version output (`--version`).
  - **Event Hooks Generation**: Synthesizes `useWatchContractEvent` custom hooks for smart contract events.
