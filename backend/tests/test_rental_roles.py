import pytest
from app.domain import can_rent


@pytest.mark.parametrize('roles, allowed', [
    (['farmer'], True),
    (['farmer', 'operator'], True),
    (['owner'], False),
    (['farmer', 'owner', 'fpo'], False),
    (['operator'], False),
    ([], False),
])
def test_rental_account_roles(roles, allowed):
    assert can_rent(roles) is allowed
