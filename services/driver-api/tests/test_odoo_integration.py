"""Integration tests against test Odoo. Run with: RUN_INTEGRATION=1 pytest tests/test_odoo_integration.py -v"""
import os
import pytest
from app.odoo_client import OdooClient

pytestmark = pytest.mark.skipif(
    not os.environ.get("RUN_INTEGRATION"),
    reason="Set RUN_INTEGRATION=1 to run Odoo integration tests",
)

def test_fetch_jobs():
    client = OdooClient()
    jobs = client.get_driver_jobs("耀", "pending")
    assert isinstance(jobs, list)

def test_resolve_collection_cod():
    client = OdooClient()
    required, method, amount = client.resolve_collection(113606)
    assert required is True
    assert method == "cash"
