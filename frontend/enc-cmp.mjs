const m = await import("genlayer-js");
const cd = m.abi.calldata, tx = m.abi.transactions;
const args = ["Ship a Farcaster frame that renders live docket status",
  "- Reads status, deadline and escrow for any docket id\n- Reads only the view methods get_docket / list_open_dockets\n- Deployed at a public https URL\n- Include a short README with the deployment instructions",
  5000, 1791992700n];
const obj = cd.makeCalldataObject("create_docket", args);
const encoded = cd.encode(obj);
console.log("encoded (hex) :", "0x" + Buffer.from(encoded).toString("hex"));
console.log("serialize()   :", tx.serialize([encoded, false]));
console.log("serialize(T)  :", tx.serialize([encoded, true]));
console.log("serializeOne  :", tx.serializeOne ? tx.serializeOne(encoded) : "n/a");
