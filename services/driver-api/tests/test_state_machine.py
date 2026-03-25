from app.state_machine import is_valid_transition, get_allowed_transitions, FAILURE_REASONS


def test_assigned_to_accepted():
    assert is_valid_transition("assigned", "accepted") is True


def test_assigned_to_delivered_invalid():
    assert is_valid_transition("assigned", "delivered") is False


def test_arrived_to_failed():
    assert is_valid_transition("arrived", "failed") is True


def test_on_the_way_to_failed():
    assert is_valid_transition("on_the_way", "failed") is True


def test_failed_to_returned():
    assert is_valid_transition("failed", "returned") is True


def test_delivered_is_terminal():
    assert get_allowed_transitions("delivered") == []


def test_returned_is_terminal():
    assert get_allowed_transitions("returned") == []


def test_allowed_from_arrived():
    allowed = get_allowed_transitions("arrived")
    assert set(allowed) == {"delivered", "failed"}


def test_failure_reasons():
    assert "customer_not_home" in FAILURE_REASONS
    assert "other" in FAILURE_REASONS
