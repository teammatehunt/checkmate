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
from django.utils import timezone
from unidecode import unidecode

from services.celery import app
from services.discord_manager import DiscordManager
from services.google_manager import GoogleManager
from services import scraper
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

@app.task
def discord_initiate_gateway():
    '''
    Should be called on startup if bots need to post messages directly (not
    counting webhooks).
    '''
    asyncio.get_event_loop().run_until_complete(
        DiscordManager.initiate_gateway())

@app.task
def post_autodetected_solve_puzzle(slug):
    pass

@app.task
def post_solve_puzzle(slug):
    cleanup_puzzle.apply_async(args=[slug], countdown=5*60.)
    bot_config = models.BotConfig.get()
    puzzle = models.Puzzle.objects.prefetch_related('rounds').get(pk=slug)
    asyncio.get_event_loop().run_until_complete(
        async_post_solve_puzzle(puzzle, bot_config))

async def async_post_solve_puzzle(puzzle, bot_config):
    solve_prefix = '♔'
    dmgr = DiscordManager.instance()
    if puzzle.discord_text_channel_id is not None:
        await dmgr.rename_channel(puzzle.discord_text_channel_id, f'{solve_prefix}{puzzle.slug}')
    if bot_config.alert_solved_puzzle_webhook:
        session = await dmgr.get_session()
        # NB: puzzle needs to have had prefetched_related('rounds')
        rounds = ', '.join(_round.name for _round in puzzle.rounds.all())
        prefix = f'[{rounds}]: ' if rounds else ''
        checkmate_link = models.Puzzle.get_link(puzzle.slug)
        await session.post(
            bot_config.alert_solved_puzzle_webhook,
            json={
                'content': f'{prefix}**[{puzzle.name}]({checkmate_link})** was {puzzle.status}!',
            },
        )

@app.task
def cleanup_puzzle(slug):
    'Cleanup discord actions.'
    puzzle = models.Puzzle.objects.get(pk=slug)
    if puzzle.is_solved():
        asyncio.get_event_loop().run_until_complete(async_cleanup_puzzle(puzzle))

async def async_cleanup_puzzle(puzzle):
    if puzzle.discord_voice_channel_id is not None:
        dmgr = DiscordManager.instance()
        await dmgr.move_members_to_afk(puzzle.discord_voice_channel_id)
        await dmgr.delete_channel(puzzle.discord_voice_channel_id)
        puzzle.discord_voice_channel_id = None
        await database_sync_to_async(puzzle.save)(update_fields=['discord_voice_channel_id'])

@app.task
def unsolve_puzzle(slug):
    'Delayed check to reset puzzle solve status.'
    puzzle = models.Puzzle.objects.get(pk=slug)
    if not puzzle.is_solved() and puzzle.solved is not None:
        puzzle.solved = None
        puzzle.save(update_fields=['solved'])
        if puzzle.discord_text_channel_id is not None:
            dmgr = DiscordManager.instance()
            asyncio.get_event_loop().run_until_complete(
                dmgr.rename_channel(puzzle.discord_text_channel_id, slug))

@app.task
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
        discord_category_id=None,
):
    name = name.strip()
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
    creating = puzzle is None or (force and (timezone.localtime() - puzzle.created) > timedelta(minutes=1))
    if creating:
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
            except Exception as e:
                logger.warning(f'Could not create relation RoundPuzzle(round_id={_round}, puzzle_id={puzzle.pk}): {e.__class__.__name__}: {e}')
            else:
                if discord_category_id is None:
                    discord_category_id = models.Round.objects.get(pk=_round).discord_category_id
    populate_puzzle(
        puzzle=puzzle,
        created=creating,
        sheet=sheet,
        text=text,
        voice=voice,
        hunt_root=hunt_root,
        discord_category_id=discord_category_id,
    )

@app.task
def populate_puzzle(
        puzzle=None,
        slug=None,
        created=False,
        hunt_root=None,
        discord_category_id=None,
        **kwargs,
):
    bot_config = models.BotConfig.get()
    webhook = bot_config.alert_new_puzzle_webhook if created else None
    if hunt_root is None:
        hunt_root = models.HuntConfig.get().root
    if puzzle is None or webhook:
        puzzle = models.Puzzle.objects.prefetch_related('rounds').get(pk=slug or puzzle.slug)
    if discord_category_id is None and (kwargs.get('text') or kwargs.get('voice')):
        discord_category_id = bot_config.default_category_id
    asyncio.get_event_loop().run_until_complete(async_populate_puzzle(
        puzzle,
        hunt_root=hunt_root,
        webhook=webhook,
        discord_category_id=discord_category_id,
        **kwargs,
    ))

async def async_populate_puzzle(
    puzzle,
    *,
    hunt_root,
    webhook=None,
    sheet=True,
    text=True,
    voice=True,
    discord_category_id=None,
):
    discord_manager = DiscordManager.instance()
    google_manager = GoogleManager.instance()

    checkmate_link = models.Puzzle.get_link(puzzle.slug)
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
            parent_id=discord_category_id,
        )
    keys, values = zip(*tasks.items()) if tasks else ((), ())
    _results = await asyncio.gather(*values, return_exceptions=True)
    results = dict(zip(keys, _results))
    sheet_id = results.get('sheet')
    if isinstance(sheet_id, Exception):
        logger.error(f'Sheets Creation Error: {repr(sheet_id)}')
        sheet_id = None
    update_fields = []
    if sheet_id is not None:
        puzzle.sheet_link = f'https://docs.google.com/spreadsheets/d/{sheet_id}'
        update_fields.append('sheet_link')
    results_discord = results.get('discord', {})
    discord_text_channel_id = results_discord.get('text')
    discord_voice_channel_id = results_discord.get('voice')
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
        try:
            await google_manager.add_links(
                sheet_id,
                checkmate_link=checkmate_link,
                puzzle_link=puzzle.link,
            )
        except Exception as e:
            logger.error(f'Sheets Edit Error: {repr(e)}')
    if webhook:
        session = await discord_manager.get_session()
        # NB: puzzle needs to have had prefetched_related('rounds')
        rounds = ', '.join(_round.name for _round in puzzle.rounds.all())
        prefix = f'[{rounds}]: ' if rounds else ''
        checkmate_link = models.Puzzle.get_link(puzzle.slug)
        await session.post(
            webhook,
            json={
                'content': f'{prefix}**[{puzzle.name}]({checkmate_link})**',
            },
        )

@app.task
def create_round(
        *,
        name,
        link=None,
        **kwargs):
    name = name.strip()
    _round, _ = models.Round.objects.get_or_create(name=name, **({} if link is None else {'link': link}), hidden=False, defaults=kwargs)
    if _round.discord_category_id is None:
        discord_category_ids = list(models.Round.objects.values_list('discord_category_id', flat=True))
        # create discord category
        discord_manager = DiscordManager.instance()
        # round setup needs to happen immediately so it is available before puzzle creation
        _round.discord_category_id = asyncio.get_event_loop().run_until_complete(
            discord_manager.create_category(
                _round.slug, discord_category_ids=discord_category_ids))
        _round.save(update_fields=['discord_category_id'])
    round_dict = {key: getattr(_round, key) for key in api.BaseRoundSerializer().fields.keys()}
    return round_dict

@app.task
def auto_create_new_puzzles(dry_run=True, manual=True):
    bot_config = models.BotConfig.get()
    enable_scraping = models.BotConfig.get().enable_scraping
    if not manual and not bot_config.enable_scraping:
        return
    site_data = asyncio.get_event_loop().run_until_complete(scraper.fetch_site_data())
    if site_data is scraper.NOT_CONFIGURED:
        return
    if not site_data:
        logger.error(f'No data was parsed from autocreation task: {site_data}')
        return
    site_rounds = site_data.get('rounds', [])
    site_puzzles = site_data.get('puzzles', [])
    if not site_rounds and not site_puzzles:
        return
    data = api.data_everything()
    hunt_root = data['hunt']['root']
    now = timezone.now()
    new_data = defaultdict(list)

    puzzles_page = bot_config.puzzles_page
    if not puzzles_page.startswith(hunt_root) or '/' in puzzles_page[len(hunt_root):].lstrip('/'):
        # links may not be relative, so convert
        for site_round in site_rounds:
            link = site_round.get('link')
            if link is not None and '://' not in link and not link.startswith('/'):
                site_round['link'] = urljoin(puzzles_page, link)
        for site_puzzle in site_puzzles:
            link = site_puzzle.get('link')
            if link is not None and '://' not in link and not link.startswith('/'):
                site_puzzle['link'] = urljoin(puzzles_page, link)

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
    round_slugs_to_discord_category_ids = {
        slug: _round['discord_category_id'] for slug, _round in data['rounds'].items()
    }

    discord_manager = None
    for site_round in site_rounds:
        if reduced_name(site_round['name']) in reduced_round_names_to_slugs:
            continue
        if site_round.get('link') and canonical_link(site_round['link'], hunt_root) in canonical_round_links_to_slugs:
            continue
        # create round
        if dry_run:
            round_name = site_round['name']
            round_slug = slugify(round_name)
        else:
            round_dict = create_round(**site_round)
            round_slugs_to_discord_category_ids[round_dict['slug']] = round_dict['discord_category_id']
            round_name = round_dict['name']
            round_slug = round_dict['slug']
            try:
                create_puzzle.delay(
                    discord_category_id=round_dict['discord_category_id'],
                    name=round_dict['name'],
                    link=round_dict['link'],
                    rounds=[round_dict['slug']],
                    is_meta=True,
                )
            except Excetion as e:
                logger.error(e)
        new_data['rounds'].append(site_round)
        reduced_round_names_to_slugs[reduced_name(round_name)] = round_slug
    for site_puzzle in site_puzzles:
        # new puzzles are setup asynchronously
        round_names = site_puzzle.pop('round_names', None)
        is_solved = site_puzzle.pop('is_solved', None)
        answer = site_puzzle.pop('answer', None)
        if round_names is not None:
            site_puzzle['rounds'] = [reduced_round_names_to_slugs[reduced_name(name)] for name in round_names]
        slug = canonical_puzzle_links_to_slugs.get(canonical_link(site_puzzle['link'], hunt_root))
        if slug is None:
            # create puzzle
            if not dry_run:
                discord_category_id = None
                if site_puzzle['rounds']:
                    first_round = site_puzzle['rounds'][0]
                    discord_category_id = round_slugs_to_discord_category_ids.get(first_round)
                create_puzzle.delay(discord_category_id=discord_category_id, **site_puzzle)
            new_data['puzzles'].append(site_puzzle)
        else:
            # check for updated solved / answer status
            puzzle = data['puzzles'][slug]
            updates = {}
            if is_solved and not puzzle['solved']:
                updates['solved'] = now
            if answer is not None and answer != puzzle['answer']:
                updates['answer'] = answer
            if updates and not dry_run:
                puzzle_obj = models.Puzzle.objects.get(pk=slug)
                for key, value in updates.items():
                    setattr(puzzle_obj, key, value)
                puzzle_obj.save(update_fields=updates.keys())
                if updates.get('solved') is not None:
                    post_autodetected_solve_puzzle.delay(slug)
    if new_data or manual:
        logger.warning({
            'new_data': new_data,
            'manual': manual,
            'dry_run': dry_run,
        })
    return new_data
