import dataclasses
import typing
from typing import Annotated, get_type_hints
from urllib.parse import urljoin

from celery.utils.log import get_task_logger
from django.conf import settings

import aiohttp
from bs4 import BeautifulSoup

logger = get_task_logger(__name__)


class SkipInKwargs:
    def __class_getitem__(cls, item):
        return Annotated[item, cls]


class AsKwargs:
    def as_kwargs(self):
        cls = self.__class__
        hints = get_type_hints(cls, include_extras=True)
        return {
            k: v
            for k, v in dataclasses.asdict(self).items()
            if v not in (None, "")
            and not any(
                m is SkipInKwargs for m in getattr(hints.get(k), "__metadata__", [])
            )
        }


@dataclasses.dataclass(kw_only=True)
class Round(AsKwargs):
    name: str
    link: str = ""


@dataclasses.dataclass(kw_only=True)
class Puzzle(AsKwargs):
    name: str
    link: str
    round_names: SkipInKwargs[list[str] | None] = None
    is_meta: bool | None = None
    is_solved: SkipInKwargs[bool | None] = None
    answer: SkipInKwargs[str] = ""
    notes: str = ""


@dataclasses.dataclass(kw_only=True)
class Hunt:
    rounds: list[Round] = dataclasses.field(default_factory=list)
    puzzles: list[Puzzle] = dataclasses.field(default_factory=list)


class Session:
    __instance = None

    @classmethod
    def instance(cls):
        """
        Get a single instance per process.
        """
        if cls.__instance is None:
            cls.__instance = aiohttp.ClientSession()
        return cls.__instance

    @classmethod
    async def close(cls):
        if cls.__instance is not None:
            await cls.__instance.close()
            cls.__instance = None


class Client:
    def __init__(self, bot_config):
        self.session = Session.instance()
        self.bot_config = bot_config

    async def login(self):
        login_page = self.bot_config.login_page
        headers = {}
        csrftoken_name = "csrfmiddlewaretoken"
        csrftoken = None
        if login_page:
            headers["Referer"] = login_page
            async with self.session.get(
                login_page,
                allow_redirects=False,
            ) as resp:
                if resp.status == 302:
                    # Assume redirects mean we are already logged in
                    return
                data = await resp.read()
            soup = BeautifulSoup(data, "html5lib")
            # Django sites usually call the formfield CSRF token csrfmiddlewaretoken
            csrftoken = (soup.find("input", {"name": csrftoken_name}) or {}).get(
                "value"
            )
        login_api = self.bot_config.login_api_endpoint
        if login_api:
            payload = {
                "username": settings.SECRETS["LOGIN"]["username"],
                "password": settings.SECRETS["LOGIN"]["password"],
            }
            if csrftoken is not None:
                payload[csrftoken_name] = csrftoken
            async with self.session.post(
                login_api,
                data=payload,
                headers=headers,
            ) as resp:
                resp.raise_for_status()
            if self.bot_config.login_followup_endpoint:
                async with self.session.get(
                    self.bot_config.login_followup_endpoint,
                ) as resp:
                    resp.raise_for_status()

    async def try_fetch(self, puzzles_page=None):
        if puzzles_page is None:
            puzzles_page = self.bot_config.puzzles_page
        else:
            puzzles_page = urljoin(self.bot_config.puzzles_page, puzzles_page)
        async with self.session.get(
            puzzles_page,
        ) as resp:
            resp.raise_for_status()
            return await resp.read()

    async def fetch(self):
        await self.login()
        data = await self.try_fetch()
        if data is None:
            raise RuntimeError("Could not fetch puzzles page")
        return data
