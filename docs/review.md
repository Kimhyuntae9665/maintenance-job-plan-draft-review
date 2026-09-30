# Independent scaffold engineering review

A separate read-only reviewer reproduced two defects with 27 original regressions passing: decoding split request buffers independently corrupted Korean text, and an optional row revision could bypass the conflict rule while the proposal/export bound only the declared source revision.

The request handler now accumulates bounded bytes and performs one fatal UTF-8 decode. This scaffold consistently uses one declared source revision and rejects differing row revision overrides as ambiguous input. Two meaningful regressions were added. The reviewer reran 29/29 tests, checked both split positions within a three-byte character, confirmed invalid UTF-8 rejection and JSON/TSV revision-override rejection, and found no remaining blocker in the focused repairs.

Browser checks separately reproduced and repaired mobile grid overflow, long receipt-hash overflow and malformed SVG connectors. The final actual Chrome checks preserve a 390px document width, scrollable source grid, text at least 14px, keyboard source navigation, repeated immutable receipts, stale two-client rejection, historical review retention, conflicting row rejection and a local-only export acknowledgment. Failed development observations remain recorded.

These are engineering checks on four root-authored scaffold examples, not the independent oracle packet or a measure of extraction accuracy. No oracle data, denied P06 data or GPU/model API was accessed. Domain correctness and the experiment contract remain pending.
