#!/usr/bin/env python3
"""Test composition for all 15 building types × 10 seeds = 150 compositions."""
import sys
import json
import re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "tools" / "art-pipeline" / "blender"))

from building_composer.compose import compose_candidate, CompositionError
from building_composer.module_catalog import Catalog
from building_composer.grammar import GrammarDocument
from building_composer.style_profile import StyleProfile

REPO_ROOT = Path(__file__).parent
GRAMMARS_PATH = REPO_ROOT / "blender_artist/manifests/building-composer-grammars.json"
GAME_DATA_PATH = REPO_ROOT / "packages/simulation/src/game-data.ts"

SEEDS = [42, 1000, 1001, 1002, 1003, 1004, 1005, 1337, 2000, 2026]

def domain_geometry(building_type):
    content = GAME_DATA_PATH.read_text()
    start = content.find(f"  {building_type}: {{")
    end_pattern = '\n  }'
    end = content.find(end_pattern, start)
    block = content[start:end]
    fp_match = re.search(r'preferredFootprint:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}', block)
    floors_match = re.search(r'defaultFloors:\s*(\d+)', block)
    return {
        "width": int(fp_match.group(1)),
        "height": int(fp_match.group(2)),
        "floors": int(floors_match.group(1))
    }

def profile_for(family, profiles_data):
    matches = [p for p in profiles_data["profiles"] if family in p["appliesToFamilies"]]
    return matches[0]["id"]

def test_composition(building_type, seed, grammars, catalog, profiles_data):
    grammar = grammars["grammars"][building_type]
    family = grammar["family"]
    style_profile_id = profile_for(family, profiles_data)
    domain = domain_geometry(building_type)
    
    request = {
        "candidateId": f"test_{building_type}_{seed}",
        "buildingType": building_type,
        "family": family,
        "styleProfileId": style_profile_id,
        "variantSeed": seed,
        "composerVersion": grammars.get("composerVersion", "1.0"),
        "footprint": {"width": domain["width"], "height": domain["height"]},
        "floors": domain["floors"],
        "state": "complete"
    }
    
    try:
        result = compose_candidate(request, catalog=catalog)
        return {"success": True, "result": result}
    except CompositionError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"UNEXPECTED: {type(e).__name__}: {e}"}

def main():
    print("Loading grammars...")
    grammars = json.loads(GRAMMARS_PATH.read_text())
    
    print("Loading catalog...")
    catalog = Catalog()
    
    print("Loading style profiles...")
    profiles_path = REPO_ROOT / "blender_artist/manifests/building-style-profiles.json"
    profiles_data = json.loads(profiles_path.read_text())
    
    building_types = [
        "courtyard_home", "row_house", "apartment_block", "mixed_tenement",
        "workshop", "warehouse", "cement_plant", "brickworks", "steelworks",
        "town_hall", "school_block", "clinic", "police_station", "fire_station",
        "market_hall"
    ]
    
    total_tests = len(building_types) * len(SEEDS)
    print(f"\nTesting {len(building_types)} types × {len(SEEDS)} seeds = {total_tests} compositions...\n")
    
    results = {}
    passed = 0
    failed = 0
    
    for bt in building_types:
        results[bt] = {}
        for seed in SEEDS:
            result = test_composition(bt, seed, grammars, catalog, profiles_data)
            results[bt][seed] = result
            if result["success"]:
                passed += 1
            else:
                failed += 1
    
    # Summary
    print(f"{'='*70}")
    print(f"Results: {passed}/{total_tests} PASSED ({failed} failed)")
    print(f"{'='*70}\n")
    
    if failed > 0:
        print("Failed compositions:")
        for bt, seeds in results.items():
            for seed, result in seeds.items():
                if not result["success"]:
                    print(f"  - {bt} seed {seed}: {result['error'][:100]}")
        return 1
    
    print("✓ All 150 compositions PASSED!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
