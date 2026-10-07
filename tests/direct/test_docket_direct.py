"""Direct GenLayer tests using the verified genlayer-test 0.29 harness."""

import json
import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

STATUS_OPEN = 0
STATUS_CLAIMED = 1
STATUS_SUBMITTED = 2
STATUS_CLOSED = 5
STATUS_EXPIRED = 6
VERDICT_FULL = 1
VERDICT_PARTIAL = 2
VERDICT_REJECT = 3

DEADLINE = 1900000000
BASE_TIME = "2030-01-01T00:00:00Z"


def _set_time(vm, iso: str) -> None:
    """Keep the direct harness' legacy raw message timestamp in sync with warp."""
    vm.warp(iso)
    import genlayer.gl as gl
    gl.message_raw["datetime"] = iso


def _new_contract(direct_vm, direct_deploy, owner, value=1000):
    direct_vm.sender = owner
    direct_vm.value = value
    contract = direct_deploy("contracts/docket.py")
    _set_time(direct_vm, BASE_TIME)
    return contract


def _split(amount, verdict, score, threshold):
    import sys
    return sys.modules["_contract_docket"]._split_escrow(amount, verdict, score, threshold)


def _created(direct_vm, direct_deploy, owner, value=1000):
    contract = _new_contract(direct_vm, direct_deploy, owner, value)
    contract.create_docket("Build a report", "- Has citations", 5000, DEADLINE)
    return contract


def _claimed(direct_vm, direct_deploy, owner, worker):
    contract = _created(direct_vm, direct_deploy, owner)
    with direct_vm.prank(worker):
        contract.claim_docket(0)
    return contract


def _submitted(direct_vm, direct_deploy, owner, worker):
    contract = _claimed(direct_vm, direct_deploy, owner, worker)
    with direct_vm.prank(worker):
        contract.submit_deliverable(0, ["https://evidence.example/item"], "done")
    return contract


class TestDocketCreation:
    def test_rejects_zero_value(self, direct_vm, direct_deploy, direct_alice):
        contract = _new_contract(direct_vm, direct_deploy, direct_alice, value=0)
        with direct_vm.expect_revert("EXPECTED_ZERO_VALUE"):
            contract.create_docket("sow", "criteria", 5000, DEADLINE)

    def test_rejects_empty_sow(self, direct_vm, direct_deploy, direct_alice):
        contract = _new_contract(direct_vm, direct_deploy, direct_alice)
        with direct_vm.expect_revert("EXPECTED_EMPTY_SOW"):
            contract.create_docket(" ", "criteria", 5000, DEADLINE)

    def test_rejects_empty_criteria(self, direct_vm, direct_deploy, direct_alice):
        contract = _new_contract(direct_vm, direct_deploy, direct_alice)
        with direct_vm.expect_revert("EXPECTED_EMPTY_CRITERIA"):
            contract.create_docket("sow", " ", 5000, DEADLINE)

    def test_rejects_threshold_over_10000_bp(self, direct_vm, direct_deploy, direct_alice):
        contract = _new_contract(direct_vm, direct_deploy, direct_alice)
        with direct_vm.expect_revert("EXPECTED_INVALID_THRESHOLD"):
            contract.create_docket("sow", "criteria", 10001, DEADLINE)

    def test_rejects_past_or_present_deadline(self, direct_vm, direct_deploy, direct_alice):
        contract = _new_contract(direct_vm, direct_deploy, direct_alice)
        with direct_vm.expect_revert("EXPECTED_PAST_DEADLINE"):
            contract.create_docket("sow", "criteria", 5000, 1893456000)

    def test_happy_path_assigns_sequential_ids_and_open_status(self, direct_vm, direct_deploy, direct_alice):
        contract = _new_contract(direct_vm, direct_deploy, direct_alice)
        assert contract.create_docket("sow", "criteria", 5000, DEADLINE) == 0
        assert contract.create_docket("sow 2", "criteria", 5000, DEADLINE) == 1
        assert contract.get_docket(0).status == STATUS_OPEN
        assert contract.list_open_dockets() == [0, 1]


class TestClaiming:
    def test_rejects_client_claiming_own_docket(self, direct_vm, direct_deploy, direct_alice):
        contract = _created(direct_vm, direct_deploy, direct_alice)
        with direct_vm.expect_revert("EXPECTED_CLIENT_CANNOT_CLAIM"):
            contract.claim_docket(0)

    def test_rejects_claim_on_non_open_docket(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        contract = _claimed(direct_vm, direct_deploy, direct_alice, direct_bob)
        with direct_vm.prank(direct_bob):
            with direct_vm.expect_revert("EXPECTED_WRONG_STATUS"):
                contract.claim_docket(0)

    def test_rejects_claim_after_deadline(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        contract = _created(direct_vm, direct_deploy, direct_alice)
        _set_time(direct_vm, "2031-01-01T00:00:00Z")
        with direct_vm.prank(direct_bob):
            with direct_vm.expect_revert("EXPECTED_PAST_DEADLINE"):
                contract.claim_docket(0)

    def test_happy_path_sets_worker_and_claimed_status(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        contract = _claimed(direct_vm, direct_deploy, direct_alice, direct_bob)
        assert contract.get_docket(0).status == STATUS_CLAIMED


class TestSubmission:
    def test_rejects_empty_evidence(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        contract = _claimed(direct_vm, direct_deploy, direct_alice, direct_bob)
        with direct_vm.prank(direct_bob):
            with direct_vm.expect_revert("EXPECTED_EMPTY_EVIDENCE"):
                contract.submit_deliverable(0, [], "note")

    def test_rejects_non_https_url(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        contract = _claimed(direct_vm, direct_deploy, direct_alice, direct_bob)
        with direct_vm.prank(direct_bob):
            with direct_vm.expect_revert("EXPECTED_INVALID_URL"):
                contract.submit_deliverable(0, ["http://insecure.example"], "note")

    def test_rejects_non_assigned_worker(self, direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
        contract = _claimed(direct_vm, direct_deploy, direct_alice, direct_bob)
        with direct_vm.prank(direct_charlie):
            with direct_vm.expect_revert("EXPECTED_NOT_ASSIGNED_WORKER"):
                contract.submit_deliverable(0, ["https://evidence.example"], "note")

    def test_rejects_submission_after_deadline(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        contract = _claimed(direct_vm, direct_deploy, direct_alice, direct_bob)
        _set_time(direct_vm, "2031-01-01T00:00:00Z")
        with direct_vm.prank(direct_bob):
            with direct_vm.expect_revert("EXPECTED_PAST_DEADLINE"):
                contract.submit_deliverable(0, ["https://evidence.example"], "note")

    def test_happy_path_sets_submitted_status(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        assert _submitted(direct_vm, direct_deploy, direct_alice, direct_bob).get_docket(0).status == STATUS_SUBMITTED


class TestFastPathAcceptance:
    def test_rejects_non_client_caller(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        contract = _submitted(direct_vm, direct_deploy, direct_alice, direct_bob)
        with direct_vm.prank(direct_bob):
            with direct_vm.expect_revert("EXPECTED_NOT_CLIENT"):
                contract.accept_deliverable(0)

    def test_rejects_wrong_status(self, direct_vm, direct_deploy, direct_alice):
        contract = _created(direct_vm, direct_deploy, direct_alice)
        with direct_vm.expect_revert("EXPECTED_WRONG_STATUS"):
            contract.accept_deliverable(0)

    def test_happy_path_closes_and_updates_reputation(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        contract = _submitted(direct_vm, direct_deploy, direct_alice, direct_bob)
        contract.accept_deliverable(0)
        docket = contract.get_docket(0)
        assert docket.status == STATUS_CLOSED
        assert docket.verdict == VERDICT_FULL
        assert docket.score == 100
        assert contract.get_reputation(docket.client).completed == 1
        assert contract.get_reputation(docket.worker).completed == 1


class TestSplitEscrowPureFunction:
    def test_full_verdict_pays_worker_entire_amount(self, direct_vm, direct_deploy, direct_alice):
        _new_contract(direct_vm, direct_deploy, direct_alice)
        assert _split(1000, VERDICT_FULL, 100, 5000) == (1000, 0)

    def test_reject_verdict_refunds_client_entire_amount(self, direct_vm, direct_deploy, direct_alice):
        _new_contract(direct_vm, direct_deploy, direct_alice)
        assert _split(1000, VERDICT_REJECT, 0, 5000) == (0, 1000)

    def test_partial_verdict_above_threshold_pays_proportional_amount(self, direct_vm, direct_deploy, direct_alice):
        _new_contract(direct_vm, direct_deploy, direct_alice)
        assert _split(1000, VERDICT_PARTIAL, 70, 5000) == (700, 300)

    def test_partial_verdict_below_threshold_refunds_entirely(self, direct_vm, direct_deploy, direct_alice):
        _new_contract(direct_vm, direct_deploy, direct_alice)
        assert _split(1000, VERDICT_PARTIAL, 40, 5000) == (0, 1000)

    def test_partial_verdict_exactly_at_threshold_boundary(self, direct_vm, direct_deploy, direct_alice):
        _new_contract(direct_vm, direct_deploy, direct_alice)
        assert _split(1000, VERDICT_PARTIAL, 50, 5000) == (500, 500)


class TestAdjudication:
    def test_structured_result_is_bounded_and_uses_response_body(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        contract = _submitted(direct_vm, direct_deploy, direct_alice, direct_bob)
        direct_vm.mock_web("evidence\\.example", {"method": "GET", "status": 200, "body": "meets criteria"})
        direct_vm.mock_llm("You are adjudicating", json.dumps({
            "verdict": "partial", "score": 60, "unmet_criteria": ["One item"], "rationale": "Short",
        }))
        contract.dispute_deliverable(0)
        docket = contract.get_docket(0)
        assert docket.status == STATUS_CLOSED
        assert docket.verdict == VERDICT_PARTIAL
        assert list(docket.unmet_criteria) == ["One item"]

    def test_unreachable_evidence_resolves_toward_reject(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        contract = _submitted(direct_vm, direct_deploy, direct_alice, direct_bob)
        direct_vm.mock_web("evidence\\.example", {"method": "GET", "status": 404, "body": "missing"})
        contract.dispute_deliverable(0)
        docket = contract.get_docket(0)
        assert docket.status == STATUS_CLOSED
        assert docket.verdict == VERDICT_REJECT
        assert docket.score == 0

    def test_malformed_llm_output_uses_canonical_error(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        contract = _submitted(direct_vm, direct_deploy, direct_alice, direct_bob)
        direct_vm.mock_web("evidence\\.example", {"method": "GET", "status": 200, "body": "content"})
        direct_vm.mock_llm("You are adjudicating", "not json")
        with pytest.raises(Exception, match="LLM_ERROR_MALFORMED_VERDICT"):
            contract.dispute_deliverable(0)


class TestExpiryAndTyping:
    def test_refund_expired_is_permissionless(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        contract = _created(direct_vm, direct_deploy, direct_alice)
        _set_time(direct_vm, "2031-01-01T00:00:00Z")
        with direct_vm.prank(direct_bob):
            contract.refund_expired(0)
        assert contract.get_docket(0).status == STATUS_EXPIRED

    def test_refund_expired_before_deadline_rejected(self, direct_vm, direct_deploy, direct_alice):
        contract = _created(direct_vm, direct_deploy, direct_alice)
        with direct_vm.expect_revert("EXPECTED_NOT_YET_EXPIRED"):
            contract.refund_expired(0)

    def test_storage_records_have_explicit_collection_types(self, direct_vm, direct_deploy, direct_alice, direct_bob):
        contract = _submitted(direct_vm, direct_deploy, direct_alice, direct_bob)
        docket = contract.get_docket(0)
        reputation = contract.get_reputation(docket.client)
        assert type(docket).__name__ == "Docket"
        assert type(reputation).__name__ == "ReputationRecord"
        assert not isinstance(docket.evidence, (dict, list))
        assert not isinstance(docket.unmet_criteria, (dict, list))
        assert list(docket.evidence) == ["https://evidence.example/item"]
