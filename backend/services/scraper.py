import json

from celery.utils.log import get_task_logger

from bs4 import BeautifulSoup

from structure import models
from services import scraper_examples
from services import scraper_types

logger = get_task_logger(__name__)


class NotConfiguredError(RuntimeError):
    pass


async def fetch_site_data() -> scraper_types.Hunt:
    """
    This should return a screaper_types.Hunt.

    Raises:
      NotConfiguredError: if the puzzles page is not configured
    """
    bot_config = models.BotConfig.get()
    if not bot_config.puzzles_page:
        logger.warning("Puzzle page not configured")
        raise NotConfiguredError("Site data not configured for autocreation task")
    client = scraper_types.Client(bot_config)
    """
    data = await client.fetch()
    json_data = None
    try:
        json_data = json.loads(data)
    except:
        pass
    if json_data is not None:
        return parse_json(json_data)
    soup = None
    try:
        soup = BeautifulSoup(data, "html5lib")
    except Exception:
        pass
    if soup is not None:
        pass
        # return parse_html(soup)
    """
    return await async_parse(client, bot_config.puzzles_page)


# These parsers will likely need to be edited on site as the puzzle page format becomes known.


def parse_json(data) -> scraper_types.Hunt:
    return scraper_examples.parse_json_mh23(data)


def parse_html(soup: BeautifulSoup) -> scraper_types.Hunt:
    return scraper_examples.parse_html_mh21(soup)


async def async_parse(client: scraper_types.Client, url: str) -> scraper_types.Hunt:
    return await scraper_examples.parse_html_mh22(client, url)
