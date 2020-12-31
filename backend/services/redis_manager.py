from django.conf import settings
import redis

class RedisManager(redis.Redis):
    __instance = None

    @classmethod
    def instance(cls):
        '''
        Get a single instance per process.
        '''
        if cls.__instance is None:
            cls.__instance = cls()
        return cls.__instance

    def __init__(self):
        super().__init__(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DATABASE_ENUM.REDIS_CLIENT,
        )
