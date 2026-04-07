import sys,os
sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from _mock_jobs import MOCK_JOBS
from app.schemas import JobListResponse,JobDetail,JobSummary,JobItem
from datetime import datetime,timezone
def get_mock_jobs(scope="today"):
    return JobListResponse(jobs=[JobSummary(**m) for m in MOCK_JOBS],fetched_at=datetime.now(timezone.utc))
def get_mock_job(job_id):
    for m in MOCK_JOBS:
        if m["job_id"]==job_id:
            items=[JobItem(product_name="輪椅配件 A",quantity=2,move_id=2001,barcode="4901234567890"),JobItem(product_name="醫療用床墊 B",quantity=1,move_id=2002,barcode="2909876543210")]
            return JobDetail(**JobSummary(**m).model_dump(),delivery_notes="請小心搬運，客戶住12樓沒有電梯",additional_info="聯絡人：張太 9123 9999",account_no="ACC-2026-001",items=items)
    return None
