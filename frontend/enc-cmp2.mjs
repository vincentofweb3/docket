const m = await import("genlayer-js");
const cd = m.abi.calldata, tx = m.abi.transactions;
// exactly what /api/encode receives after JSON.parse
const args = ["Encode route test", "- cite the RFC", 5000, 1792000000];
const enc = cd.encode(cd.makeCalldataObject("create_docket", args));
console.log("encode ->", "0x" + Buffer.from(enc).toString("hex").slice(0, 80));
console.log("serialize([enc,false]) ->", tx.serialize([enc, false]).slice(0, 80));
// vs BigInt deadline as the SDK would receive from JS callers
const args2 = ["Encode route test", "- cite the RFC", 5000, 1792000000n];
const enc2 = cd.encode(cd.makeCalldataObject("create_docket", args2));
console.log("bigint-arg encode differs:", Buffer.from(enc).toString("hex") !== Buffer.from(enc2).toString("hex"));
