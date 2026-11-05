"""V.g public-space dressing: validador del manifiesto de dressing.

Comprueba sobre el `dressing-manifest.json` que el pipeline de arte escribió, sin importar el
bundler del juego (§32, espejo del validator del compositor):

- PROVENANCE: cada moduleId existe en el catálogo medido, publica el rol declarado y tiene licencia.
- BOUNDS: cada placement cae en una celda que PERTENECE a las celdas reales del espacio público
  (un prop fuera de la plaza/parque sería geometría soñada, el fallo que §7 caza).
- NO-SOLAPE: en el distrito cívico ningún prop pisa la parcela reservada al town_hall.
- DETERMINISMO: volver a correr el planificador reproduce la misma firma (mismo seed, mismo fixture).

Sale con código distinto de cero si algo falla; el orquestador lo trata como gate rojo.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import public_space_dresser as dresser  # noqa: E402
from building_composer.module_catalog import Catalog  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_PATH = REPO_ROOT / "blender_artist/manifests/public-space-dressing-fixture.json"


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def validate(manifest_path):
    catalog = Catalog()
    fixture = load_json(FIXTURE_PATH)
    dressing = load_json(manifest_path)

    errors = []

    # Celdas reales por espacio público y parcela del town_hall por distrito. La id de espacio
    # público se reinicia por distrito, así que la clave es (profileId, publicSpaceId).
    cells_by_space = {}
    town_hall_cells = set()
    for district in fixture["districts"]:
        for parcel_cell in district.get("townHallParcelCells", []):
            town_hall_cells.add((parcel_cell["x"], parcel_cell["y"]))
        for space in district["publicSpaces"]:
            cells_by_space[(district["profileId"], space["id"])] = {
                (c["x"], c["y"]) for c in space["cells"]
            }

    for space in dressing["spaces"]:
        allowed = cells_by_space.get((space["profileId"], space["publicSpaceId"]))
        if allowed is None:
            errors.append(f"{space['profileId']}/{space['publicSpaceId']}: no está en el fixture")
            continue
        for placement in space["placements"]:
            module = catalog.get(placement["moduleId"])
            if module.role != placement["role"]:
                errors.append(
                    f"{space['publicSpaceId']}/{placement['slot']}: {placement['moduleId']} "
                    f"role={module.role} != declarado {placement['role']}"
                )
            if not placement.get("license"):
                errors.append(f"{placement['moduleId']}: sin licencia registrada")
            cell = (placement["cell"]["x"], placement["cell"]["y"])
            if cell not in allowed:
                errors.append(
                    f"{space['publicSpaceId']}/{placement['slot']}: celda {cell} fuera del espacio"
                )
            if space["districtRole"] == "civic" and cell in town_hall_cells:
                errors.append(
                    f"{space['publicSpaceId']}/{placement['slot']}: prop sobre parcela del town_hall {cell}"
                )

    # Determinismo: el planificador debe reproducir la firma publicada.
    recomputed = dresser.dress_all()["signature"]
    if recomputed != dressing["signature"]:
        errors.append(
            f"signature no reproducible: publicada {dressing['signature'][:16]} != recalculada {recomputed[:16]}"
        )

    return errors


def main(argv):
    if len(argv) < 1:
        print("uso: python validate_public_space_dressing.py <dressing-manifest.json>", file=sys.stderr)
        return 2
    errors = validate(argv[0])
    if errors:
        print(f"[dressing-validate] FAIL ({len(errors)}):")
        for error in errors[:40]:
            print(f"  - {error}")
        return 1
    print("[dressing-validate] PASS: provenance, bounds, no-solape y determinismo OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]))
