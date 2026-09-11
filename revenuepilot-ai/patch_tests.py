file_path = r'e:\Cloud projects\Razorpay\revenuepilot-ai\tests\test_recovery_ai.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('assert c.status == "APPROVED"', 'assert c.status == "SCHEDULED"')
content = content.replace('patch("app.services.recovery_intelligence_agent.aws_manager"),', 'patch.object(agent.repo, "create_campaign_run", new_callable=AsyncMock) as mock_create_run,\n            patch("app.services.recovery_intelligence_agent.aws_manager"),')

content = content.replace('assert result["status"] == "SUCCESS"', 'assert result.get("success") is True')
content = content.replace('assert result["candidates_approved"] == 2', 'assert result.get("candidates_created") == 2')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Patched successfully')
