import qrcode
import qrcode.image.svg
import io
import base64

def generate_qr_base64(data: str) -> str:
    """Generates a QR code image encoded as Base64 PNG."""
    png_bytes = generate_qr_png_bytes(data)
    img_str = base64.b64encode(png_bytes).decode("utf-8")
    return f"data:image/png;base64,{img_str}"

def generate_qr_png_bytes(data: str) -> bytes:
    """Generates raw PNG bytes for a QR code."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0a192f", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()

def generate_qr_svg(data: str) -> str:
    """Generates a clean standalone vector SVG string for a QR code."""
    factory = qrcode.image.svg.SvgPathImage
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
        image_factory=factory
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image()
    buffer = io.BytesIO()
    img.save(buffer)
    return buffer.getvalue().decode("utf-8")
