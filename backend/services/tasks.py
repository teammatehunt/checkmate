import asyncio
from datetime import timedelta
import re
from urllib.parse import urljoin, urlsplit, urlunsplit

from channels.db import database_sync_to_async
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from services.celery import app
from services.discord_manager import DiscordManager
from services.google_manager import GoogleManager
from structure import models
import structure.consumers # for activating update hooks

@app.task(
    acks_late=True,
    autoretry_for=(Exception,),
    max_retries=5,
    default_retry_delay=10,
)
def create_puzzle(
        *,
        name,
        link,
        rounds=None,
        is_meta=False,
        sheet=True,
        text=True,
        voice=True,
        force=False,
):
    hunt_root = models.HuntConfig.get().root
    url = urlsplit(link)
    url_root = url[:2] + ('',) * (len(url) - 2)
    url_suffix = ('',) * 2 + url[2:]
    root = urlunsplit(url_root)
    suffix = urlunsplit(url_suffix)
    # Construct a regex for resolving the root optionally and stripping trailing slashes
    if root == '' or root == hunt_root:
        link_regex = f"^({re.escape(hunt_root)})?{re.escape(suffix.rstrip('/'))}/*$"
    else:
        link_regex = f"^{re.escape(link.rstrip('/'))}/*$"
    puzzle = models.Puzzle.objects.filter(link__regex=link_regex, hidden=False).last()
    # If a puzzle with the same link exists and the force flag is not set, or
    # if the puzzle was created in the past minute, assume this is a duplicate
    # request.
    if puzzle is None or (force and (timezone.localtime() - puzzle.created) > timedelta(minutes=1)):
        puzzle = models.Puzzle(
            name=name,
            link=link,
            is_meta=is_meta,
        )
        puzzle.save()
    if rounds:
        for _round in rounds:
            models.RoundPuzzle.objects.get_or_create(round_id=_round, puzzle_id=puzzle.pk)
    sync_populate_puzzle(
        puzzle=puzzle,
        sheet=sheet,
        text=text,
        voice=voice,
        hunt_root=hunt_root,
    )

@app.task(
    acks_late=True,
    autoretry_for=(Exception,),
    max_retries=5,
    default_retry_delay=10,
)
def sync_populate_puzzle(
        puzzle=None,
        slug=None,
        hunt_root=None,
        **kwargs,
):
    if puzzle is None:
        puzzle = models.Puzzle.get(pk=slug)
    if hunt_root is None:
        hunt_root = models.HuntConfig.get().root
    asyncio.get_event_loop().run_until_complete(populate_puzzle(
        puzzle,
        hunt_root=hunt_root,
        **kwargs,
    ))

async def populate_puzzle(
    puzzle,
    *,
    hunt_root,
    sheet=True,
    text=True,
    voice=True,
):
    discord_manager = DiscordManager.instance()
    google_manager = GoogleManager.instance()

    checkmate_link = f'{settings.ORIGIN}/puzzles/{puzzle.slug}'
    tasks = {}
    if sheet and not puzzle.sheet_link:
        tasks['sheet'] = google_manager.create(puzzle.name)
    text &= puzzle.discord_text_channel_id is None
    voice &= puzzle.discord_voice_channel_id is None
    if text or voice:
        tasks['discord'] = discord_manager.create_channels(
            puzzle.slug,
            text=text,
            voice=voice,
            link=checkmate_link,
        )
    keys, values = zip(*tasks.items()) if tasks else ((), ())
    _results = await asyncio.gather(*values)
    results = dict(zip(keys, _results))
    sheet_id = results.get('sheet')
    update_fields = []
    if sheet_id is not None:
        puzzle.sheet_link = f'https://docs.google.com/spreadsheets/d/{sheet_id}'
        update_fields.append('sheet_link')
    discord_text_channel_id = results.get('discord', {}).get('text')
    discord_voice_channel_id = results.get('discord', {}).get('voice')
    if discord_text_channel_id is not None:
        puzzle.discord_text_channel_id = discord_text_channel_id
        update_fields.append('discord_text_channel_id')
    if discord_voice_channel_id is not None:
        puzzle.discord_voice_channel_id = discord_voice_channel_id
        update_fields.append('discord_voice_channel_id')
    if update_fields:
        await database_sync_to_async(puzzle.save)(update_fields=update_fields)
    if sheet_id is not None:
        has_origin = any(urlsplit(puzzle.link)[:2])
        if has_origin:
            puzzle_link = puzzle.link
        else:
            # str.removesuffix and str.removeprefix only added in Python 3.9
            hunt_root_stripped = hunt_root[:-1] if hunt_root.endswith('/') else hunt_root
            link_stripped = puzzle.link[1:] if puzzle.link.startswith('/') else puzzle.link
            puzzle_link = f'{hunt_root_stripped}/{link_stripped}'
        await google_manager.add_links(
            sheet_id,
            checkmate_link=checkmate_link,
            puzzle_link=puzzle.link,
        )
