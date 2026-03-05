import os
import redis
from typing import Optional, Any
import json

class RedisCache:
    def __init__(self):
        self.client: Optional[redis.Redis] = None
        self.enabled = False
        try:
            redis_host = os.environ.get('REDIS_HOST', 'localhost')
            redis_port = int(os.environ.get('REDIS_PORT', '6379'))
            redis_db = int(os.environ.get('REDIS_DB', '0'))
            
            self.client = redis.Redis(
                host=redis_host,
                port=redis_port,
                db=redis_db,
                decode_responses=True,
                socket_connect_timeout=2
            )
            self.client.ping()
            self.enabled = True
            print(f"Redis connected successfully at {redis_host}:{redis_port}")
        except Exception as e:
            print(f"Redis connection failed: {e}. Running without cache.")
            self.client = None
            self.enabled = False
    
    async def get(self, key: str) -> Optional[Any]:
        if not self.enabled or not self.client:
            return None
        try:
            value = self.client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            print(f"Redis GET error: {e}")
            return None
    
    async def set(self, key: str, value: Any, expire: int = 300):
        if not self.enabled or not self.client:
            return False
        try:
            self.client.setex(key, expire, json.dumps(value))
            return True
        except Exception as e:
            print(f"Redis SET error: {e}")
            return False
    
    async def delete(self, key: str):
        if not self.enabled or not self.client:
            return False
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            print(f"Redis DELETE error: {e}")
            return False
    
    async def clear_pattern(self, pattern: str):
        if not self.enabled or not self.client:
            return False
        try:
            keys = self.client.keys(pattern)
            if keys:
                self.client.delete(*keys)
            return True
        except Exception as e:
            print(f"Redis CLEAR_PATTERN error: {e}")
            return False

redis_cache = RedisCache()