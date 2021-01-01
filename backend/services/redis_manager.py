import functools
import logging

from django.conf import settings
import redis

logger = logging.getLogger(__name__)

class RedisManager(redis.Redis):
    class RLock(redis.lock.Lock):
        def __init__(self, rmgr, redis, name, *args, **kwargs):
            super().__init__(redis, name, *args, **kwargs)
            self.__rmgr = rmgr
            self.__name = name
            self.__reentrant = None

        def __enter__(self, *args, **kwargs):
            self.__reentrant = self.__name in self.__rmgr._semaphores
            self.__rmgr._semaphore_incr(self.__name)
            if self.__reentrant:
                return None
            else:
                return super().__enter__(*args, **kwargs)

        def __exit__(self, *args, **kwargs):
            self.__rmgr._semaphore_decr(self.__name)
            if self.__reentrant:
                value = None
            else:
                value = super().__exit__(*args, **kwargs)
            self.__reentrant = None
            return value

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
        self._semaphores = {}

    def _semaphore_incr(self, name):
        self._semaphores.setdefault(name, 0)
        self._semaphores[name] += 1

    def _semaphore_decr(self, name):
        self._semaphores[name] -= 1
        if self._semaphores[name] == 0:
            del self._semaphores[name]

    def reentrant_lock(self, *args, **kwargs):
        return self.lock(*args, **kwargs, lock_class=functools.partial(RedisManager.RLock, self))
