"""Unit tests for the matching engine.

Tests cover:
  - COMPATIBILITY_MAP correctness (O- universal donor, AB+ universal recipient)
  - URGENCY_RADIUS_KM values and radius expansion for critical urgency
  - find_matches query construction via mocked database
"""
from unittest.mock import MagicMock, patch

import pytest

from app.matching_engine import (
    COMPATIBILITY_MAP,
    URGENCY_RADIUS_KM,
    MAX_MATCHES,
    get_compatible_types,
    get_search_radius_km,
    find_matches,
)


# ===================================================================
# COMPATIBILITY_MAP tests
# ===================================================================


class TestCompatibilityMap:
    """Verify the ABO/Rh compatibility map encodes correct donor-recipient
    rules as defined in TDD §5."""

    def test_all_eight_blood_types_covered(self):
        """Map must include all 8 ABO/Rh blood types as keys."""
        expected_keys = {
            "O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+",
        }
        assert set(COMPATIBILITY_MAP.keys()) == expected_keys

    def test_all_values_are_lists(self):
        """Every entry must map to a list of strings."""
        for key, val in COMPATIBILITY_MAP.items():
            assert isinstance(val, list), f"{key} maps to {type(val)}, not list"
            for bt in val:
                assert isinstance(bt, str)

    # --- O- (universal donor) ---
    def test_ominus_only_donates_to_ominus(self):
        """O- donors can only donate to O- recipients (most restrictive)."""
        assert COMPATIBILITY_MAP["O-"] == ["O-"]

    def test_ominus_donor_appears_in_all_compatibility_lists(self):
        """O- is the universal donor — it must appear in every recipient list."""
        for recipient, compatible in COMPATIBILITY_MAP.items():
            assert "O-" in compatible, (
                f"O- donor missing from compatibility list for {recipient}"
            )

    # --- AB+ (universal recipient) ---
    def test_abplus_receives_from_all_types(self):
        """AB+ is the universal recipient — all 8 donor types are compatible."""
        assert len(COMPATIBILITY_MAP["AB+"]) == 8
        for bt in COMPATIBILITY_MAP:
            assert bt in COMPATIBILITY_MAP["AB+"]

    # --- Rh rules ---
    def test_rh_minus_recipients_only_get_rh_minus_donors(self):
        """Rh- recipients (O-, A-, B-, AB-) can only receive from Rh- donors."""
        rh_minus_recipients = ["O-", "A-", "B-", "AB-"]
        for recipient in rh_minus_recipients:
            for donor in COMPATIBILITY_MAP[recipient]:
                assert donor.endswith("-"), (
                    f"Rh- recipient {recipient} matched with Rh+ donor {donor}"
                )

    def test_rh_plus_recipients_get_both_rh_plus_and_minus(self):
        """Rh+ recipients can receive from both Rh+ and Rh- donors."""
        rh_plus_recipients = ["O+", "A+", "B+", "AB+"]
        for recipient in rh_plus_recipients:
            donors = COMPATIBILITY_MAP[recipient]
            has_minus = any(d.endswith("-") for d in donors)
            has_plus = any(d.endswith("+") for d in donors)
            assert has_minus and has_plus, (
                f"Rh+ recipient {recipient} should get both Rh- and Rh+ donors, "
                f"got {donors}"
            )

    # --- Specific ABO compatibility ---
    def test_aplus_receives_from_aplus_and_ominus_aplus(self):
        """A+ recipients can receive from O-, O+, A-, A+."""
        assert COMPATIBILITY_MAP["A+"] == ["O-", "O+", "A-", "A+"]

    def test_bminus_receives_from_bminus_and_ominus(self):
        """B- recipients can receive from O-, B-."""
        assert COMPATIBILITY_MAP["B-"] == ["O-", "B-"]


# ===================================================================
# URGENCY_RADIUS_KM tests
# ===================================================================


class TestUrgencyRadius:
    """Verify the urgency → radius mapping matches TDD §5 specs."""

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
# find_matches query construction tests (mocked DB)
# ===================================================================


class TestFindMatches:
    """Test that find_matches builds the correct PostGIS query.

    Uses a mocked Session to verify query construction without needing
    a real PostGIS database.
    """

    def _make_mock_request(self, blood_type: str, urgency: str):
        """Build a mock Request object with a hospital location."""
        request = MagicMock()
        request.blood_type = blood_type
        request.urgency = urgency
        request.hospital = MagicMock()
        request.hospital.location = "mocked-hospital-location"
        return request

    def test_ominus_request_only_queries_for_ominus_donors(self):
        """O- is the universal donor; requesting O- should only match O- donors."""
        request = self._make_mock_request("O-", "high")
        db = MagicMock()

        # Capture the select statement passed to db.execute
        execute_result = MagicMock()
        execute_result.scalars.return_value.all.return_value = []
        db.execute.return_value = execute_result

        find_matches(request, db)

        # Verify db.execute was called once
        db.execute.assert_called_once()
        call_args = db.execute.call_args
        # The first positional arg is the Select object
        select_stmt = call_args[0][0]

        # The where clause should filter on blood_type IN ('O-')
        # We verify by checking the compiled SQL contains the right IN clause
        compiled = str(select_stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "O-" in compiled
        # No other blood type should appear in the IN clause
        for bt in ["O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]:
            assert bt not in compiled or bt == "O-", (
                f"O- request should not match {bt}"
            )

    def test_abplus_request_all_types_in_compatibility(self):
        """AB+ is the universal recipient; requesting AB+ should include all 8 types."""
        request = self._make_mock_request("AB+", "routine")
        db = MagicMock()

        execute_result = MagicMock()
        execute_result.scalars.return_value.all.return_value = []
        db.execute.return_value = execute_result

        find_matches(request, db)

        select_stmt = db.execute.call_args[0][0]
        compiled = str(select_stmt.compile(compile_kwargs={"literal_binds": True}))
        # All blood types should appear somewhere in the compiled query
        for bt in COMPATIBILITY_MAP["AB+"]:
            assert bt in compiled, f"AB+ request query missing {bt}"

    def test_critical_urgency_uses_30km_radius(self):
        """Critical urgency should use 30km = 30000m in ST_DWithin."""
        request = self._make_mock_request("O+", "critical")
        db = MagicMock()

        execute_result = MagicMock()
        execute_result.scalars.return_value.all.return_value = []
        db.execute.return_value = execute_result

        find_matches(request, db)

        select_stmt = db.execute.call_args[0][0]
        compiled = str(select_stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "30000" in compiled, "Critical urgency should use 30000m radius"

    def test_routine_urgency_uses_8km_radius(self):
        """Routine urgency should use 8km = 8000m in ST_DWithin."""
        request = self._make_mock_request("B-", "routine")
        db = MagicMock()

        execute_result = MagicMock()
        execute_result.scalars.return_value.all.return_value = []
        db.execute.return_value = execute_result

        find_matches(request, db)

        select_stmt = db.execute.call_args[0][0]
        compiled = str(select_stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "8000" in compiled, "Routine urgency should use 8000m radius"

    def test_high_urgency_uses_15km_radius(self):
        """High urgency should use 15km = 15000m in ST_DWithin."""
        request = self._make_mock_request("A+", "high")
        db = MagicMock()

        execute_result = MagicMock()
        execute_result.scalars.return_value.all.return_value = []
        db.execute.return_value = execute_result

        find_matches(request, db)

        select_stmt = db.execute.call_args[0][0]
        compiled = str(select_stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "15000" in compiled, "High urgency should use 15000m radius"

    def test_query_orders_by_distance(self):
        """Results should be ordered by ST_Distance ascending (closest first)."""
        request = self._make_mock_request("O-", "high")
        db = MagicMock()

        execute_result = MagicMock()
        execute_result.scalars.return_value.all.return_value = []
        db.execute.return_value = execute_result

        find_matches(request, db)

        select_stmt = db.execute.call_args[0][0]
        compiled = str(select_stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "ST_Distance" in compiled, "Query should order by ST_Distance"

    def test_query_limits_to_max_matches(self):
        """Results should be capped at MAX_MATCHES (50)."""
        request = self._make_mock_request("O-", "high")
        db = MagicMock()

        execute_result = MagicMock()
        execute_result.scalars.return_value.all.return_value = []
        db.execute.return_value = execute_result

        find_matches(request, db)

        select_stmt = db.execute.call_args[0][0]
        compiled = str(select_stmt.compile(compile_kwargs={"literal_binds": True}))
        assert str(MAX_MATCHES) in compiled, f"Query should LIMIT to {MAX_MATCHES}"

    def test_returns_list_from_db_results(self):
        """find_matches should return a list of Donor objects."""
        request = self._make_mock_request("O-", "high")
        db = MagicMock()

        mock_donor = MagicMock()
        execute_result = MagicMock()
        execute_result.scalars.return_value.all.return_value = [mock_donor]
        db.execute.return_value = execute_result

        result = find_matches(request, db)
        assert result == [mock_donor]
