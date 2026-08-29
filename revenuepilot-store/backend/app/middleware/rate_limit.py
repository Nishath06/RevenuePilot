import time
from collections import defaultdict
from starlette.responses import JSONResponse

class RateLimitMiddleware:
    def __init__(self, app, max_requests: int = 300, window_seconds: int = 60):
        self.app = app
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.request_counts = defaultdict(list)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        client_ip = scope.get("client", ("127.0.0.1", 0))[0] if scope.get("client") else "127.0.0.1"
        now = time.time()
        
        # Clean old timestamps
        timestamps = [ts for ts in self.request_counts[client_ip] if now - ts < self.window_seconds]
        self.request_counts[client_ip] = timestamps
        
        if len(timestamps) >= self.max_requests:
            res = JSONResponse({"detail": "Rate limit exceeded. Please slow down."}, status_code=429)
            await res(scope, receive, send)
            return

        self.request_counts[client_ip].append(now)
        await self.app(scope, receive, send)

