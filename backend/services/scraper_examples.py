from collections import defaultdict
import json

from celery.utils.log import get_task_logger

from bs4 import BeautifulSoup, NavigableString

logger = get_task_logger(__name__)

def parse_json_mh19(data):
    # MH 2019 when live
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

def parse_html_mh12(soup):
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

def parse_html_gph17(soup):
    # Galact Puzzle Hunt 2017
    results = defaultdict(list)
    for row in soup.find_all('div', class_='row'):
        day, puzzles = (child for child in row.children if child.name == 'div')
        if 'three' in day['class'] and 'nine' in puzzles['class']:
            round_name = day.h3.string
            results['rounds'].append({'name': round_name})
            for td in puzzles.select('td:first-child'):
                a = td.a
                puzzle = {}
                puzzle['name'] = a.string.strip()
                puzzle['link'] = a.get('href')
                puzzle['round_names'] = [round_name]
                results['puzzles'].append(puzzle)
    return results

def parse_html_gph18(soup):
    # Galact Puzzle Hunt 2018
    results = defaultdict(list)
    for h3 in soup.find_all('h3', class_='puzzle-round__name'):
        round_name = h3.string
        results['rounds'].append({'name': round_name})
        container = h3.find_next_sibling('div', class_='puzzle-round__container')
        for div in container.children:
            if not isinstance(div, NavigableString) and 'puzzle-round__item-link' in div.get('class'):
                puzzle = {}
                puzzle['name'] = div.a.text.strip()
                puzzle['link'] = div.a.get('href')
                puzzle['round_names'] = [round_name]
                results['puzzles'].append(puzzle)
    return results

def parse_html_mh16(soup):
    # MH 2016
    results = defaultdict(list)
    for h2 in soup.find_all('h2'):
        round_name = h2.a.string
        results['rounds'].append({
            'name': round_name,
            'link': h2.a.get('href'),
        })
        ul = h2.find_next_sibling('ul')
        for a in ul.find_all('a'):
            puzzle = {
                'name': a.string,
                'link': a.get('href'),
                'round_names': [round_name],
            }
            results['puzzles'].append(puzzle)
    return results

def parse_html_mh20(soup):
    # MH 2020
    results = defaultdict(list)
    for li_round in soup.find('ul', id='loplist').children:
        if not isinstance(li_round, NavigableString):
            round_name = li_round.a.string
            results['rounds'].append({
                'name': round_name,
                'link': li_round.a.get('href'),
            })
            for li_puzzle in li_round.find_all('li'):
                puzzle = {
                    'name': li_puzzle.a.string,
                    'link': li_puzzle.a.get('href'),
                    'round_names': [round_name],
                }
                results['puzzles'].append(puzzle)
    return results

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
