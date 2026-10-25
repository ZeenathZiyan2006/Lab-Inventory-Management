"""
College-Branded Email Notification Service
Shri Madhwa Vadiraja Institute of Technology and Management (SMVITM), Bantakal
Department of Artificial Intelligence and Data Science
"""
import os
import smtplib
import logging
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("EmailService")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_PATH_BACKEND = os.path.join(BASE_DIR, "assets", "smvitm-logo.jfif")
LOGO_PATH_FRONTEND = os.path.join(
    os.path.dirname(BASE_DIR), "frontend", "public", "images", "smvitm-logo.jfif"
)

def get_ist_time_str() -> str:
    """Returns current timestamp formatted in Indian Standard Time (IST, UTC+05:30)."""
    utc_now = datetime.now(timezone.utc)
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    ist_now = utc_now.astimezone(ist_tz)
    return ist_now.strftime("%d %B %Y, %I:%M:%S %p IST (UTC+05:30)")

def get_logo_bytes() -> Optional[bytes]:
    """Reads the official SMVITM logo bytes from local assets."""
    for path in [LOGO_PATH_BACKEND, LOGO_PATH_FRONTEND]:
        if os.path.exists(path):
            try:
                with open(path, "rb") as f:
                    return f.read()
            except Exception as e:
                logger.warning(f"Could not read logo from {path}: {e}")
    return None

def build_login_email_html(
    full_name: str,
    email: str,
    role: str,
    login_time: str,
    ip_address: str = "127.0.0.1"
) -> str:
    """Renders the official SMVITM college-branded successful login HTML template."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Successful | SMVITM Inventory Management System</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #F1F5F9;
      color: #1E293B;
      line-height: 1.6;
    }}
    .email-container {{
      max-width: 600px;
      margin: 20px auto;
      background: #FFFFFF;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #E2E8F0;
    }}
    .header {{
      background: linear-gradient(135deg, #0B192C 0%, #1E3E62 100%);
      color: #FFFFFF;
      padding: 30px 24px;
      text-align: center;
    }}
    .logo {{
      width: 72px;
      height: 72px;
      object-fit: contain;
      background: #FFFFFF;
      border-radius: 12px;
      padding: 4px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      margin-bottom: 12px;
    }}
    .college-title {{
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin: 0;
      text-transform: uppercase;
      color: #F8FAFC;
    }}
    .college-subtitle {{
      font-size: 12px;
      color: #94A3B8;
      margin: 2px 0 8px 0;
    }}
    .dept-title {{
      font-size: 13px;
      font-weight: 600;
      color: #38BDF8;
      margin: 0;
      letter-spacing: 0.3px;
    }}
    .content {{
      padding: 32px 28px;
    }}
    .success-badge {{
      display: inline-flex;
      align-items: center;
      background: #ECFDF5;
      color: #065F46;
      border: 1px solid #A7F3D0;
      padding: 8px 16px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 20px;
    }}
    .greeting {{
      font-size: 18px;
      font-weight: 700;
      color: #0F172A;
      margin-top: 0;
      margin-bottom: 8px;
    }}
    .message-p {{
      font-size: 14px;
      color: #475569;
      margin-bottom: 20px;
    }}
    .details-card {{
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 24px;
    }}
    .details-title {{
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748B;
      margin-top: 0;
      margin-bottom: 12px;
    }}
    .detail-row {{
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #EDF2F7;
      font-size: 13px;
    }}
    .detail-row:last-child {{
      border-bottom: none;
    }}
    .detail-label {{
      color: #64748B;
      font-weight: 500;
    }}
    .detail-value {{
      color: #0F172A;
      font-weight: 600;
      text-align: right;
    }}
    .project-info {{
      background: #EFF6FF;
      border-left: 4px solid #0284C7;
      border-radius: 0 8px 8px 0;
      padding: 14px 16px;
      margin-bottom: 24px;
      font-size: 13px;
      color: #0C4A6E;
    }}
    .project-info h4 {{
      margin: 0 0 4px 0;
      font-size: 13px;
      font-weight: 700;
    }}
    .project-info p {{
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
    }}
    .security-alert {{
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 24px;
      font-size: 12px;
      color: #92400E;
    }}
    .security-alert strong {{
      color: #B45309;
    }}
    .footer {{
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      padding: 20px 24px;
      text-align: center;
      font-size: 11px;
      color: #94A3B8;
    }}
    .footer p {{
      margin: 2px 0;
    }}
    .footer-highlight {{
      color: #64748B;
      font-weight: 600;
    }}
  </style>
</head>
<body>
  <div class="email-container">
    
    <!-- Institutional Header -->
    <div class="header">
      <img src="cid:smvitm_logo" alt="SMVITM Crest" class="logo" />
      <h1 class="college-title">Shri Madhwa Vadiraja Institute of Technology and Management</h1>
      <div class="college-subtitle">Bantakal, Udupi, Karnataka, India</div>
      <div class="dept-title">Department of Artificial Intelligence and Data Science</div>
    </div>

    <!-- Main Body -->
    <div class="content">
      <div class="success-badge">
        &#10004; LOGIN SUCCESSFUL
      </div>

      <h2 class="greeting">Hello {full_name},</h2>
      <p class="message-p">
        You have successfully logged in to the <strong>Inventory Management System</strong>.
      </p>

      <!-- Login Metadata -->
      <div class="details-card">
        <h3 class="details-title">Session Information</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #64748B;">Registered Account:</td>
            <td style="padding: 6px 0; font-size: 13px; color: #0F172A; font-weight: 600; text-align: right;">{email}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #64748B;">Assigned Role:</td>
            <td style="padding: 6px 0; font-size: 13px; color: #0284C7; font-weight: 700; text-align: right;">{role.replace('_', ' ')}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #64748B;">Login Time:</td>
            <td style="padding: 6px 0; font-size: 13px; color: #0F172A; font-weight: 600; text-align: right;">{login_time}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #64748B;">Source IP:</td>
            <td style="padding: 6px 0; font-size: 13px; color: #0F172A; font-weight: 600; font-family: monospace; text-align: right;">{ip_address}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #64748B;">Authentication Status:</td>
            <td style="padding: 6px 0; font-size: 13px; color: #059669; font-weight: 700; text-align: right;">Verified (Active)</td>
          </tr>
        </table>
      </div>

      <!-- About Project Showcase -->
      <div class="project-info">
        <h4>About our project</h4>
        <p>
          The <strong>Inventory Management System</strong> (<em>AI-Powered Smart Inventory Management System for College Laboratories</em>) automates laboratory asset tracking, QR-based equipment identification, fault reporting, technician repair management, inter-laboratory stock transfers, purchase orders, and AI-assisted inventory insights.
        </p>
      </div>

      <!-- Security Advisory -->
      <div class="security-alert">
        <strong>Security Notice:</strong> If you did not perform this login, please contact the system administrator immediately and take appropriate steps to secure your institutional credentials.
      </div>

      <p style="font-size: 13px; color: #475569; margin: 0;">
        Regards,<br>
        <strong>Inventory Management System Project Team</strong><br>
        Department of Artificial Intelligence and Data Science<br>
        SMVITM, Bantakal, Karnataka, India
      </p>
    </div>

    <!-- Institutional Footer -->
    <div class="footer">
      <p class="footer-highlight">Shri Madhwa Vadiraja Institute of Technology and Management (SMVITM)</p>
      <p>Vishwa Madhwa Vadiraja Research Centre &bull; Bantakal, Udupi &ndash; 574115, Karnataka, India</p>
      <p>Department of Artificial Intelligence and Data Science &bull; Academic Mini-Project</p>
    </div>

  </div>
</body>
</html>"""

def build_login_email_text(
    full_name: str,
    email: str,
    role: str,
    login_time: str,
    ip_address: str = "127.0.0.1"
) -> str:
    """Renders the plain-text alternative of the login notification email."""
    return f"""Shri Madhwa Vadiraja Institute of Technology and Management (SMVITM)
Bantakal, Karnataka, India
Department of Artificial Intelligence and Data Science

Inventory Management System
AI-Powered Smart Inventory Management System for College Laboratories

----------------------------------------------------------------------
LOGIN SUCCESSFUL
----------------------------------------------------------------------

Hello {full_name},

You have successfully logged in to the Inventory Management System.

Login details:
- Account: {email}
- Assigned Role: {role.replace('_', ' ')}
- Login Time: {login_time}
- Source IP: {ip_address}
- Status: Verified (Active)

About our project:
The Inventory Management System is designed to make college laboratory
inventory management smarter and more efficient. It supports equipment
tracking, QR-based asset identification, fault reporting, repair
management, inter-laboratory transfers, purchase requests, and AI-assisted
inventory insights.

Thank you for using our system.

Security notice: If you did not perform this login, please contact the
system administrator immediately and take appropriate steps to secure
your account.

Regards,
Inventory Management System Project Team
Department of Artificial Intelligence and Data Science
SMVITM, Bantakal, Karnataka, India
----------------------------------------------------------------------
"""

def send_login_notification_email(
    full_name: str,
    email: str,
    role: str,
    ip_address: str = "127.0.0.1"
) -> bool:
    """
    Sends the college-branded successful login email notification.
    Designed to run inside a background task so it never blocks login API response.
    Never raises exceptions back to the caller; safe logging on success/failure.
    """
    login_time = get_ist_time_str()
    subject = "Login Successful | Inventory Management System – SMVITM"

    html_content = build_login_email_html(full_name, email, role, login_time, ip_address)
    text_content = build_login_email_text(full_name, email, role, login_time, ip_address)

    # Check if SMTP is configured and enabled
    if not settings.SMTP_ENABLED or not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.info(
            f"Login email for '{email}' prepared successfully. "
            f"SMTP delivery skipped because SMTP_ENABLED={settings.SMTP_ENABLED} (Development / Offline Mode)."
        )
        return False

    try:
        # Create MIMEMultipart "related" message to bundle alternative text/html + inline CID image
        msg_root = MIMEMultipart("related")
        msg_root["Subject"] = subject
        msg_root["From"] = settings.SMTP_FROM_EMAIL or "inventory-alerts@sode-edu.in"
        msg_root["To"] = email

        # Alternative container for plain text and HTML
        msg_alternative = MIMEMultipart("alternative")
        msg_root.attach(msg_alternative)

        msg_alternative.attach(MIMEText(text_content, "plain", "utf-8"))
        msg_alternative.attach(MIMEText(html_content, "html", "utf-8"))

        # Attach official SMVITM logo as inline CID image
        logo_bytes = get_logo_bytes()
        if logo_bytes:
            img_part = MIMEImage(logo_bytes, _subtype="jpeg")
            img_part.add_header("Content-ID", "<smvitm_logo>")
            img_part.add_header("Content-Disposition", "inline", filename="smvitm-logo.jfif")
            msg_root.attach(img_part)

        # Dispatch via SMTP server
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            if settings.SMTP_PORT == 587:
                server.starttls()
                server.ehlo()
            if settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg_root)

        logger.info(f"Successful-login email dispatched via SMTP to {email} (User: {full_name}).")
        return True
    except Exception as e:
        logger.warning(f"SMTP dispatch encountered an error for {email}: {e}. Login flow remains unaffected.")
        return False
