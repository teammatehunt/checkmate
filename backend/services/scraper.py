import asyncio
from collections import defaultdict
import json

from celery.utils.log import get_task_logger
from django.conf import settings

import aiohttp
from bs4 import BeautifulSoup

from structure import models
from services import scraper_examples

logger = get_task_logger(__name__)

class Session:
    __instance = None

    @classmethod
    def instance(cls):
        '''
        Get a single instance per process.
        '''
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
        csrftoken = None
        if login_page:
            headers['Referer'] = login_page
            async with self.session.get(login_page) as resp:
                data = await resp.read()
            soup = BeautifulSoup(data, 'html5lib')
            csrftoken = soup.find('input', {'name': 'csrfmiddlewaretoken'}).get('value')
        payload = {
            'team': settings.SECRETS['LOGIN']['username'],
            'pass': settings.SECRETS['LOGIN']['password'],
            'csrfmiddlewaretoken': csrftoken,
        }
        login_api = self.bot_config.login_api_endpoint
        if not login_api:
            raise RuntimeError('Cannot login without knowing the login endpoint.')
        async with self.session.post(
            login_api,
            data=payload,
            headers=headers,
        ) as resp:
            resp.raise_for_status()

    async def try_fetch(self):
        puzzles_page = self.bot_config.puzzles_page
        async with self.session.get(
            puzzles_page,
        ) as resp:
            if resp.status == 401 or resp.status == 403:
                # 401=UNAUTHORIZED and 403=FORBIDDEN
                return None
            resp.raise_for_status()
            return await resp.read()

    async def fetch(self):
        await self.login()
        data = await self.try_fetch()
        if data is None:
            raise RuntimeError('Could not fetch puzzles page')
        return data

NOT_CONFIGURED = lambda: None
async def fetch_site_data():
    '''This function should return a dict of
    {
        'rounds': Round[],
        'puzzles': Puzzle[],
    }
    '''
    bot_config = models.BotConfig.get()
    if not bot_config.puzzles_page:
        logger.warning('Puzzle page not configured')
        return NOT_CONFIGURED
    client = Client(bot_config)
    data = await client.fetch()
    json_data = None
    # try:
        # json_data = json.loads(data)
    # except:
        # pass
    if json_data is not None:
        return parse_json(data)
    soup = None
    try:
        soup = BeautifulSoup(data, 'html5lib')
    except:
        pass
    if soup is not None:
        return parse_html(soup)
    raise RuntimeError('Unable to parse response')

# These parsers will likely need to be edited on site as the puzzle page format becomes known.
# Return
{
    'rounds': [
        {
            'name': '',
            'link': '',
        },
    ],
    'puzzles': [
        {
            'name': '',
            'link': '',
            'round_names': [], # optional
            'is_meta': False, # optional
            'is_solved': None, # optional
            'answer': None, # optional
        },
    ],
}

def parse_json(data):
    return scraper_examples.parse_json_mh19(data)

def parse_html(soup: BeautifulSoup):
    return parse_html_mh21(soup)

def parse_html_mh21(soup):
    # MH 2020
    results = defaultdict(list)
    main = soup.find('main')
    for section in main.find_all('section'):
        a_round = section.a
        if a_round.h3 is None:
            continue
        round_name = a_round.h3.string
        results['rounds'].append({
            'name': round_name,
            'link': a_round.get('href'),
        })
        for tr_puzzle in section.find_all('tr'):
            tds = tr_puzzle.find_all('td')
            if tds:
                if tds[0].a is None or tds[0].a.get('href') is None:
                    continue
                answer = tds[1].string.strip()
                puzzle = {
                    'name': tds[0].a.string.strip(),
                    'link': tds[0].a.get('href'),
                    'round_names': [round_name],
                    'answer': answer,
                    'is_solved': bool(answer),
                    'is_meta': 'meta' in (tr_puzzle.get('class') or []),
                }
                if round_name == 'Infinite Corridor':
                    continue
                    if ':' in puzzle['name']:
                        puzzle['name'] = puzzle['name'][puzzle['name'].find(':'):]

                results['puzzles'].append(puzzle)
    return results
