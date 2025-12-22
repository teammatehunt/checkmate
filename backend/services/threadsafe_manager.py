import asyncio
import threading


class ThreadsafeManager:
    __main_instance = None
    __thread_instance = None
    __thread = None

    def __init__(self, loop):
        self.loop = loop

    @classmethod
    def instance(cls):
        """
        Get a threadsafe instance.
        """
        if threading.current_thread() is threading.main_thread():
            if cls.__main_instance is None:
                cls.__main_instance = cls(asyncio.get_event_loop())
            return cls.__main_instance
        else:
            if cls.__thread_instance is None:
                cls.__thread_instance = cls(asyncio.new_event_loop())

                def f():
                    asyncio.set_event_loop(cls.__thread_instance.loop)
                    cls.__thread_instance.loop.run_forever()

                cls.__thread = threading.Thread(target=f)
                cls.__thread.start()
            return cls.__thread_instance

    @classmethod
    def _run_sync_threadsafe(cls, func, *args, **kwargs):
        """
        Helper function to run an async function as sync.
        Threadsafe at the cost of running its own event loop.
        This cannot be called from an async context.
        """
        mgr = cls.instance()
        return asyncio.run_coroutine_threadsafe(
            func(mgr, *args, **kwargs), mgr.loop
        ).result()
