import re

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace .get("total_amount", DEFAULT) with float(.get("total_amount") or 0.0)
    content = re.sub(r'([a-zA-Z0-9_]+)\.get\([\'"]total_amount[\'"]\s*,\s*[^)]+\)', r'float(\1.get("total_amount") or 0.0)', content)
    content = re.sub(r'([a-zA-Z0-9_]+)\.get\([\'"]subtotal[\'"]\s*,\s*[^)]+\)', r'float(\1.get("subtotal") or 0.0)', content)
    content = re.sub(r'([a-zA-Z0-9_]+)\.get\([\'"]amount[\'"]\s*,\s*[^)]+\)', r'float(\1.get("amount") or 0.0)', content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

patch_file(r'e:\Cloud projects\Razorpay\revenuepilot-ai\app\services\analytics.py')
patch_file(r'e:\Cloud projects\Razorpay\revenuepilot-ai\app\services\merchant_service.py')
print('Patched files')
