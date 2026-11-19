import json, shutil, os, subprocess, sys

REPO = '/home/luis/RepositorioGitHub/landlord'
os.chdir(REPO)
LANES = {'town_hall':'lane1','school_block':'lane1','clinic':'lane2','police_station':'lane2','fire_station':'lane3','market_hall':'lane3'}
FOOT = {'town_hall':(5,3),'school_block':(5,1),'clinic':(2,1),'police_station':(2,1),'fire_station':(3,1),'market_hall':(4,1)}
BATCH = 'docs/art/quality-vj/batch-facilities-v4'
DEST = 'docs/art/facilities-v4/candidates'

promos_path = 'blender_artist/manifests/runtime-promotions.json'
promos = json.load(open(promos_path))
for t, lane in LANES.items():
    src_dir = f'{BATCH}/{lane}/day/{t}'
    cand_id = f'vf_{t}_1000'
    cj = f'{src_dir}/{cand_id}.json'
    cp = f'{src_dir}/{cand_id}.png'
    if not os.path.exists(cj):
        print(f'MISSING {cj}'); sys.exit(1)
    cand = json.load(open(cj))
    assert cand['moodId'] == 'day_civic', (t, cand['moodId'])
    assert cand['footprintCells'] == {'width': FOOT[t][0], 'height': FOOT[t][1]}, (t, cand['footprintCells'])
    os.makedirs(f'{DEST}/{t}', exist_ok=True)
    shutil.copyfile(cj, f'{DEST}/{t}/{cand_id}.json')
    shutil.copyfile(cp, f'{DEST}/{t}/{cand_id}.png')
    entry = {
        'assetId': t, 'semanticType': t, 'candidateBuildingType': t,
        'candidateId': cand_id, 'approvalStatus': 'qa_approved',
        'candidateMetadata': f'{DEST}/{t}/{cand_id}.json',
        'candidateImage': f'{DEST}/{t}/{cand_id}.png',
        'compositionSignature': cand['compositionSignature'],
        'imageSha256': cand['sha256'],
        'styleProfileId': cand['styleProfileId'],
        'state': 'complete',
        'footprint': {'width': FOOT[t][0], 'height': FOOT[t][1]},
        'domainFootprint': {'width': FOOT[t][0], 'height': FOOT[t][1]},
        'allowedOrientations': [45], 'symmetry': 'none', 'stateFallback': 'procedural',
        'provenance': {
            'license': 'original',
            'author': 'Landlord project; CC0 modules by Quaternius/Kenney',
            'notes': f'D-109 (2026-11-18): rehorneado con huella física {FOOT[t][0]}×{FOOT[t][1]} y solar reservado separado; mood day_civic registrado como procedencia (D-108). QA de capturas diurna/nocturna en el acta de cierre. Candidato promovido: ' + cand_id + '.',
        },
    }
    promos['promotions'] = [p for p in promos['promotions'] if p['assetId'] != t] + [entry]
json.dump(promos, open(promos_path, 'w'), indent=2, ensure_ascii=False)
open(promos_path, 'a').write('\n')
print('promotions updated')
