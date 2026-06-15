import json, os

for vol_num in range(176, 191):
    fpath = f'/usr/local/code/allon.me/zztj-cache/vol_{vol_num}.json'
    if not os.path.exists(fpath):
        continue
    with open(fpath) as f:
        data = json.load(f)
    
    print(f"\n{'='*80}")
    print(f"VOL:{data['volume']}|TITLE:{data['title']}|SECTION:{data['section']}")
    print(f"PERIOD:{data['period_text']}|EMPEROR:{data['emperor']}")
    print(f"MAIN_LEN:{data['main_text_length']}|ANN_LEN:{data['annotation_text_length']}")
    print(f"PARA_COUNT:{data['origin_count']}|HZ_NOTES:{len(data.get('hz_notes',[]))}")
    reigns = data.get('reign_years',[])
    for r in reigns:
        print(f"REIGN:{r.get('title','')}")
    
    ops = data.get('origin_paragraphs',[])
    for i, p in enumerate(ops[:5]):
        print(f"P-START_{i}:{p[:200]}")
    mid = len(ops)//2
    for i in range(mid, min(len(ops), mid+5)):
        print(f"P-MID_{i}:{ops[i][:200]}")
    for i in range(max(0,len(ops)-5), len(ops)):
        print(f"P-END_{i}:{ops[i][:200]}")
    
    persons = data.get('person_names',[])
    if persons:
        print(f"PERSONS:{', '.join(persons[:20])}")
    
    hz = data.get('hz_notes',[])
    for i, n in enumerate(hz[:5]):
        print(f"HZ_{i}:{n[:200]}")
