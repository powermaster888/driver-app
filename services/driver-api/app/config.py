from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./driver_api.db"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30
    odoo_url: str = "https://hlm260321.odoo.com"
    odoo_db: str = "hlm260321"
    odoo_username: str = ""
    odoo_api_key: str = ""
    upload_max_bytes: int = 10_485_760  # 10MB
    upload_dir: str = "./uploads"

    model_config = {"env_prefix": "DRIVER_API_"}


settings = Settings()
