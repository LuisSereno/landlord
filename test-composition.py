#!/usr/bin/env python3
"""Test composition for all 15 building types without Blender rendering."""
import sys
import json
import re
from pathlib import Path

# Add the tools directory to path
sys.path.insert(0, str(Path(__file__).parent / "tools" / "art-pipeline" / "blender"))

from building_composer.compose import compose_candidate, CompositionError
from building_composer.module_catalog import Catalog
from building_composer.grammar import GrammarDocument
from building_composer.style_profile import StyleProfile

REPO_ROOT = Path(__file__).parent
GRAMMARS_PATH = REPO_ROOT / "blender_artist/manifests/building-composer-grammars.json"
GAME_DATA_PATH = REPO_ROOT / "packages/simulation/src/game-data.ts"

def domain_geometry(building_type):
    """Extract footprint and floors from game-data.ts"""
    content = GAME_DATA_PATH.read_text()
    start = content.find(f"  {building_type}: {{")
    if start < 0:
        raise ValueError(f"{building_type} not found in game-data.ts")
    
    # Find the end of this building definition
    end_pattern = '\n  }'
    end = content.find(end_pattern, start)
    block = content[start:end]
    
    # Extract footprint
    fp_match = re.search(r'preferredFootprint:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}', block)
    floors_match = re.search(r'defaultFloors:\s*(\d+)', block)
    
    if not fp_match or not floors_match:
        raise ValueError(f"{building_type}: missing footprint or floors")
    
    return {
        "width": int(fp_match.group(1)),
        "height": int(fp_match.group(2)),
        "floors": int(floors_match.group(1))
    }

def profile_for(family, profiles_data):
    """Find the style profile ID for a family"""
    matches = [p for p in profiles_data["profiles"] if family in p["appliesToFamilies"]]
    if len(matches) != 1:
        raise ValueError(f"Family {family}: found {len(matches)} profiles, expected 1")
    return matches[0]["id"]

def test_composition(building_type, seed, grammars, catalog, profiles_data):
    """Test composition for a single building type and seed"""
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
    # Load grammars and catalog
    print("Loading grammars...")
    grammars = json.loads(GRAMMARS_PATH.read_text())
    
    print("Loading catalog...")
    catalog = Catalog()
    
    print("Loading style profiles...")
    profiles_path = REPO_ROOT / "blender_artist/manifests/building-style-profiles.json"
    profiles_data = json.loads(profiles_path.read_text())
    
    # Test all 15 types with seed 1000
    building_types = [
        "courtyard_home", "row_house", "apartment_block", "mixed_tenement",
        "workshop", "warehouse", "cement_plant", "brickworks", "steelworks",
        "town_hall", "school_block", "clinic", "police_station", "fire_station",
        "market_hall"
    ]
    
    print(f"\nTesting {len(building_types)} building types with seed 1000...\n")
    
    results = {}
    for bt in building_types:
        print(f"  {bt:20s} ... ", end="", flush=True)
        result = test_composition(bt, 1000, grammars, catalog, profiles_data)
        results[bt] = result
        if result["success"]:
            print("✓ PASS")
        else:
            print(f"✗ FAIL: {result['error'][:80]}")
    
    # Summary
    passed = sum(1 for r in results.values() if r["success"])
    print(f"\n{'='*60}")
    print(f"Results: {passed}/{len(building_types)} PASSED")
    print(f"{'='*60}\n")
    
    if passed < len(building_types):
        print("Failed types:")
        for bt, result in results.items():
            if not result["success"]:
                print(f"  - {bt}: {result['error']}")
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
