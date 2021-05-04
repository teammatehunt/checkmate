import json

with open('everything.json') as f:
	data = json.load(f)

for _round in data['rounds'].values():
	if _round['hidden']:
		continue
	print(_round['name'])
	for slug in _round['puzzles']:
		puzzle = data['puzzles'][slug]
		if puzzle['hidden']:
			continue
		if puzzle['is_meta']:
			print('\t'.join([
				f'=HYPERLINK("{puzzle["sheet_link"]}", "META: {puzzle["name"]}")',
				puzzle['answer'],
				puzzle['status'],
				puzzle['notes'].replace('\n', ' '),
			]))
	for slug in _round['puzzles']:
		puzzle = data['puzzles'][slug]
		if puzzle['hidden']:
			continue
		if not puzzle['is_meta']:
			print('\t'.join([
				f'=HYPERLINK("{puzzle["sheet_link"]}", "{puzzle["name"]}")',
				puzzle['answer'],
				puzzle['status'],
				puzzle['notes'].replace('\n', ' '),
			]))


print('Unassigned')
for puzzle in data['puzzles'].values():
	if puzzle['hidden']:
		continue
	if not puzzle['rounds']:
		print('\t'.join([
			f'=HYPERLINK("{puzzle["sheet_link"]}", "{puzzle["name"]}")',
			puzzle['answer'],
			puzzle['status'],
			puzzle['notes'].replace('\n', ' '),
		]))
