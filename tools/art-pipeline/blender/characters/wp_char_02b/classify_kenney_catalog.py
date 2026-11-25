#!/usr/bin/env python3
"""Aplica la clasificación visual curada al catálogo Kenney de WP-CHAR-02B."""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[5]
CATALOG = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02b/catalog"
REPORT_PATH = CATALOG / "kenney-character-catalog.json"

CLASSIFICATION = {
    "character-male-a.glb": ("SUITABLE", "Gafas, camiseta verde, pantalón azul y zapatillas amarillas; silueta civil compacta.", "Ciudadano A o técnico con accesorio pequeño.", "Ninguna esencial; paleta local opcional.", "Bajo"),
    "character-male-b.glb": ("ADAPTABLE", "Hombre barbudo y corpulento con camiseta naranja; buena base de volumen.", "Bombero o supervisor robusto.", "Materiales protectores y casco; conservar malla skineada.", "Medio"),
    "character-male-c.glb": ("SUITABLE", "Gorra y uniforme azul de policía integrados en geometría/atlas.", "Policía.", "Sólo insignia y cinturón rígidos; no recolorear como única profesión.", "Bajo"),
    "character-male-d.glb": ("SUITABLE", "Traje oscuro y corbata; apariencia adulta formal.", "Profesional municipal o civil formal.", "Ninguna esencial; folder opcional.", "Bajo"),
    "character-male-e.glb": ("ADAPTABLE", "Gafas, camisa blanca y mono/tirantes amarillos, sin casco; base de obra reconocible.", "Supervisor o obrero B.", "Casco rígido, clipboard y paleta propia; no duplicar al obrero A.", "Medio"),
    "character-male-f.glb": ("ADAPTABLE", "Camiseta verde, mono marrón y calzado claro; complexión compacta.", "Obrero B o técnico.", "Casco y herramienta riggeados; variar paleta/silueta.", "Medio"),
    "character-male-g.glb": ("ADAPTABLE", "Gafas redondas, barba, camisa azul clara y delantal/mono marrón; volumen ancho.", "Enforcer A.", "Paleta oscura, gorra y cinturón; no añadir abrigo rígido.", "Medio"),
    "character-female-a.glb": ("ADAPTABLE", "Conjunto violeta con dos pistolas azules integradas y skineadas; anchura impropia para población general.", "Enforcer B tras retirar armas, o personaje armado sólo con justificación.", "Retirar/ocultar las pistolas y adaptar vestuario oscuro; no usar tal cual como civil.", "Alto"),
    "character-female-b.glb": ("SUITABLE", "Coletas y diadema amarillas, camiseta amarilla y mono violeta; silueta civil diferenciada.", "Ciudadana A.", "Ninguna esencial.", "Bajo"),
    "character-female-c.glb": ("SUITABLE", "Pelo oscuro, diadema roja, camiseta azul/roja y parte inferior marrón.", "Ciudadana B o profesional municipal.", "Ninguna esencial; folder opcional.", "Bajo"),
    "character-female-d.glb": ("SUITABLE", "Traje y pelo rojizo; apariencia formal adulta.", "Profesional municipal o civil formal.", "Ninguna esencial.", "Bajo"),
    "character-female-e.glb": ("SUITABLE", "Bata clara integrada; lectura sanitaria directa.", "Sanitario.", "Ninguna esencial; bolsa médica pequeña opcional.", "Bajo"),
    "character-female-f.glb": ("ADAPTABLE", "Coleta, camiseta de rayas, pantalón azul y detalle amarillo en muñeca/cintura.", "Obrero B o técnico.", "Casco y paleta; verificar silueta frente a otros femeninos.", "Medio"),
    "character-worker.glb": ("SUITABLE", "Casco amarillo, camisa azul, mono/pantalón marrón y calzado claro; referencia artística aprobada.", "Obrero A.", "Ninguna esencial; preservar la receta de WP-CHAR-02A.", "Bajo"),
    "character-soldier.glb": ("ADAPTABLE", "Uniforme y casco verdes de soldado genérico; no es fantasía, pero sí lenguaje militar contemporáneo.", "Policía/guardia o bombero con adaptación de uniforme.", "Cambiar paleta y detalles de uniforme; evaluar casco y silueta.", "Medio-alto"),
    "character-raider.glb": ("ADAPTABLE", "Aspecto civil real: camiseta verde y mono marrón; el nombre no coincide con la geometría.", "Obrero B, técnico o civil trabajador.", "Añadir casco/herramienta y variar paleta; no tratarlo como fantasy.", "Medio"),
    "character-knight.glb": ("UNSUITABLE", "Armadura medieval y casco fantástico.", "Fuera de catálogo.", "No utilizar.", "Alto"),
    "character-alien.glb": ("UNSUITABLE", "Criatura alienígena violeta; fuera del setting.", "Fuera de catálogo.", "No utilizar.", "Alto"),
    "character-robot.glb": ("UNSUITABLE", "Robot futurista; fuera del setting.", "Fuera de catálogo.", "No utilizar.", "Alto"),
    "character-zombie.glb": ("UNSUITABLE", "No-muerto con piel verde; fuera del catálogo funcional.", "Fuera de catálogo.", "No utilizar.", "Alto"),
}


def main():
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    for model in report["models"]:
        classification, description, use, adaptation, risk = CLASSIFICATION[model["file"]]
        model["classification"] = classification
        model["visualDescription"] = description
        model["potentialLandlordUse"] = use
        model["requiredAdaptation"] = adaptation
        model["risk"] = risk
    report["status"] = "visually_classified_pending_validation"
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({key: sum(model["classification"] == key for model in report["models"]) for key in ("SUITABLE", "ADAPTABLE", "UNSUITABLE", "UNVERIFIED")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
