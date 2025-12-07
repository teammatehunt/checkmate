import asyncio
from collections import defaultdict
import datetime
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

non_alphanumeric_regex = re.compile(r'[\W_]+', re.UNICODE)
def reduced_name(name):
    return non_alphanumeric_regex.sub('', unidecode(name)).lower()

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
    puzzle = models.Puzzle.objects.prefetch_related('rounds', 'metas__feeders').get(pk=slug)
    # unblock metas where all feeders are solved
    unblocked_metas = []
    for meta in puzzle.metas.all():
        if meta.status == models.Puzzle.BLOCKED_STATUS:
            solved = 0
            unsolved = 0
            for feeder in meta.feeders.all():
                if feeder.is_solved():
                    solved += 1
                else:
                    unsolved += 1
            if solved and not unsolved:
                meta.status = ''
                unblocked_metas.append(meta)
    models.Puzzle.objects.bulk_update(unblocked_metas, ['status'])
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
def create_locked_puzzle(name, notes, round_names):
    bot_config = models.BotConfig.get()
    asyncio.get_event_loop().run_until_complete(
        async_create_locked_puzzle(name, notes, round_names, bot_config))
    models.LockedPuzzle.objects.create(name=name, notes=notes)

@app.task
async def async_create_locked_puzzle(name, description, round_names, bot_config):
    dmgr = DiscordManager.instance()
    round_name = ', '.join(round_names)
    if bot_config.alert_locked_puzzle_webhook:
        session = await dmgr.get_session()
        await session.post(
            bot_config.alert_locked_puzzle_webhook,
            json={
                'content': f'Discovered a puzzle!\n**{name}** ({round_name})\n{description}',
            },
        )

@app.task
def post_update_placeholder_puzzle(slug):
    bot_config = models.BotConfig.get()
    puzzle = models.Puzzle.objects.prefetch_related('rounds').get(pk=slug)
    asyncio.get_event_loop().run_until_complete(
        async_post_update_placeholder_puzzle(puzzle, bot_config))

async def async_post_update_placeholder_puzzle(puzzle, bot_config):
    discord_manager = DiscordManager.instance()
    google_manager = GoogleManager.instance()
    sheet_id = puzzle.sheet_link.split('/')[-1]
    if sheet_id:
        logger.warn(f'renaming to: {puzzle.name}')
        await google_manager.rename(sheet_id, puzzle.long_name)
    if bot_config.alert_new_puzzle_webhook:
        session = await discord_manager.get_session()
        # NB: puzzle needs to have had prefetched_related('rounds')
        rounds = ', '.join(_round.name for _round in puzzle.rounds.all())
        prefix = f'[{rounds}]: ' if rounds else ''
        checkmate_link = models.Puzzle.get_link(puzzle.slug)
        await session.post(
            bot_config.alert_new_puzzle_webhook,
            json={
                'content': f'{prefix}**[{puzzle.long_name}]({checkmate_link})**',
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
    is_placeholder=None,
    sheet=True,
    text=True,
    voice=True,
    notes='',
    force=False,
    discord_category_id=None,
):
    name = name.strip()
    hunt_config = models.HuntConfig.get()
    hunt_root = hunt_config.root
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
    creating = puzzle is None or (force and (timezone.localtime() - puzzle.created) > datetime.timedelta(minutes=1))
    if creating:
        puzzle_kwargs = {
            'name': name,
            'link': link,
        }
        if is_meta is not None:
            puzzle_kwargs['is_meta'] = is_meta
        if is_placeholder is not None:
            puzzle_kwargs['is_placeholder'] = is_placeholder
        if notes:
            puzzle_kwargs['notes'] = notes
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
    if puzzle.is_meta and hunt_config.block_metas_on_feeders:
        # initialize status of metas to blocked unless all feeders are solved
        solved = 0
        unsolved = 0
        # NB: use filter() to force fetch feeders after meta-feeder relations have been saved
        for feeder in puzzle.feeders.filter():
            if feeder.is_solved():
                solved += 1
            else:
                unsolved += 1
        if unsolved or not solved:
            puzzle.status = models.Puzzle.BLOCKED_STATUS
            puzzle.save(update_fields=['status'])
    populate_puzzle(
        puzzle=puzzle,
        created=creating,
        sheet=sheet,
        text=text,
        voice=voice,
        hunt_config=hunt_config,
        discord_category_id=discord_category_id,
    )

@app.task
def populate_puzzle(
    puzzle=None,
    slug=None,
    created=False,
    hunt_config=None,
    discord_category_id=None,
    **kwargs,
):
    bot_config = models.BotConfig.get()
    webhook = bot_config.alert_new_puzzle_webhook if created else None
    if hunt_config is None:
        hunt_config = models.HuntConfig.get()
    sheet_owner = models.GoogleSheetOwner.get()
    hunt_root = hunt_config.root
    if puzzle is None or webhook:
        puzzle = models.Puzzle.objects.prefetch_related('rounds').get(pk=slug or puzzle.slug)
    if discord_category_id is None and (kwargs.get('text') or kwargs.get('voice')):
        discord_category_id = bot_config.default_category_id
    updated_user_creds = asyncio.get_event_loop().run_until_complete(async_populate_puzzle(
        puzzle,
        hunt_config=hunt_config,
        sheet_owner=sheet_owner,
        webhook=webhook,
        discord_category_id=discord_category_id,
        **kwargs,
    ))
    if updated_user_creds is not None:
        new_access_token = updated_user_creds.access_token
        if new_access_token != sheet_owner.access_token:
            (
                models.GoogleSheetOwner.objects
                .filter(refresh_token=sheet_owner.refresh_token)
                .update(
                    access_token=new_access_token,
                    expires_at=datetime.datetime.fromisoformat(updated_user_creds.expires_at).replace(tzinfo=datetime.timezone.utc),
                )
            )

async def async_populate_puzzle(
    puzzle,
    *,
    hunt_config,
    sheet_owner=None,
    webhook=None,
    sheet=True,
    text=True,
    voice=True,
    discord_category_id=None,
):
    discord_manager = DiscordManager.instance()
    google_manager = GoogleManager.instance()
    updated_user_creds = None

    hunt_root = hunt_config.root
    checkmate_link = models.Puzzle.get_link(puzzle.slug)
    tasks = {}
    if sheet and not puzzle.sheet_link:
        tasks['sheet'] = google_manager.create(puzzle.long_name, sheet_owner)
    text &= hunt_config.enable_discord_channels
    text &= puzzle.discord_text_channel_id is None
    voice &= hunt_config.enable_discord_channels
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
    sheet_data = results.get('sheet', {})
    if isinstance(sheet_data, Exception):
        logger.error(f'Sheets Creation Error: {repr(sheet_data)}')
        sheet_id = None
    else:
        sheet_id = sheet_data.get('sheet_id')
        updated_user_creds = sheet_data.get('updated_user_creds')
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
                puzzle_link=puzzle_link,
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
                'content': f'{prefix}**[{puzzle.long_name}]({checkmate_link})**',
            },
        )
    return updated_user_creds

@app.task
def create_round(
    *,
    name,
    link=None,
    enable_discord_channels=None,
    create_placeholder=True,
    **kwargs,
):
    if enable_discord_channels is None:
        enable_discord_channels = models.HuntConfig.get().enable_discord_channels
    name = name.strip()
    _round, _ = models.Round.objects.get_or_create(name=name, **({} if link is None else {'link': link}), hidden=False, defaults=kwargs)
    if enable_discord_channels and _round.discord_category_id is None:
        discord_category_ids = list(models.Round.objects.values_list('discord_category_id', flat=True))
        # create discord category
        discord_manager = DiscordManager.instance()
        # round setup needs to happen immediately so it is available before puzzle creation
        _round.discord_category_id = asyncio.get_event_loop().run_until_complete(
            discord_manager.create_category(
                _round.slug, discord_category_ids=discord_category_ids))
        _round.save(update_fields=['discord_category_id'])
    round_dict = {key: getattr(_round, key) for key in api.BaseRoundSerializer().fields.keys()}
    if create_placeholder:
        # create meta placeholder
        create_puzzle.delay(
            discord_category_id=_round.discord_category_id,
            name=_round.name,
            link=_round.link,
            rounds=[_round.slug],
            is_meta=True,
            is_placeholder=True,
        )
    return round_dict

@app.task
def auto_create_new_puzzles(dry_run=True, manual=True):
    bot_config = models.BotConfig.get()
    enable_scraping = models.BotConfig.get().enable_scraping
    if not manual and not bot_config.enable_scraping:
        return
    site_data = asyncio.get_event_loop().run_until_complete(scraper.fetch_site_data())
    if site_data is scraper.NOT_CONFIGURED:
        logger.error(f'Site data not configured for autocreation task')
        return
    if not site_data:
        logger.error(f'No data was parsed from autocreation task')
        return
    site_rounds = site_data.get('rounds', [])
    site_puzzles = site_data.get('puzzles', [])
    if not site_rounds and not site_puzzles:
        return
    data = api.data_everything()
    hunt_root = data['hunt']['root']
    enable_discord_channels = data['hunt']['enable_discord_channels']
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

    placeholder_metas = {} # round -> puzzle
    placeholder_metas_lists = defaultdict(list)
    for puzzle in data['puzzles'].values():
        if puzzle['is_meta'] and puzzle['is_placeholder']:
            for _round in puzzle['rounds']:
                placeholder_metas_lists[_round].append(puzzle)
    for round_slug, puzzles in placeholder_metas_lists.items():
        if len(puzzles) == 1:
            placeholder_metas[round_slug] = puzzles[0]

    fetched_metas_by_round = defaultdict(list)
    for site_puzzle in site_puzzles:
        if site_puzzle.get('is_meta'):
            round_names = site_puzzle.get('round_names', [])
            for round_name in round_names:
                fetched_metas_by_round[round_name].append(site_puzzle)

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
            round_name = site_round['name']
            create_placeholder = not fetched_metas_by_round[round_name]
            round_dict = create_round(
                **site_round,
                enable_discord_channels=enable_discord_channels,
                create_placeholder=create_placeholder,
            )
            round_slugs_to_discord_category_ids[round_dict['slug']] = round_dict['discord_category_id']
            round_slug = round_dict['slug']
            if create_placeholder:
                new_data['placeholder-metas'].append(round_slug)
        new_data['rounds'].append(site_round)
        reduced_round_names_to_slugs[reduced_name(round_name)] = round_slug
    for site_puzzle in site_puzzles:
        # new puzzles are setup asynchronously
        round_names = site_puzzle.pop('round_names', None)
        is_solved = site_puzzle.pop('is_solved', None)
        answer = site_puzzle.pop('answer', None)
        link = site_puzzle.get('link')
        if round_names is not None:
            site_puzzle['rounds'] = [reduced_round_names_to_slugs[reduced_name(name)] for name in round_names]
        link = site_puzzle.get('link')
        if link is None:
            # MH25 locked puzzles
            if not models.LockedPuzzle.objects.filter(name=site_puzzle['name']).exists():
                if not dry_run:
                    create_locked_puzzle(site_puzzle['name'], site_puzzle.get('notes'), round_names)
            continue
        slug = canonical_puzzle_links_to_slugs.get(canonical_link(site_puzzle['link'], hunt_root))
        if slug is None:
            # create puzzle
            placedholder_puzzle = None
            if site_puzzle.get('is_meta'):
                site_puzzle_rounds = site_puzzle.get('rounds')
                if isinstance(site_puzzle_rounds, list) and len(site_puzzle_rounds) == 1:
                    placedholder_puzzle = placeholder_metas.get(site_puzzle_rounds[0])
            if placedholder_puzzle:
                slug = placedholder_puzzle['slug']
                if not dry_run:
                    puzzle_obj = models.Puzzle.objects.filter(pk=slug).update(
                        name=site_puzzle['name'],
                        link=site_puzzle['link'],
                        original_link=site_puzzle['link'],
                        is_placeholder=False,
                    )
                    post_update_placeholder_puzzle.delay(slug)
                new_data['placeholder-metas-updated'].append(site_round)
            else:
                discord_category_id = None
                if site_puzzle.get('rounds'):
                    first_round = site_puzzle['rounds'][0]
                    discord_category_id = round_slugs_to_discord_category_ids.get(first_round)
                if not dry_run:
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
            # MH25
            if link is not None and puzzle.get('link') is None:
                updates['link'] = link
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
