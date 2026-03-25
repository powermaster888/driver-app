TRANSITIONS: dict[str, list[str]] = {
    "assigned": ["accepted"],
    "accepted": ["on_the_way"],
    "on_the_way": ["arrived", "failed"],
    "arrived": ["delivered", "failed"],
    "failed": ["returned"],
    "delivered": [],
    "returned": [],
}

FAILURE_REASONS = [
    "customer_not_home",
    "wrong_address",
    "customer_refused",
    "access_issue",
    "other",
]


def is_valid_transition(current: str, target: str) -> bool:
    return target in TRANSITIONS.get(current, [])


def get_allowed_transitions(current: str) -> list[str]:
    return TRANSITIONS.get(current, [])
