from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""

    # NTREIS RESO (future OData)
    ntreis_client_id: str = ""
    ntreis_client_secret: str = ""
    ntreis_token_url: str = ""

    # NTREIS RETS (Matrix MLS — property search / auto-fill)
    ntreis_rets_url: str = ""
    ntreis_rets_username: str = ""
    ntreis_rets_password: str = ""

    # Dot Loop
    dotloop_client_id: str = ""
    dotloop_client_secret: str = ""

    # GROQ
    groq_api_key: str = ""

    # HeyGen (Market Yourself avatar + video)
    heygen_api_key: str = ""

    # Email
    gmail_user: str = "noreply@localpro.com"
    gmail_app_password: str = ""
    resend_api_key: str = ""

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # BrokerMint
    brokermint_api_key: str = ""
    brokermint_webhook_secret_created: str = ""
    brokermint_webhook_secret_updated: str = ""

    # n8n
    n8n_webhook_base_url: str = ""
    n8n_signup_webhook_url: str = ""
    n8n_milestone_webhook_url: str = ""
    n8n_booking_webhook_url: str = ""
    n8n_go_live_webhook_url: str = ""
    n8n_marketing_webhook_url: str = ""

    # Integrations
    lofty_webhook_url: str = ""

    # App
    cors_origins: str = "http://localhost:5173"
    frontend_url: str = ""
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    @field_validator("supabase_url")
    @classmethod
    def validate_supabase_url(cls, value: str) -> str:
        if value and not value.startswith("https://"):
            raise ValueError("SUPABASE_URL must be an https URL")
        return value.rstrip("/") if value else value

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)

    def require_supabase(self) -> tuple[str, str]:
        if not self.supabase_configured:
            raise RuntimeError(
                "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.",
            )
        return self.supabase_url, self.supabase_service_key

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def require_groq(self) -> str:
        if not self.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not configured")
        return self.groq_api_key

    def require_heygen(self) -> str:
        if not self.heygen_api_key.strip():
            raise RuntimeError("HEYGEN_API_KEY is not configured")
        return self.heygen_api_key.strip()

    def require_resend(self) -> str:
        if not self.resend_api_key:
            raise RuntimeError("RESEND_API_KEY is not configured")
        return self.resend_api_key

    def require_stripe(self) -> str:
        if not self.stripe_secret_key:
            raise RuntimeError("STRIPE_SECRET_KEY is not configured")
        return self.stripe_secret_key

    @property
    def ntreis_rets_configured(self) -> bool:
        return bool(
            self.ntreis_rets_url.strip()
            and self.ntreis_rets_username.strip()
            and self.ntreis_rets_password,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
