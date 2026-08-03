import os
import httpx
from config import get_settings
from supabase import create_client

s = get_settings()
supabase = create_client(*s.require_supabase())

def main():
    print("=== Testing /rets/upload-pdf Endpoint ===")
    
    # 1. Install reportlab to generate the test PDF
    print("Installing reportlab...")
    os.system("venv/bin/pip install reportlab")
    
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    
    # 2. Read the extracted text
    text_path = "/Users/adarshsonu/.gemini/antigravity-ide/brain/cb713577-2f6e-4648-a52b-ac5940c21da3/scratch/extracted_pdf_text.txt"
    with open(text_path, "r") as f:
        lines = f.readlines()
        
    # 3. Create a PDF file from the text
    pdf_path = "test_property_report.pdf"
    print(f"Generating test PDF: {pdf_path}...")
    c = canvas.Canvas(pdf_path, pagesize=letter)
    y = 750
    for line in lines: # Write all lines
        clean_line = line.strip()
        if clean_line.startswith("=== PAGE"):
            c.showPage()
            y = 750
            continue
        c.drawString(50, y, clean_line)
        y -= 15
        if y < 50:
            c.showPage()
            y = 750
    c.save()
    
    try:
        # 4. Authenticate as Andrew Wetzel
        print("Authenticating as Andrew Wetzel...")
        auth_res = supabase.auth.sign_in_with_password({
            "email": "andrew@theandrews.group",
            "password": "localPro123!"
        })
        token = auth_res.session.access_token
        
        # 5. POST to the endpoint
        print("Uploading PDF to /rets/upload-pdf...")
        headers = {"Authorization": f"Bearer {token}"}
        
        with open(pdf_path, "rb") as pdf_file:
            files = {"file": (pdf_path, pdf_file, "application/pdf")}
            resp = httpx.post("http://localhost:8000/rets/upload-pdf", headers=headers, files=files, timeout=60)
            
        print(f"Status Code: {resp.status_code}")
        if resp.status_code == 200:
            print("SUCCESS! Parsed Response:")
            import json
            print(json.dumps(resp.json(), indent=2))
        else:
            print(f"FAILED: {resp.text}")
            
    finally:
        # Cleanup generated PDF
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
            print("Cleaned up generated test PDF.")

if __name__ == "__main__":
    main()
