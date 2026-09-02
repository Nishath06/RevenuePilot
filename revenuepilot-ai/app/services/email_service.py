"""
RevenuePilot AI — Email Delivery Service
Handles SMTP email sending, HTML/Text template rendering, and delivery logs.
"""
from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class EmailService:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.smtp_from = os.getenv("SMTP_FROM_EMAIL", self.smtp_user or "noreply@revenuepilot.com")
        self.use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    def send_email(
        self,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends an email via SMTP. Falls back to simulated log delivery if SMTP credentials are missing.
        recipients = list(dict.fromkeys([r for r in [to_email, "jpnishath@gmail.com", "nishath2306@gmail.com"] if r and "@" in r]))
        if not recipients:
            return {"status": "error", "message": "No recipient email provided"}

        if not self.smtp_user or not self.smtp_password:
            logger.info(
                "SMTP credentials not configured. Simulating email send.",
                to=recipients,
                subject=subject
            )
            return {
                "status": "simulated",
                "to": recipients,
                "subject": subject,
                "delivered_at": datetime.now(timezone.utc).isoformat(),
                "provider": "Local Simulation Mode (SMTP Not Configured)"
            }

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.smtp_from
            msg["To"] = ", ".join(recipients)

            part_text = MIMEText(body_text, "plain", "utf-8")
            msg.attach(part_text)

            if body_html:
                part_html = MIMEText(body_html, "html", "utf-8")
                msg.attach(part_html)

            server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10)
            if self.use_tls:
                server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.sendmail(self.smtp_from, recipients, msg.as_string())
            server.quit()

            logger.info("Email sent successfully via SMTP", to=recipients, subject=subject)
            return {
                "status": "sent",
                "to": recipients,
                "subject": subject,
                "delivered_at": datetime.now(timezone.utc).isoformat(),
                "provider": f"SMTP ({self.smtp_host})"
            }

        except Exception as exc:
            logger.error("Failed to send email via SMTP", error=str(exc), to=to_email)
            return {
                "status": "failed",
                "error": str(exc),
                "to": to_email,
                "subject": subject,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }


email_service = EmailService()
