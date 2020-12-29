import asyncio
from collections import defaultdict
from datetime import timedelta
import itertools
import re
from urllib.parse import urljoin, urlsplit, urlunsplit

from autoslug.settings import slugify
from celery.utils.log import get_task_logger
from channels.db import database_sync_to_async
from django.conf import settings
from django.db import transaction
from django.db.models.functions import Now
from django.utils import timezone
from unidecode import unidecode

from services.celery import app
from services.discord_manager import DiscordManager
from services.google_manager import GoogleManager
from services.scraper import fetch_site_data
from structure import api, models
import structure.consumers # for activating update hooks

logger = get_task_logger(__name__)

def canonical_link_pair(link, hunt_root=''):
    'Returns (canonical_link, relative_path)'
    link = link.rstrip('/')
    url = urlsplit(link)
    url_root = url[:2] + ('',) * (len(url) - 2)
    url_suffix = ('',) * 2 + url[2:]
    root = urlunsplit(url_root)
    suffix = urlunsplit(url_suffix)
    if root == '' or root == hunt_root.rstrip('/'):
        return f'/{suffix.lstrip("/")}', True
    else:
        return link, False

def canonical_link(*args, **kwargs):
    _canonical_link, _ = canonical_link_pair(*args, **kwargs)
    return _canonical_link

alphanumeric_regex = re.compile('[\W_]+', re.UNICODE)
def reduced_name(name):
    return alphanumeric_regex.sub('', unidecode(name)).lower()

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
        is_meta=None,
        sheet=True,
        text=True,
        voice=True,
        force=False,
):
    hunt_root = models.HuntConfig.get().root
    _canonical_link, relpath = canonical_link_pair(link, hunt_root)
    # Construct a regex for resolving the root optionally and stripping trailing slashes
    if relpath and hunt_root:
        hunt_root_stripped = hunt_root.rstrip('/')
        link_stripped = hunt_root.lstrip('/')
        link_regex = f"^(({re.escape(hunt_root_stripped)})?/)?{re.escape(link_stripped)}/*$"
    else:
        link_regex = f"^{re.escape(_canonical_link)}/*$"
    puzzle = models.Puzzle.objects.filter(link__regex=link_regex, hidden=False).last()
    # If a puzzle with the same link exists and the force flag is not set, or
    # if the puzzle was created in the past minute, assume this is a duplicate
    # request.
    if puzzle is None or (force and (timezone.localtime() - puzzle.created) > timedelta(minutes=1)):
        puzzle_kwargs = {
            'name': name,
            'link': link,
        }
        if is_meta is not None:
            puzzle_kwargs['is_meta'] = is_meta
        puzzle = models.Puzzle(**puzzle_kwargs)
        puzzle.save()
    if rounds:
        for _round in rounds:
            try:
                models.RoundPuzzle.objects.get_or_create(round_id=_round, puzzle_id=puzzle.pk)
            except:
                logger.warning(f'Could not create relation RoundPuzzle(round_id={_round}, puzzle_id={puzzle.pk})')
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


@app.task
def auto_create_new_puzzles(dry_run=True):
    enable_scraping = models.HuntConfig.get().enable_scraping
    if not dry_run and not enable_scraping:
        return
    site_data = asyncio.get_event_loop().run_until_complete(fetch_site_data())
    if not site_data:
        logger.warning('No data was parsed from autocreaton task')
        return
    site_rounds = site_data.get('rounds', [])
    site_puzzles = site_data.get('puzzles', [])
    if not site_rounds and not site_puzzles:
        return
    data = api.data_everything()
    hunt_root = data['hunt']['root']
    now = Now()

    reduced_round_names_to_slugs = {
        reduced_name(_round['name']): slug
        for slug, _round in data['rounds'].items() if not _round['hidden']
    }
    canonical_round_links_to_slugs = {
        canonical_link(link, hunt_root): slug
        for link, slug in (*((_round['original_link'], slug) for slug, _round in data['rounds'].items()),
                           *((_round['link'], slug) for slug, _round in data['rounds'].items() if not _round['hidden']))
    }
    canonical_puzzle_links_to_slugs = {
        canonical_link(link, hunt_root): slug
        for link, slug in (*((puzzle['original_link'], slug) for slug, puzzle in data['puzzles'].items()),
                           *((puzzle['link'], slug) for slug, puzzle in data['puzzles'].items() if not puzzle['hidden']))
    }

    new_data = defaultdict(list)

    for site_round in site_rounds:
        if site_round['name'] in reduced_round_names_to_slugs:
            continue
        if site_round.get('link') and canonical_link(site_round['link'], hunt_root) in canonical_round_links_to_slugs:
            continue
        if dry_run:
            round_name = site_round['name']
            round_slug = slugify(round_name)
        else:
            round_obj, _ = models.Round.objects.get_or_create(**site_round)
            round_name = round_obj.name
            round_slug = round_obj.slug
        new_data['rounds'].append(site_round)
        reduced_round_names_to_slugs[reduced_name(round_name)] = round_slug
    for site_puzzle in site_puzzles:
        round_names = site_puzzle.pop('round_names', None)
        is_solved = site_puzzle.pop('is_solved', None)
        answer = site_puzzle.pop('answer', None)
        if round_names is not None:
            site_puzzle['rounds'] = [reduced_round_names_to_slugs[reduced_name(name)] for name in round_names]
        slug = canonical_puzzle_links_to_slugs.get(canonical_link(site_puzzle['link'], hunt_root))
        if slug is None:
            # create puzzle
            if not dry_run:
                create_puzzle.delay(**site_puzzle)
            new_data['puzzles'].append(site_puzzle)
        else:
            # check for updated solved / answer status
            puzzle = data['puzzles'][slug]
            updates = {}
            if is_solved and not puzzle['solved']:
                updates['solved'] = now
            if answer != puzzle['answer']:
                updates['answer'] = answer
            if updates and not dry_run:
                puzzle_obj = models.Puzzle.get(pk=slug)
                for key, value in updates.items():
                    setattr(puzzle_obj, key, value)
                puzzle_obj.save(update_fields=updates.keys())
    if new_data:
        return new_data
