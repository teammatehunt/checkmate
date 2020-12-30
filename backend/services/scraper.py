import asyncio
from collections import defaultdict
import json

from celery.utils.log import get_task_logger
from django.conf import settings

import aiohttp
from bs4 import BeautifulSoup

from structure import models

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
    def __init__(self, hunt_config):
        self.session = Session.instance()
        self.hunt_config = hunt_config

    async def login(self):
        login_page = self.hunt_config.login_page
        headers = {}
        if login_page:
            headers['Referrer'] = login_page
        payload = {
            username: settings.SECRETS['LOGIN']['username'],
            password: settings.SECRETS['LOGIN']['password'],
        }
        login_api = self.hunt_config.login_api_endpoint
        if not login_api:
            raise RuntimeError('Cannot login without knowing the login endpoint.')
        async with self.session.post(
            login_api,
            data=payload,
            headers=headers,
        ) as resp:
            resp.raise_for_status()

    async def try_fetch(self):
        puzzles_page = self.hunt_config.puzzles_page
        async with self.session.get(
            puzzles_page,
        ) as resp:
            if resp.status == 401 or resp.status == 403:
                # 401=UNAUTHORIZED and 403=FORBIDDEN
                return None
            resp.raise_for_status()
            return await resp.text()

    async def fetch(self):
        data = await self.try_fetch()
        if data is None:
            await self.login()
            data = await self.try_fetch()
        if data is None:
            raise RuntimeError('Could not fetch puzzles page')
        return data


async def fetch_site_data():
    '''This function should return a dict of
    {
        'rounds': Round[],
        'puzzles': Puzzle[],
    }
    '''
    hunt_config = models.HuntConfig.get()
    if not hunt_config.puzzles_page:
        return
    client = Client(hunt_config)
    data = await client.fetch()
    json_data = None
    try:
        json_data = json.loads(data)
    except:
        pass
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
    results = defaultdict(list)
    for land in data.get('lands', []):
        round_name = land['title']
        round_link = land['url']
        results['rounds'].append({
            'name': round_name,
            'link': round_link,
        })
        for puzzle in land.get('puzzles', []):
            puzzle_name = puzzle['title']
            puzzle_link = puzzle['url']
            results['puzzles'].append({
                'name': puzzle_name,
                'link': puzzle_link,
                'round_names': [round_name],
            })
    return results

def parse_html(soup):
    # MH 2012
    results = defaultdict(list)
    for h2 in soup.find_all('h2'):
        table = h2.find_next_sibling('table')
        if table is not None:
            round_name = h2.string
            _round = {}
            _round['name'] = round_name
            for a in table.find_all('a'):
                if a.string == 'Round page':
                    _round['link'] = a.get('href')
                else:
                    puzzle = {}
                    puzzle['name'] = a.string
                    puzzle['link'] = a.get('href')
                    puzzle['round_names'] = [round_name]
                    results['puzzles'].append(puzzle)
            results['rounds'].append(_round)
    return results
