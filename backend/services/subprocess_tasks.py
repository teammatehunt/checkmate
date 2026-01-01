import dataclasses
import traceback

import billiard
from celery.utils.log import get_task_logger
import django

from services.celery import app

logger = get_task_logger(__name__)


@dataclasses.dataclass
class NewPuzzlesResult:
    data: dict | None
    # traceback is split by lines to be displayed nicely in the Django REST API view.
    traceback: list[str] | None


def try_create_new_puzzles(queue: billiard.Queue, **kwargs):
    django.setup()
    from services import tasks

    data = None
    tb = None
    try:
        data = tasks.auto_create_new_puzzles(**kwargs)
    except Exception:
        tb = traceback.format_exc().splitlines()
    finally:
        queue.put(
            NewPuzzlesResult(
                data=data,
                traceback=tb,
            )
        )


@app.task
def subprocess_create_new_puzzles(dry_run=True, manual=True) -> NewPuzzlesResult:
    """Calls try_create_new_puzzles in a new process to reload imports."""
    ctx = billiard.get_context("spawn")
    queue: billiard.Queue[NewPuzzlesResult] = ctx.Queue()
    proc = ctx.Process(
        target=try_create_new_puzzles,
        kwargs={
            "queue": queue,
            "dry_run": dry_run,
            "manual": manual,
        },
    )
    proc.start()
    proc.join()
    return queue.get(block=False)
