import re
with open(r"e:\Cloud projects\Razorpay\revenuepilot-merchant\frontend\src\services\api.ts", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("recovery: () => aiClient.get('/merchant/recovery'),", "recovery: (period: string = 'all') => aiClient.get('/merchant/recovery', { params: { period } }),")

with open(r"e:\Cloud projects\Razorpay\revenuepilot-merchant\frontend\src\services\api.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated api.ts")

