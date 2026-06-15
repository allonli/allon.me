import json, os

vols = range(107, 116)
os.makedirs('/usr/local/code/allon.me/zztj-tmp', exist_ok=True)

for v in vols:
    with open(f'/usr/local/code/allon.me/zztj-cache/vol_{v}.json', 'r') as f:
        data = json.load(f)
    
    with open(f'/usr/local/code/allon.me/zztj-tmp/vol_{v}_info.txt', 'w') as out:
        out.write(f"VOLUME: {data['volume']}\n")
        out.write(f"TITLE: {data['title']}\n")
        out.write(f"SECTION: {data['section']}\n")
        out.write(f"EMPEROR: {data['emperor']}\n")
        out.write(f"PERIOD: {data['period_text']}\n")
        out.write(f"MAIN_TEXT_LENGTH: {data['main_text_length']}\n")
        out.write(f"ANNOTATION_TEXT_LENGTH: {data['annotation_text_length']}\n")
        out.write(f"REIGN_YEARS: {json.dumps(data['reign_years'], ensure_ascii=False)}\n")
        out.write(f"PERSON_NAMES (first 80): {json.dumps(data['person_names'][:80], ensure_ascii=False)}\n")
        out.write(f"HZ_NOTES_COUNT: {len(data['hz_notes'])}\n")
        out.write(f"ORIGIN_PARAGRAPHS_COUNT: {len(data['origin_paragraphs'])}\n")
        out.write("\n=== MAIN TEXT ===\n")
        out.write(data['full_main_text'])
        out.write("\n\n=== ANNOTATION TEXT ===\n")
        out.write(data['full_annotation_text'])
    
    print(f"Vol {v}: {data['title']} - {data['section']} - {data['emperor']} - main:{len(data['full_main_text'])} annot:{len(data['full_annotation_text'])} para:{len(data['origin_paragraphs'])}")

print("\nDone!")
