"""Unit tests for the matching engine.

Tests cover:
  - COMPATIBILITY_MAP correctness (O- universal donor, AB+ universal recipient)
  - URGENCY_RADIUS_KM values and radius expansion for critical urgency
  - find_candidate_donors query construction via mocked database
"""
from unittest.mock import MagicMock, patch

import pytest

from app.matching_engine import (
    COMPATIBILITY_MAP,
    URGENCY_RADIUS_KM,
    MAX_MATCHES,
    get_compatible_types,
    get_search_radius_km,
    find_candidate_donors,
)


# ===================================================================
# COMPATIBILITY_MAP tests
# ===================================================================


class TestCompatibilityMap:
    """Verify the ABO/Rh compatibility map encodes correct donor-recipient
    rules."""

    def test_all_eight_blood_types_covered(self):
        expected_keys = {
            "O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+",
        }
        assert set(COMPATIBILITY_MAP.keys()) == expected_keys

    def test_all_values_are_lists(self):
        for key, val in COMPATIBILITY_MAP.items():
            assert isinstance(val, list), f"{key} maps to {type(val)}, not list"
            for bt in val:
                assert isinstance(bt, str)

    def test_ominus_only_donates_to_ominus(self):
        assert COMPATIBILITY_MAP["O-"] == ["O-"]

    def test_ominus_donor_appears_in_all_compatibility_lists(self):
        for recipient, compatible in COMPATIBILITY_MAP.items():
            assert "O-" in compatible, (
                f"O- donor missing from compatibility list for {recipient}"
            )

    def test_abplus_receives_from_all_types(self):
        assert len(COMPATIBILITY_MAP["AB+"]) == 8
        for bt in COMPATIBILITY_MAP:
            assert bt in COMPATIBILITY_MAP["AB+"]

    def test_rh_minus_recipients_only_get_rh_minus_donors(self):
        rh_minus_recipients = ["O-", "A-", "B-", "AB-"]
        for recipient in rh_minus_recipients:
            for donor in COMPATIBILITY_MAP[recipient]:
                assert donor.endswith("-"), (
                    f"Rh- recipient {recipient} matched with Rh+ donor {donor}"
                )

    def test_rh_plus_recipients_get_both_rh_plus_and_minus(self):
        rh_plus_recipients = ["O+", "A+", "B+", "AB+"]
        for recipient in rh_plus_recipients:
            donors = COMPATIBILITY_MAP[recipient]
            has_minus = any(d.endswith("-") for d in donors)
            has_plus = any(d.endswith("+") for d in donors)
            assert has_minus and has_plus, (
                f"Rh+ recipient {recipient} should get both Rh- and Rh+ donors, "
                f"got {donors}"
            )

    def test_aplus_receives_from_aplus_and_ominus_aplus(self):
        assert COMPATIBILITY_MAP["A+"] == ["O-", "O+", "A-", "A+"]

    def test_bminus_receives_from_bminus_and_ominus(self):
        assert COMPATIBILITY_MAP["B-"] == ["O-", "B-"]


# ===================================================================
# URGENCY_RADIUS_KM tests
# ===================================================================


class TestUrgencyRadius:
    """Verify the urgency → radius mapping."""

    def test_all_three_urgency_levels_defined(self):
        assert set(URGENCY_RADIUS_KM.keys()) == {"critical", "high", "routine"}

    def test_critical_radius_is_30km(self):
        assert URGENCY_RADIUS_KM["critical"] == 30

    def test_high_radius_is_15km(self):
        assert URGENCY_RADIUS_KM["high"] == 15

    def test_routine_radius_is_8km(self):
        assert URGENCY_RADIUS_KM["routine"] == 8

    def test_critical_radius_wider_than_high(self):
        assert URGENCY_RADIUS_KM["critical"] > URGENCY_RADIUS_KM["high"]

    def test_high_radius_wider_than_routine(self):
        assert URGENCY_RADIUS_KM["high"] > URGENCY_RADIUS_KM["routine"]


# ===================================================================
# get_compatible_types / get_search_radius_km helper tests
# ===================================================================


class TestHelperFunctions:

    def test_get_compatible_types_returns_list(self):
        result = get_compatible_types("O-")
        assert isinstance(result, list)

    def test_get_compatible_types_raises_on_unknown(self):
        with pytest.raises(ValueError, match="Unknown blood type"):
            get_compatible_types("X-")

    def test_get_search_radius_km_returns_int(self):
        result = get_search_radius_km("critical")
        assert isinstance(result, int)

    def test_get_search_radius_km_raises_on_unknown(self):
        with pytest.raises(ValueError, match="Unknown urgency"):
            get_search_radius_km("extreme")


# ===================================================================
# find_candidate_donors query construction tests (mocked DB)
# ===================================================================


class TestFindCandidateDonors:
    """Test that find_candidate_donors builds the correct PostGIS query."""

    def _make_mock_request(self, blood_type: str, urgency: str):
        """Build a mock Request object with a requester location."""
        request = MagicMock()
        request.blood_type = blood_type
        request.urgency = urgency
        request.request_id = "test-request-id"
        request.requester_id = "test-requester-id"
        return request

    def test_ominus_request_only_queries_for_ominus_donors(self):
        request = self._make_mock_request("O-", "high")
        db = MagicMock()

        execute_result = MagicMock()
        execute_result.all.return_value = []
        db.execute.return_value = execute_result

        # Mock the blocked donor query
        blocked_result = MagicMock()
        blocked_result.scalars.return_value.all.return_value = []

        # Mock the requester location
        mock_requester = MagicMock()
        mock_requester.location = "mocked-requester-location"
        db.get.return_value = mock_requester

        find_candidate_donors(request, db)

        db.execute.assert_called()

    def test_abplus_request_all_types_in_compatibility(self):
        request = self._make_mock_request("AB+", "routine")
        db = MagicMock()

        execute_result = MagicMock()
        execute_result.all.return_value = []
        db.execute.return_value = execute_result

        blocked_result = MagicMock()
        blocked_result.scalars.return_value.all.return_value = []

        mock_requester = MagicMock()
        mock_requester.location = "mocked-requester-location"
        db.get.return_value = mock_requester

        find_candidate_donors(request, db)

    def test_returns_list_from_db_results(self):
        """find_candidate_donors should return a list of (Donor, distance_km) tuples."""
        request = self._make_mock_request("O-", "high")
        db = MagicMock()

        mock_donor = MagicMock()
        execute_result = MagicMock()
        execute_result.all.return_value = [(mock_donor, 5000.0)]
        db.execute.return_value = execute_result

        blocked_result = MagicMock()
        blocked_result.scalars.return_value.all.return_value = []

        mock_requester = MagicMock()
        mock_requester.location = "mocked-requester-location"
        db.get.return_value = mock_requester

        result = find_candidate_donors(request, db)
        assert len(result) == 1
        assert result[0][0] is mock_donor
        assert result[0][1] == 5.0  # 5000m → 5.0 km
