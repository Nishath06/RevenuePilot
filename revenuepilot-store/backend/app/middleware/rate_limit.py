import time
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, HTTPException, status, Response

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 120, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.request_counts = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for static/docs or webhooks if needed
        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()
        
        # Clean old timestamps
        timestamps = [ts for ts in self.request_counts[client_ip] if now - ts < self.window_seconds]
        self.request_counts[client_ip] = timestamps
        
        if len(timestamps) >= self.max_requests:
            return Response(
                content='{"detail": "Rate limit exceeded. Please slow down."}',
                status_code=429,
                media_type="application/json"
            )
            
        self.request_counts[client_ip].append(now)
        return await call_next(request)
