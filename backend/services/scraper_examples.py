import json
import re
import typing
from urllib.parse import urljoin

import bs4
from celery.utils.log import get_task_logger

from services import scraper_types
from services.scraper_types import Hunt, Puzzle, Round

logger = get_task_logger(__name__)


def parse_json_mh19(data) -> Hunt:
    # MH 2019 when live
    hunt = Hunt()
    for land in data.get("lands", []):
        round_name = land["title"]
        round_link = land["url"]
        hunt.rounds.append(Round(name=round_name, link=round_link))
        for puzzle in land.get("puzzles", []):
            puzzle_name = puzzle["title"]
            puzzle_link = puzzle["url"]
            hunt.puzzles.append(
                Puzzle(name=puzzle_name, link=puzzle_link, round_names=[round_name])
            )
    return hunt


def parse_html_mh12(soup: bs4.BeautifulSoup) -> Hunt:
    # MH 2012
    hunt = Hunt()
    for h2 in soup.find_all("h2"):
        table = h2.find_next_sibling("table")
        if table is not None:
            round_name = h2.string
            assert round_name
            _round = Round(name=round_name)
            for a in table.find_all("a"):
                if a.string == "Round page":
                    _round.link = a["href"]
                else:
                    puzzle = Puzzle(
                        name=a.string, link=a["href"], round_names=[round_name]
                    )
                    hunt.puzzles.append(puzzle)
            hunt.rounds.append(_round)
    return hunt


def parse_html_gph17(soup: bs4.BeautifulSoup) -> Hunt:
    # Galact Puzzle Hunt 2017
    hunt = Hunt()
    for row in soup.find_all("div", class_="row"):
        day, puzzles = (child for child in row.children if child.name == "div")
        if "three" in day["class"] and "nine" in puzzles["class"]:
            round_name = day.h3.string
            hunt.rounds.append(Round(name=round_name))
            for td in puzzles.select("td:first-child"):
                a = td.a
                puzzle = Puzzle(
                    name=a.string.strip(),
                    link=a["href"],
                    round_names=[round_name],
                )
                hunt.puzzles.append(puzzle)
    return hunt


def parse_html_gph18(soup: bs4.BeautifulSoup) -> Hunt:
    # Galact Puzzle Hunt 2018
    hunt = Hunt()
    for h3 in soup.find_all("h3", class_="puzzle-round__name"):
        round_name = h3.string
        hunt.rounds.append(Round(name=round_name))
        container = h3.find_next_sibling("div", class_="puzzle-round__container")
        for div in container.children:
            if not isinstance(
                div, bs4.NavigableString
            ) and "puzzle-round__item-link" in div.get("class"):
                puzzle = Puzzle(
                    name=div.a.text.strip(),
                    link=div.a["href"],
                    round_names=[round_name],
                )
                hunt.puzzles.append(puzzle)
    return hunt


def parse_html_mh16(soup: bs4.BeautifulSoup) -> Hunt:
    # MH 2016
    hunt = Hunt()
    for h2 in soup.find_all("h2"):
        round_name = h2.a.string
        hunt.rounds.append(
            Round(
                name=round_name,
                link=h2.a.get("href"),
            )
        )
        ul = h2.find_next_sibling("ul")
        for a in ul.find_all("a"):
            puzzle = Puzzle(
                name=a.string,
                link=a["href"],
                round_names=[round_name],
            )
            hunt.puzzles.append(puzzle)
    return hunt


def parse_html_mh20(soup: bs4.BeautifulSoup) -> Hunt:
    # MH 2020
    hunt = Hunt()
    for li_round in soup.find("ul", id="loplist").children:
        if not isinstance(li_round, bs4.NavigableString):
            round_name = li_round.a.string
            hunt.rounds.append(
                Round(
                    name=round_name,
                    link=li_round.a.get("href"),
                )
            )
            for li_puzzle in li_round.find_all("li"):
                puzzle = Puzzle(
                    name=li_puzzle.a.string,
                    link=li_puzzle.a["href"],
                    round_names=[round_name],
                )
                hunt.puzzles.append(puzzle)
    return hunt


def parse_html_mh21(soup: bs4.BeautifulSoup, intro_only=True) -> Hunt:
    """
    If `intro_only` is True, only parses the intro round.

    NB: Public access login needs to have {'public': 'public access'} in the payload.
    """
    hunt = Hunt()
    main = soup.find("main")
    for section in main.find_all("section"):
        a_round = section.a
        if a_round.h3 is None:
            continue
        round_name = a_round.h3.string
        if intro_only and round_name != "Yew Labs":
            # only parse intro round
            continue
        hunt.rounds.append(
            Round(
                name=round_name,
                link=a_round.get("href"),
            )
        )
        for tr_puzzle in section.find_all("tr"):
            tds = tr_puzzle.find_all("td")
            if tds:
                if tds[0].a is None or tds[0].a.get("href") is None:
                    continue
                answer = tds[1].string.strip()
                puzzle = Puzzle(
                    name=tds[0].a.string.strip(),
                    link=tds[0].a["href"],
                    round_names=[round_name],
                    answer=answer,
                    is_solved=bool(answer),
                    is_meta="meta" in (tds[0].get("class") or []),
                )
                if round_name == "Infinite Corridor":
                    continue
                    if ":" in puzzle.name:
                        puzzle.name = puzzle.name[puzzle.name.find(":") :]

                hunt.puzzles.append(puzzle)
    return hunt


async def parse_html_gphsite21(
    client: scraper_types.Client, url: str, *, _round=None
) -> Hunt:
    data = await client.try_fetch(url)
    soup = bs4.BeautifulSoup(data, "html5lib")
    # parses gph-site 2021 and fetches round pages
    # recurses if _round is None
    hunt = Hunt()
    for list_div in soup.find_all("div", class_="puzzles-list"):
        round_names = []
        round_name = _round.name if _round else None
        if round_name:
            hunt.rounds.append(Round(name=round_name))
            round_names.append(round_name)
        for entry_div in list_div.find_all("div", class_="puzzles-entry"):
            a = entry_div.find("a", class_="puzzles-link")
            answer_div = entry_div.find(class_="solved-title-answer")
            answer = answer_div and answer_div.text.strip()
            if a is not None:
                puzzle = Puzzle(
                    name=a.text.strip(),
                    link=a["href"],
                    round_names=round_names,
                )
                if "puzzles-meta" in (entry_div.get("class") or []):
                    puzzle.is_meta = True
                if answer:
                    puzzle.answer = answer
                    puzzle.is_solved = True
                hunt.puzzles.append(puzzle)
    if _round is None:
        for h2 in soup.find_all("h2"):
            a = h2.a
            if a is not None:
                current_round = Round(
                    name=a.text.strip(),
                    link=a.get("href"),
                )
                round_results = await parse_html_gphsite21(
                    client, urljoin(url, current_round.link), _round=current_round
                )
                hunt.rounds.extend(round_results.rounds)
                hunt.puzzles.extend(round_results.puzzles)
    return hunt


def parse_html_dp20(soup: bs4.BeautifulSoup) -> Hunt:
    # parses DP Hunt 2020
    hunt = Hunt()
    for h4 in soup.find_all("h4"):
        round_name = h4.text.strip()
        hunt.rounds.append(Round(name=round_name))
    for table in soup.find_all("table", class_="gph-list-table"):
        h4 = table.find_previous_sibling("h4")
        round_names = []
        if h4 is not None:
            round_name = h4.text.strip()
            round_names.append(round_name)
        for tr_puzzle in table.find_all("tr"):
            tds = tr_puzzle.find_all("td")
            if not tds:
                continue
            a = tds[0].a
            elt_answer = tr_puzzle.find(class_="solved-title-answer")
            answer = elt_answer and elt_answer.text.strip()
            if a is not None:
                puzzle = Puzzle(
                    name=a.text.strip(),
                    link=a["href"],
                    round_names=round_names,
                )
                if answer:
                    puzzle.answer = answer
                    puzzle.is_solved = True
                if puzzle.name.startswith("META:"):
                    puzzle.is_meta = True
                hunt.puzzles.append(puzzle)
    return hunt


def parse_html_silph21(soup: bs4.BeautifulSoup) -> Hunt:
    hunt = Hunt()
    for btn in soup.find_all("button", class_="tablink"):
        round_name = btn.text.strip()
        hunt.rounds.append(Round(name=round_name))
    btn = soup.find("button", class_="tab-selected")
    round_name = btn.text.strip()
    for table in soup.find_all("table", class_="gph-list-table"):
        round_names = [round_name]
        for tr_puzzle in table.find_all("tr"):
            tds = tr_puzzle.find_all("td")
            if not tds:
                continue
            a = tds[0].a
            elt_answer = tr_puzzle.find(class_="solved-title-answer")
            answer = elt_answer and elt_answer.text.strip()
            if a is not None:
                puzzle = Puzzle(
                    name=a.text.strip(),
                    link=a["href"],
                    round_names=round_names,
                )
                if answer:
                    puzzle.answer = answer
                    puzzle.is_solved = True
                if puzzle.name.startswith("META:"):
                    puzzle.is_meta = True
                hunt.puzzles.append(puzzle)
    return hunt


def parse_html_starrats(soup: bs4.BeautifulSoup) -> Hunt:
    hunt = Hunt()
    div_puzzles = soup.find(class_="puzzles")
    round_name = None
    for div in div_puzzles.children:
        if div.name != "div":
            continue
        table = div.find("table")
        if table is None:
            continue
        for tr in table.tbody.find_all("tr"):
            td_or_th = tr.find_all(True, recursive=False)[0]
            if td_or_th.name == "th":
                round_name = td_or_th.string
                _round = Round(name=round_name)
                if td_or_th.a:
                    _round.link = td_or_th.a.get("href")
                hunt.rounds.append(_round)
            else:
                a = td_or_th.a
                if a is not None:
                    puzzle = Puzzle(
                        name=a.text.strip(),
                        link=a["href"],
                    )
                    if round_name is not None:
                        puzzle.round_names = [round_name]
                    answer = None
                    if answer:
                        puzzle.answer = answer
                        puzzle.is_solved = True
                    if "meta" in a.get("class", []):
                        puzzle.is_meta = True
                    hunt.puzzles.append(puzzle)
    return hunt


async def parse_html_mh22(client: scraper_types.Client, url: str) -> Hunt:
    data = await client.try_fetch(url)
    soup = bs4.BeautifulSoup(data, "html5lib")
    hunt = Hunt()
    content = soup.find(id="main-content")
    round_name = None
    for h2 in content.find_all("h2"):
        if h2.name == "h2":
            # round
            round_name = h2.text.strip()
            _round = Round(name=round_name)
            a = h2.a
            if h2.a:
                _round.link = h2.a.get("href")
            hunt.rounds.append(_round)
            round_url = urljoin(url, _round.link)
            round_html = await client.try_fetch(round_url)
            round_soup = bs4.BeautifulSoup(round_html, "html5lib")
            div = round_soup.find(class_="round-table-container")
            if div is None:
                continue
            table = div.table
            if table:
                # list of puzzles
                for tr in table.tbody.find_all("tr")[1:]:
                    tds_or_ths = tr.find_all(True, recursive=False)
                    if len(tds_or_ths) != 2:
                        continue
                    a_tag = tds_or_ths[0].a
                    puzzle_link = a_tag["href"] if a_tag else ""
                    if puzzle_link:
                        puzzle_link = urljoin(round_url, puzzle_link)
                    puzzle = Puzzle(
                        name=tds_or_ths[0].text.strip(),
                        link=puzzle_link,
                        round_names=[round_name] if round_name is not None else None,
                    )
                    answer = tds_or_ths[1].text.strip()
                    if answer:
                        puzzle.answer = answer
                        puzzle.is_solved = True
                    if a_tag and "meta" in a_tag.get("class", []):
                        puzzle.is_meta = True
                    hunt.puzzles.append(puzzle)
    return hunt


def parse_json_mh23(data) -> Hunt:
    # MH 2023 when live
    hunt = Hunt()
    rounds = set()
    for puzzle_data in data:
        round_name = puzzle_data["round"]
        if round_name not in rounds:
            hunt.rounds.append(Round(name=round_name))
            rounds.add(round_name)
        hunt.puzzles.append(
            Puzzle(
                name=puzzle_data["name"],
                link=puzzle_data["url"],
                round_names=[round_name],
                is_meta=puzzle_data["isMeta"],
                is_solved=bool(puzzle_data["answer"]),
                answer=puzzle_data["answer"] or "",
            )
        )
    return hunt


async def parse_html_mh25(client: scraper_types.Client, url: str) -> Hunt:
    data = await client.try_fetch(url)
    soup = bs4.BeautifulSoup(data, "html5lib")
    hunt = Hunt()
    content = soup.find(id="all-puzzles-root")
    round_name = None
    for h3 in content.find_all("h3"):
        if h3.name == "h3":
            # round
            round_name = h3.text.strip()
            _round = Round(name=round_name)
            if h3.a:
                _round.link = h3.a.get("href")
            hunt.rounds.append(_round)
            table = None
            siblings = list(h3.next_siblings)
            if siblings and siblings[0].name == "table":
                table = siblings[0]
            if table:
                # list of puzzles
                puzzle = None
                for tr in table.tbody.find_all("tr"):
                    for td in tr.find_all("td"):
                        if td.get("class") == ["puzzle-name"]:
                            if puzzle and puzzle.name:
                                hunt.puzzles.append(puzzle)
                            title = td.find(class_="puzzle-link-title")
                            if title is None:
                                continue
                            puzzle = Puzzle(
                                name=title.get_text(strip=True, separator=" "),
                                link=title.get("href") or "",
                                round_names=[round_name] if round_name else None,
                            )
                        elif td.get("class") == ["puzzle-answer"]:
                            answer = td.get_text(strip=True, separator=" ")
                            if answer and puzzle:
                                puzzle.answer = answer
                                puzzle.is_solved = True
                        elif td.get("class") == ["desc"]:
                            puzzle.notes = td.get_text(strip=True, separator=" ")
                if puzzle and puzzle.name:
                    hunt.puzzles.append(puzzle)
    return hunt


async def parse_html_mh26(client: scraper_types.Client, url: str) -> Hunt:
    data = await client.try_fetch(url)
    soup = bs4.BeautifulSoup(data, "html5lib")
    hunt = Hunt()

    script = soup.find(
        "script", string=lambda t: t and "window.initialAllPuzzlesState" in t
    )

    if not script:
        raise ValueError("No script found")

    content = script.decode_contents()

    p_match = re.search(r"window\.initialAllPuzzlesState\s*=\s*(\{.*?\});", content)
    if not p_match:
        raise ValueError("No puzzles match found")

    p_state = json.loads(p_match.group(1))

    t_match = re.search(r"window\.initialTeamState\s*=\s*(\{.*?\});", content)
    t_state = json.loads(t_match.group(1)) if t_match else {}
    t_puzzles = t_state.get("puzzles", {})
    t_rounds = t_state.get("rounds", {})

    p_rounds = {r["slug"]: r for r in p_state.get("rounds", [])}
    all_round_slugs = sorted(list(set(p_rounds.keys()) | set(t_rounds.keys())))

    for r_slug in all_round_slugs:
        p_r = p_rounds.get(r_slug, {})
        t_r = t_rounds.get(r_slug, {})

        r_name = p_r.get("title") or t_r.get("title") or r_slug
        hunt.rounds.append(Round(name=r_name, link=urljoin(url, f"/rounds/{r_slug}")))

        seen_p_slugs = set()
        # Prefer puzzles from TeamState slots if available as they include "tasks"
        slots = t_r.get("slots", {})
        for slot in slots.values():
            p_slug = slot.get("slug")
            if not p_slug:
                continue
            seen_p_slugs.add(p_slug)

            p_info = next(
                (p for p in p_r.get("puzzles", []) if p.get("slug") == p_slug), {}
            )
            tp = t_puzzles.get(p_slug, {})

            hunt.puzzles.append(
                Puzzle(
                    name=p_info.get("title") or tp.get("title") or p_slug,
                    link=urljoin(url, f"/puzzles/{p_slug}"),
                    round_names=[r_name],
                    is_solved=tp.get("solved", False),
                    answer=tp.get("answer") or "",
                    is_meta=tp.get("is_meta", False) or p_info.get("is_meta", False),
                    is_locked=tp.get("locked") == "unlockable"
                    or p_info.get("state") == "unlockable",
                    notes=p_info.get("desc") or "",
                )
            )

        # Add remaining puzzles from AllPuzzlesState
        for p_info in p_r.get("puzzles", []):
            p_slug = p_info.get("slug")
            if not p_slug or p_slug in seen_p_slugs:
                continue
            seen_p_slugs.add(p_slug)

            tp = t_puzzles.get(p_slug, {})
            hunt.puzzles.append(
                Puzzle(
                    name=p_info.get("title") or tp.get("name") or p_slug,
                    link=urljoin(url, f"/puzzles/{p_slug}"),
                    round_names=[r_name],
                    is_solved=tp.get("solved", False),
                    answer=tp.get("answer") or "",
                    is_meta=p_info.get("is_meta", False) or tp.get("is_meta", False),
                    is_locked=p_info.get("state") == "unlockable"
                    or tp.get("locked") == "unlockable",
                    notes=p_info.get("desc") or "",
                )
            )

    return hunt
