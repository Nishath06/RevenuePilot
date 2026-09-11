"""
RevenuePilot AI — Report Service Alias Wrapper
Re-exports ReportsService from app.services.reports_service for Deliverable Compatibility.
"""
from app.services.reports_service import ReportsService, reports_service

report_service = reports_service
