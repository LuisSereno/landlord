#!/usr/bin/env python3
"""Produce a grouped, auditable QA inventory for the six newly staged art packs.

The world asset index remains authoritative for individual files. This report groups equivalent
exports for review and never marks a source runtime ready.
"""
import json
from collections import defaultdict, Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'src_kenney_building_kit', 'src_kenney_modular_buildings',
    'src_kenney_retro_urban_kit', 'src_kenney_mini_characters',
    'src_kenney_retro_textures_fantasy', 'src_quaternius_ultimate_buildings',
}
FORMATS = {'.glb', '.fbx', '.obj', '.blend', '.gltf'}
ORDER = {'.glb': 0, '.fbx': 1, '.blend': 2, '.gltf': 3, '.obj': 4, '.png': 5, '.jpg': 6}
OUT = ROOT / 'docs/art/new-assets-integration/candidate-inventory.json'


def group_key(asset):
    p = Path(asset['sourcePath'])
    parts = [part.lower() for part in p.parent.parts if part.lower() not in {
        'glb format', 'fbx format', 'obj format', 'glb', 'fbx', 'obj', 'blend', 'blender', 'blends'
    }]
    return asset['sourceId'], '/'.join(parts), p.stem.lower()


def decision(asset):
    name = Path(asset['sourcePath']).stem.lower()
    source = asset['sourceId']
    if source == 'src_kenney_mini_characters':
        if any(word in name for word in ('robot', 'alien', 'zombie', 'knight', 'raider', 'soldier', 'weapon', 'shield')):
            return 'qa_rejected', 'Anacrónico o incompatible con población civil histórica', 'none'
        if name.startswith('character-'):
            return 'indexed', 'Candidato de personaje; rig, clips y escala visual sin validar', 'Character Factory QA'
        return 'indexed', 'Accesorio; comprobar escala y vínculo con personaje', 'Character Factory QA'
    if source == 'src_kenney_retro_textures_fantasy':
        return 'indexed', 'Textura pixel art; falta comparación visual con Poly Haven', 'material QA'
    if source == 'src_kenney_retro_urban_kit' and name.startswith('road-'):
        return 'indexed', 'Sólo presentación; no modifica topología vial', 'world prop QA'
    if source == 'src_quaternius_ultimate_buildings' and ('story' in name or 'building' in name):
        return 'indexed', 'Volumen completo de referencia; huella y escala pendientes', 'Building Composer QA'
    return 'indexed', 'Pendiente de medición y selección artística', {
        'actor': 'Character Factory QA', 'vehicle': 'world vehicle QA',
        'urban_prop': 'world prop QA', 'material': 'material QA',
    }.get(asset['category'], 'Building Composer QA')


def main():
    index = json.loads((ROOT / 'blender_artist/manifests/world-asset-index.json').read_text())
    inventory = json.loads((ROOT / 'blender_artist/manifests/building-module-inventory.json').read_text())
    measurements = {item['path']: item for item in inventory['sources']}
    selection = json.loads((ROOT / 'blender_artist/manifests/building-modules-selection.json').read_text())
    selected = defaultdict(list)
    for module in selection['modules']:
        selected[module['sourcePath']].append(module['id'])
    grouped = defaultdict(list)
    for asset in index['assets']:
        if asset['sourceId'] in SOURCES:
            grouped[group_key(asset)].append(asset)
    records = []
    for key, entries in sorted(grouped.items()):
        entries.sort(key=lambda a: (
            (0 if Path(a['sourcePath']).suffix.lower() == '.blend' else 1)
            if a['sourceId'] == 'src_quaternius_ultimate_buildings'
            else ORDER.get(Path(a['sourcePath']).suffix.lower(), 99),
            a['sourcePath'],
        ))
        canonical = entries[0]
        status, reason, consumer = decision(canonical)
        measured = measurements.get(canonical['sourcePath'])
        module_ids = selected.get(canonical['sourcePath'], [])
        if measured:
            status = 'measured' if status == 'indexed' else status
            if measured['unresolvedTextures']:
                status = 'qa_rejected'
                reason = 'Textura sin resolver en Blender; no apto para render hasta reparar el atlas'
        if module_ids:
            status = 'selected'
            reason = 'Módulo medido y añadido a la selección curada; revisión visual pendiente'
        records.append({
            'sourceId': canonical['sourceId'], 'assetId': canonical['assetId'],
            'sourcePath': canonical['sourcePath'],
            'canonicalFormat': Path(canonical['sourcePath']).suffix.lower().lstrip('.'),
            'alternates': [a['sourcePath'] for a in entries[1:]],
            'license': canonical['license'], 'licenseGate': None,
            'category': canonical['category'], 'semanticRoles': canonical['semanticRoles'],
            'contexts': canonical['contexts'],
            'measurement': ({'sizeMeters': measured['normalized']['sizeMeters'],
                             'triangles': measured['triangles'], 'classification': measured['classification'],
                             'unresolvedTextures': measured['unresolvedTextures']}
                            if measured else None),
            'styleCompatibility': 'unreviewed', 'decision': status,
            'reason': reason, 'consumer': consumer,
            'integration': 'composer_selection' if module_ids else 'index_only',
            'moduleIds': module_ids,
        })
    coverage = {}
    for source in sorted(SOURCES):
        source_records = [r for r in records if r['sourceId'] == source]
        coverage[source] = {
            'indexedFiles': sum(len(r['alternates']) + 1 for r in source_records),
            'resourceGroups': len(source_records),
            'modelGroups': sum(Path(r['sourcePath']).suffix.lower() in FORMATS for r in source_records),
            'decisions': dict(Counter(r['decision'] for r in source_records)),
        }
    OUT.write_text(json.dumps({'schemaVersion': 1, 'generatedFrom': 'blender_artist/manifests/world-asset-index.json', 'coverage': coverage, 'resources': records}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(coverage, indent=2))


if __name__ == '__main__':
    main()
