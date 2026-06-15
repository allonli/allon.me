import json, os, re

def get_vol_data(v):
    with open(f'/usr/local/code/allon.me/zztj-cache/vol_{v}.json', 'r') as f:
        return json.load(f)

# Print structure of vol_101 for reference
data = get_vol_data(101)
print(f"Keys: {list(data.keys())}")
print(f"title: {data['title']}")
print(f"section: {data['section']}")
print(f"emperor: {data['emperor']}")
print(f"period_text: {data['period_text']}")
print(f"main_text_length: {data['main_text_length']}")
print(f"reign_years: {[r['title'] for r in data['reign_years']]}")
print(f"origin_paragraphs count: {len(data['origin_paragraphs'])}")
print(f"hz_notes count: {len(data['hz_notes'])}")
print(f"textual_notes count: {len(data.get('textual_notes', []))}")
print()
# Print first paragraph structure
print("First paragraph structure:")
p = data['origin_paragraphs'][0]
print(f"Keys: {list(p.keys())}")
print(f"number: {p.get('number')}")
print(f"text_preview: {p.get('text', '')[:200]}")
print(f"hz_note index preview: {str(p.get('hz_note_index', []))[:200]}")
