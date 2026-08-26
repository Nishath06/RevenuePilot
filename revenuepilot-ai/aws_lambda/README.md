# RevenuePilot AWS Lambda Engine

Production AWS Lambda Functions for the **RevenuePilot Autonomous Merchant Operating System**.

This directory contains standalone Python 3.12/3.13 Lambda function handlers designed to run either natively in AWS Cloud or seamlessly via the **Local Lambda Simulation Layer** in FastAPI (`cloud_event_bus.invoke_lambda_function`).

---

## ⚡ Function Inventory & Architecture

```
                       ┌────────────────────────────────────────┐
                       │          AWS EventBridge Bus           │
                       │     (revenuepilot-event-bus)           │
                       └──────────────────┬─────────────────────┘
                                          │
        ┌───────────────────┬─────────────┼─────────────┬──────────────────┐
        ▼                   ▼             ▼             ▼                  ▼
┌───────────────┐   ┌───────────────┐ ┌─────────┐ ┌──────────────┐ ┌──────────────┐
│InventoryLambda│   │ RecoveryLambda│ │Reports  │ │IncidentLambda│ │CloudWatch    │
│               │   │               │ │Lambda   │ │              │ │Lambda        │
└───────┬───────┘   └───────┬───────┘ └────┬────┘ └──────┬───────┘ └──────┬───────┘
        │                   │              │             │                │
        ▼                   ▼              ▼             ▼                ▼
┌───────────────┐   ┌───────────────┐ ┌─────────┐ ┌──────────────┐ ┌──────────────┐
│Stockout Alerts│   │SES / SNS      │ │S3 Bucket│ │SNS Topic     │ │CloudWatch    │
│Velocity Analysis  │Campaign Copy  │ │Reports  │ │Alert Notices │ │Custom Metrics│
└───────────────┘   └───────────────┘ └─────────┘ └──────────────┘ └──────────────┘
```

| Function Name | Handler File | Trigger Source | Primary Services | Role & Capability |
| :--- | :--- | :--- | :--- | :--- |
| **InventoryLambda** | `inventory_lambda.py` | EventBridge Cron (6h) / API | EventBridge, SNS | Scans stockout velocity, flags low/out-of-stock items, triggers reorder alerts |
| **RecoveryLambda** | `recovery_lambda.py` | EventBridge (`PAYMENT_FAILED`) | AWS SES, AWS SNS, EventBridge | Generates recovery coupons (`RECOVER10`), formats multi-channel templates (WhatsApp/Email/SMS) |
| **ReportsLambda** | `reports_lambda.py` | EventBridge Cron (Daily 8 AM) | AWS S3, EventBridge | Generates date-filtered CSV, JSON, or PDF reports and uploads to S3 buckets |
| **IncidentLambda** | `incident_lambda.py` | Watchdogs / Anomaly Alerts | AWS SNS, EventBridge | Registers operational incidents and dispatches priority notifications to SNS topics |
| **CloudWatchLambda**| `cloudwatch_lambda.py` | EventBridge Cron (5 min) | AWS CloudWatch | Aggregates execution telemetry and pushes custom metrics (`RevenuePilot/AutoOps`) |

---

## 🔐 Environment Variables Matrix

Configure these environment variables in your AWS Lambda function configuration:

| Variable Name | Default Value | Required | Description |
| :--- | :--- | :---: | :--- |
| `EVENTBRIDGE_BUS_NAME` | `revenuepilot-event-bus` | **Yes** | Target AWS EventBridge Event Bus Name |
| `REPORTS_S3_BUCKET` | `revenuepilot-reports-bucket` | **Yes** | AWS S3 bucket name for report exports |
| `SES_SENDER_EMAIL` | `noreply@revenuepilot.ai` | Optional | Verified SES identity email address |
| `SNS_ALERT_TOPIC_ARN` | `arn:aws:sns:ap-south-1:...` | Optional | AWS SNS Topic ARN for high-severity alerts |
| `CLOUDWATCH_NAMESPACE` | `RevenuePilot/AutoOps` | Optional | Custom metric namespace in AWS CloudWatch |
| `LOW_STOCK_THRESHOLD` | `5` | Optional | Stock quantity threshold for low-stock triggers |

---

## 🛠 Deployment Guide

### Option 1: Deploying via AWS CLI

#### 1. Package the Lambda ZIP files
```bash
# Package individual handlers
zip -j inventory_lambda.zip aws_lambda/inventory_lambda.py
zip -j recovery_lambda.zip aws_lambda/recovery_lambda.py
zip -j reports_lambda.zip aws_lambda/reports_lambda.py
zip -j incident_lambda.zip aws_lambda/incident_lambda.py
zip -j cloudwatch_lambda.zip aws_lambda/cloudwatch_lambda.py
```

#### 2. Create Execution Role (IAM)
Ensure your IAM Role has the following AWS managed policies:
- `AWSLambdaBasicExecutionRole`
- `AmazonEventBridgeFullAccess`
- `AmazonS3FullAccess` (or scoped policy for `revenuepilot-reports-bucket`)
- `AmazonSESFullAccess`
- `AmazonSNSFullAccess`
- `CloudWatchFullAccess`

#### 3. Create Lambda Functions
```bash
# Deploy InventoryLambda
aws lambda create-function \
  --function-name InventoryLambda \
  --runtime python3.12 \
  --role arn:aws:iam::123456789012:role/RevenuePilotLambdaExecutionRole \
  --handler inventory_lambda.lambda_handler \
  --zip-file fileb://inventory_lambda.zip \
  --environment "Variables={EVENTBRIDGE_BUS_NAME=revenuepilot-event-bus,LOW_STOCK_THRESHOLD=5}"

# Deploy RecoveryLambda
aws lambda create-function \
  --function-name RecoveryLambda \
  --runtime python3.12 \
  --role arn:aws:iam::123456789012:role/RevenuePilotLambdaExecutionRole \
  --handler recovery_lambda.lambda_handler \
  --zip-file fileb://recovery_lambda.zip \
  --environment "Variables={EVENTBRIDGE_BUS_NAME=revenuepilot-event-bus,SES_SENDER_EMAIL=noreply@revenuepilot.ai}"

# Deploy ReportsLambda
aws lambda create-function \
  --function-name ReportsLambda \
  --runtime python3.12 \
  --role arn:aws:iam::123456789012:role/RevenuePilotLambdaExecutionRole \
  --handler reports_lambda.lambda_handler \
  --zip-file fileb://reports_lambda.zip \
  --environment "Variables={EVENTBRIDGE_BUS_NAME=revenuepilot-event-bus,REPORTS_S3_BUCKET=revenuepilot-reports-bucket}"
```

#### 4. Updating Function Code
```bash
aws lambda update-function-code \
  --function-name InventoryLambda \
  --zip-file fileb://inventory_lambda.zip
```

---

## 🧪 Event Test Payload Examples

You can test these functions directly in the AWS Lambda Console or via AWS CLI `aws lambda invoke`.

### `InventoryLambda` Test Payload
```json
{
  "merchant_id": "merch_default",
  "items": [
    { "sku": "PROD_001", "name": "Wireless Noise Cancelling Headphones", "stock": 2 },
    { "sku": "PROD_002", "name": "Smart Fitness Watch", "stock": 0 },
    { "sku": "PROD_003", "name": "Ergonomic Mechanical Keyboard", "stock": 25 }
  ]
}
```

### `RecoveryLambda` Test Payload
```json
{
  "event_type": "PAYMENT_FAILED",
  "customer_name": "Rohan Sharma",
  "customer_email": "rohan@example.com",
  "customer_phone": "+919876543210",
  "amount": 4999.00,
  "merchant_id": "merch_default"
}
```

### `ReportsLambda` Test Payload
```json
{
  "report_type": "revenue",
  "format": "csv",
  "date_range": "7d",
  "merchant_id": "merch_default"
}
```

---

## 🔄 Local Fallback Simulation Mode

If AWS credentials are not supplied in `.env` (`AWS_ACCESS_KEY_ID`), the FastAPI backend will automatically use the **Local Lambda Simulation Layer** (`CloudEventBus.invoke_lambda_function`). All executions and outputs are persisted into the MongoDB `lambda_executions` collection, allowing you to test full end-to-end workflows offline.
