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
            # Django sites usually call the formfield CSRF token csrfmiddlewaretoken
            csrftoken = soup.find('input', {'name': 'csrfmiddlewaretoken'}).get('value')
        login_api = self.bot_config.login_api_endpoint
        if login_api:
            payload = {
                'team': settings.SECRETS['LOGIN']['username'],
                'pass': settings.SECRETS['LOGIN']['password'],
            }
            if csrftoken is not None:
                payload['csrfmiddlewaretoken'] = csrftoken
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
    return scraper_examples.parse_html_mh21(soup)
