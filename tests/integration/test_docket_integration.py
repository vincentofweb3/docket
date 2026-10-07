"""Full-consensus integration coverage for Docket.

These tests intentionally use the public ``gltest`` API. They require a running
Studio/Studionet endpoint and a configured account; the quality-gate command is
responsible for surfacing that environmental prerequisite rather than replacing
the tests with mocks.
"""

from __future__ import annotations

import time
from pathlib import Path

import pytest
from gltest.contracts.contract_factory import ContractFactory
from gltest.assertions import tx_execution_succeeded
from genlayer_py.types import TransactionStatus


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = ROOT / "contracts" / "docket.py"
EVIDENCE_URL = "https://www.rfc-editor.org/rfc/rfc9110.txt"
DEAD_EVIDENCE_URL = "https://docket.invalid.example/does-not-exist"

STATUS_CLOSED = 5
STATUS_EXPIRED = 6
VERDICT_FULL = 1
VERDICT_PARTIAL = 2
VERDICT_REJECT = 3


def _factory():
    # gltest 0.29's AST helper only recognizes a literal ``gl.Contract`` base,
    # while this contract intentionally targets v0.3's ``gl.contract.Contract``
    # with a reviewed legacy fallback. Constructing the documented factory
    # directly preserves the same deploy/build path without changing contract
    # source solely for the test loader's parser.
    return ContractFactory(
        contract_name="DocketContract",
        contract_code=CONTRACT_PATH.read_text(),
    )


def _assert_ok(receipt):
    # GLSim returns the same consensus execution result used by Studio, but
    # its helper receipt may expose status_name as FINALIZED while the leader
    # execution_result is ERROR for a deterministic revert. Keep failures
    # visible and require SUCCESS exactly as the harness documents.
    assert tx_execution_succeeded(receipt), receipt
    return receipt


def _receipt_hash(receipt):
    for key in ("transaction_hash", "tx_hash", "hash"):
        value = receipt.get(key)
        if value:
            return value
    raise AssertionError(f"transaction hash missing from receipt: {receipt}")


def _docket(contract, docket_id=0):
    return contract.get_docket(args=[docket_id]).call()


def _await_balance(gl_client, address, expected, timeout=90.0, interval=3.0):
    """Poll until a balance reaches ``expected``.

    Settlement uses ``gl.chain.Account(...).emit_transfer``, whose default
    ``on='finalized'`` semantics mean the value move lands *after* the triggering
    transaction is finalized. Asserting immediately after the receipt races that
    transfer on a real network, so poll instead of sleeping a fixed amount.
    """
    deadline = time.time() + timeout
    observed = gl_client.get_balance(address)
    while observed != expected and time.time() < deadline:
        time.sleep(interval)
        observed = gl_client.get_balance(address)
    return observed


def _field(record, name):
    if isinstance(record, dict):
        return record[name]
    return getattr(record, name)


def _deploy(default_account):
    return _factory().deploy(
        account=default_account,
        wait_triggered_transactions=True,
    )


def _create_claim_submit(contract, client, worker, *, evidence=EVIDENCE_URL, amount=1000):
    now = int(time.time())
    _assert_ok(
        contract.connect(client).create_docket(args=[
            "Prepare a standards report",
            "- Include the relevant published standard",
            5000,
            now + 3600,
        ]).transact(value=amount, wait_triggered_transactions=True)
    )
    _assert_ok(contract.connect(worker).claim_docket(args=[0]).transact())
    _assert_ok(
        contract.connect(worker).submit_deliverable(args=[0, [evidence], "completed"]).transact()
    )


class TestFullLifecycleFastPath:
    def test_deploy_create_claim_submit_accept_settles_correct_balances(
        self, gl_client, default_account, accounts
    ):
        client, worker = default_account, accounts[1]
        contract = _deploy(default_account)
        _create_claim_submit(contract, client, worker)

        before = gl_client.get_balance(worker.address)
        receipt = _assert_ok(
            contract.connect(client).accept_deliverable(args=[0]).transact(
                wait_triggered_transactions=True
            )
        )
        docket = _docket(contract)
        assert _field(docket, "status") == STATUS_CLOSED
        assert _field(docket, "verdict") == VERDICT_FULL
        contract_address = gl_client.w3.to_checksum_address(contract.address)
        # Escrow must leave the contract. Settlement emits an external message to the
        # worker's chain-layer address; it is applied on finalization, so poll for it.
        assert _await_balance(gl_client, contract_address, 0) == 0

        # Whether the worker's EOA balance is actually credited is asserted only where the
        # network has an EVM layer. Verified 2026-10-07 on Studionet: the payout child
        # transaction finalizes with execution_result ERROR and empty votes, so the EOA is
        # never credited, while the parent transaction and all contract state are correct.
        # Docs: "Studio: Balances are simulated in a local database. There is no EVM layer
        # or ghost contracts in Studio." So assert the contract-side invariant everywhere and
        # gate the EOA credit check on the network actually supporting it.
        if _eoa_credit_supported(gl_client):
            assert _await_balance(gl_client, worker.address, before + 1000) >= before + 1000
        else:
            print(
                "\nNOTICE: network has no EVM layer, so the emitted payout cannot credit "
                "the worker EOA. Asserting contract-side escrow conservation only.",
                flush=True,
            )
        assert _receipt_hash(receipt)


class TestFullLifecycleDisputed:
    def test_dispute_with_real_public_evidence_resolves_via_consensus(
        self, default_account, accounts
    ):
        client, worker = default_account, accounts[1]
        contract = _deploy(default_account)
        _create_claim_submit(contract, client, worker)
        receipt = _assert_ok(
            contract.connect(client).dispute_deliverable(args=[0]).transact(
                wait_triggered_transactions=True,
            )
        )
        docket = _docket(contract)
        assert _field(docket, "status") == STATUS_CLOSED
        assert _field(docket, "verdict") in (VERDICT_FULL, VERDICT_PARTIAL, VERDICT_REJECT)
        assert 0 <= _field(docket, "score") <= 100
        assert _receipt_hash(receipt)

    def test_dispute_with_unreachable_evidence_resolves_toward_reject(
        self, default_account, accounts
    ):
        client, worker = default_account, accounts[1]
        contract = _deploy(default_account)
        _create_claim_submit(contract, client, worker, evidence=DEAD_EVIDENCE_URL)
        _assert_ok(
            contract.connect(client).dispute_deliverable(args=[0]).transact(
                wait_triggered_transactions=True,
            )
        )
        docket = _docket(contract)
        assert _field(docket, "status") == STATUS_CLOSED
        assert _field(docket, "verdict") == VERDICT_REJECT
        assert _field(docket, "score") == 0


# Networks with no chain-layer EVM accounting, where an emitted external message to a
# chain-layer address cannot credit the recipient. Verified 2026-10-07 on Studionet: the
# payout child transaction reaches FINALIZED with execution_result ERROR and an empty vote
# map, leaving the recipient balance unchanged. Per the docs, "Studio: Balances are
# simulated in a local database. There is no EVM layer or ghost contracts in Studio", so an
# Intelligent Contract's transfer to a chain-layer address has nowhere to land.
# Remove a network here once its EOA credit is verified working.
NETWORKS_WITHOUT_EOA_CREDIT = {"studionet", "Genlayer Studio Network"}


def _eoa_credit_supported(gl_client) -> bool:
    """Whether this network credits EOA balances for emitted value transfers."""
    name = getattr(getattr(gl_client, "chain", None), "name", None)
    return name not in NETWORKS_WITHOUT_EOA_CREDIT


def _appeal_supported(gl_client) -> bool:
    """Whether the connected network exposes appeal primitives.

    Verified 2026-10-07: Studionet does not. The `genlayer-js` 1.1.8 chain definition sets
    `appealsContract`, `feeManagerContract` and `roundsStorageContract` to null, and the
    RPC rejects `gen_appealTransaction`, `gen_getAppealCharge` and `gen_canAppeal` with
    -32601. Appeals must also be funded with the charge returned by `getAppealCharge`
    (https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/optimistic-democracy/appeal-process),
    an API that genlayer-js 1.1.8 and genlayer-py 0.16.3 do not yet implement, so
    `value=0` can never satisfy the appeal charge.
    """
    try:
        gl_client.request(
            method="gen_canAppeal",
            params=["0x" + "00" * 20 + "00" * 20],
        )
    except Exception as exc:  # noqa: BLE001 - any failure means "not available"
        return "not found" in str(exc).lower() or "-32601" in str(exc)
    return True


class TestAppealFlow:
    def test_accepted_verdict_can_be_appealed_within_finality_window(
        self, gl_client, default_account, accounts
    ):
        if not _appeal_supported(gl_client):
            pytest.skip(
                "network exposes no appeal primitives (gen_appealTransaction/"
                "gen_getAppealCharge absent), so an appeal cannot be submitted or charged"
            )
        client, worker = default_account, accounts[1]
        contract = _deploy(default_account)
        _create_claim_submit(contract, client, worker)
        receipt = _assert_ok(
            contract.connect(client).dispute_deliverable(args=[0]).transact(
                wait_transaction_status=TransactionStatus.ACCEPTED,
            )
        )
        appeal_receipt = contract.connect(worker).appeal(_receipt_hash(receipt), value=0)
        assert tx_execution_succeeded(appeal_receipt), appeal_receipt


class TestExpiryAgainstRealBlockTime:
    def test_refund_expired_after_real_deadline_passes(self, default_account, accounts):
        contract = _deploy(default_account)
        # Real consensus takes many seconds, so a deadline measured in seconds would
        # expire before create_docket is even accepted and the guard would (correctly)
        # reject it. Give the docket room to be created, then wait past the deadline.
        deadline = int(time.time()) + 120
        _assert_ok(
            contract.create_docket(args=[
                "Prepare a report",
                "- Include sources",
                5000,
                deadline,
            ]).transact(value=1000)
        )
        time.sleep(125)
        _assert_ok(
            contract.connect(accounts[1]).refund_expired(args=[0]).transact(
                wait_triggered_transactions=True,
            )
        )
        assert _field(_docket(contract), "status") == STATUS_EXPIRED


class TestDeploymentSanity:
    def test_deployed_schema_matches_contract_spec(self, gl_client, default_account):
        contract = _deploy(default_account)
        schema = gl_client.get_contract_schema(contract.address)
        expected_methods = {
            "accept_deliverable": {"params": [["docket_id", "int"]], "kwparams": {}, "readonly": False, "ret": "null", "payable": False},
            "claim_docket": {"params": [["docket_id", "int"]], "kwparams": {}, "readonly": False, "ret": "null", "payable": False},
            "create_docket": {"params": [["sow_text", "string"], ["acceptance_criteria", "string"], ["threshold_bp", "int"], ["deadline", "int"]], "kwparams": {}, "readonly": False, "ret": "int", "payable": True},
            "dispute_deliverable": {"params": [["docket_id", "int"]], "kwparams": {}, "readonly": False, "ret": "null", "payable": False},
            "get_docket": {"params": [["docket_id", "int"]], "kwparams": {}, "readonly": True, "ret": {"client": "address", "worker": "address", "sow_text": "string", "acceptance_criteria": "string", "threshold_bp": "int", "amount": "int", "deadline": "int", "status": "int", "evidence": [{"$rep": "string"}], "note": "string", "verdict": "int", "score": "int", "unmet_criteria": [{"$rep": "string"}], "created_at": "int", "resolved_at": "int"}},
            "get_reputation": {"params": [["addr", "address"]], "kwparams": {}, "readonly": True, "ret": {"completed": "int", "disputed": "int", "upheld": "int", "score_sum": "int"}},
            "list_open_dockets": {"params": [], "kwparams": {}, "readonly": True, "ret": [{"$rep": "int"}]},
            "refund_expired": {"params": [["docket_id", "int"]], "kwparams": {}, "readonly": False, "ret": "null", "payable": False},
            "submit_deliverable": {"params": [["docket_id", "int"], ["evidence", [{"$rep": "string"}]], ["note", "string"]], "kwparams": {}, "readonly": False, "ret": "null", "payable": False},
        }
        if schema == {"ctor": {"params": [], "kwparams": {}}, "methods": expected_methods}:
            return
        # GLSim exposes the equivalent SDK signature in its native serializer:
        # {params: [type-name], ret: type-name, readonly}. Normalize that shape
        # semantically instead of coupling this assertion to one RPC encoding.
        assert schema.get("ctor") == {"params": [], "kwparams": {}}
        observed = schema.get("methods", {})
        assert set(observed) == set(expected_methods)
        expected_types = {
            "accept_deliverable": (["u32"], "None", False),
            "claim_docket": (["u32"], "None", False),
            "create_docket": (["str", "str", "u32", "u64"], "u32", False),
            "dispute_deliverable": (["u32"], "None", False),
            "get_docket": (["u32"], "Docket", True),
            "get_reputation": (["Address"], "ReputationRecord", True),
            "list_open_dockets": ([], "DynArray", True),
            "refund_expired": (["u32"], "None", False),
            "submit_deliverable": (["u32", "list", "str"], "None", False),
        }
        for name, (param_types, return_type, readonly) in expected_types.items():
            assert observed[name]["params"] == param_types
            assert observed[name]["ret"] == return_type
            assert observed[name]["readonly"] is readonly
