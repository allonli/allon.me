import json, os, re

def extract_years(period_text):
    """Extract years from period_text like '起強圉大淵獻（丁亥），盡重光單閼（辛卯），凡五年。'"""
    years = re.findall(r'（([^）]+)）', period_text)
    return years

vols = range(107, 116)

for v in vols:
    with open(f'/usr/local/code/allon.me/zztj-cache/vol_{v}.json', 'r') as f:
        data = json.load(f)
    
    # Extract key paragraphs (first few sentences of each paragraph)
    paragraphs = data['origin_paragraphs']
    main_text_lines = data['full_main_text'].split('\n')
    
    # Extract reign years
    reign_years = data.get('reign_years', [])
    
    # Get key persons (top 30 by frequency/influence)
    persons = data.get('person_names', [])[:30]
    
    # Get the text sorted by events
    text = data['full_main_text']
    
    out_path = f'/usr/local/code/allon.me/zztj-tmp/vol_{v}_summary.txt'
    with open(out_path, 'w') as out:
        out.write(f"卷{v} | {data['section']} | {data['emperor']}\n")
        out.write(f"标题: {data['title']}\n")
        out.write(f"时间: {data['period_text']}\n")
        reigns = data.get('reign_years', [])
        out.write(f"年号: {', '.join(reigns)}\n")
        out.write(f"正文字数: {data['main_text_length']}\n")
        out.write(f"注文字数: {data['annotation_text_length']}\n")
        out.write(f"段落数: {len(paragraphs)}\n")
        out.write(f"主要人物(Top30): {', '.join(persons)}\n")
        out.write(f"\n=== 正文 ===\n{text}\n")
    
    print(f"Vol {v} summary written: {len(text)} chars")

print("\nDone!")
