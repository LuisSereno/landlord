"""
Genera los módulos originales del vocabulario de estados del Building Composer (V.j).

Cuatro módulos de geometría propia, compatibles con Graphic Civic, para los estados construction /
damaged / burning:
  - ConstructionBarrier: valla de obra de dos tablones horizontales sobre patas (2 m × 1 m).
  - DamageDebris: montón de escombros (bloque roto irregular) para el pie de un edificio dañado.
  - FireFlame: cinco lenguas en loft, irregulares y asimétricas, con tres zonas emisivas (núcleo
    amarillo, cuerpo naranja, borde rojizo) para el estado burning.
  - FireSmoke: bocanada de cuatro masas solapadas, más ancha que alta, con dos alfas, para el estado
    burning. La columna la arma el compositor apilando bocanadas de escala creciente.

No copia ningún asset protegido; vocabulario genérico de obra/daño/fuego. Cada módulo se exporta
como .blend/.glb independiente a sources/original/ para medirlo y registrarlo en el catálogo.

El humo y la llama se escriben vértice a vértice (`from_pydata`) en vez de con primitivas de
operador: las ondulaciones que rompen la silueta son una función continua de la posición del
vértice, así que el resultado es irregular y a la vez reproducible sin semilla.

Uso:
  blender --background --python tools/art-pipeline/blender/create_original_state_modules.py
"""

import bpy
import math
import os


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def material(name, rgb, roughness=0.8, emission=None, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission[0], 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission[1]
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        # El control escribía `Alpha = 0,85` y nada más, así que EEVEE seguía componiendo el material
        # como opaco: las cuatro esferas de humo se veían como cuentas de piedra. `blend_method` cambió
        # de vocabulario con EEVEE Next, así que se prueban los valores de las dos generaciones. Si
        # ninguno casa el humo vuelve a salir sólido, y eso debe verse en la metadata del render.
        for token in ("BLEND", "BLENDED", "HASHED"):
            try:
                mat.blend_method = token
                break
            except TypeError:
                continue
        mat.show_transparent_back = False
    return mat


def box(name, sx, sy, sz, location, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx / 2, sy / 2, sz / 2)
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(mat)
    return obj


def from_pydata_mesh(name, verts, faces, mat):
    """Malla escrita vértice a vértice: sin operadores, así que el resultado no depende del contexto."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def tongue(name, base, height, radius, lean, mat, *, segments=6, rings=4, twist=0.0):
    """Lengua de llama: loft cerrado que se estrecha hacia la punta, se inclina y se retuerce.

    El radio no cae en línea recta: se ensancha a media altura y vuelve a cerrarse, y la sección es
    una elipse que gira con la altura. Un cono de revolución tiene por definición la misma silueta
    desde cualquier ángulo; esta lengua no, y eso es lo que permite que cinco instancias del mismo
    módulo den cinco perfiles distintos con sólo rotarlas.
    """
    verts = []
    for j in range(rings):
        t = j / rings
        bulge = 1.0 + 0.26 * math.sin(math.pi * (0.30 + 1.25 * t))
        r = radius * (1.0 - t) ** 0.55 * bulge
        cx = base[0] + lean[0] * t * t
        cy = base[1] + lean[1] * t * t
        cz = base[2] + height * t
        for k in range(segments):
            theta = 2.0 * math.pi * k / segments + twist * t
            rr = r * (1.0 + 0.22 * math.sin(2.0 * theta + 1.1 * twist))
            verts.append((cx + rr * math.cos(theta), cy + rr * math.sin(theta), cz))
    faces = []
    for j in range(rings - 1):
        for k in range(segments):
            faces.append(
                (
                    j * segments + k,
                    j * segments + (k + 1) % segments,
                    (j + 1) * segments + (k + 1) % segments,
                    (j + 1) * segments + k,
                )
            )
    tip_t = 1.0
    verts.append((base[0] + lean[0] * tip_t, base[1] + lean[1] * tip_t, base[2] + height))
    apex = len(verts) - 1
    top = (rings - 1) * segments
    for k in range(segments):
        faces.append((top + k, top + (k + 1) % segments, apex))
    verts.append(base)
    foot = len(verts) - 1
    for k in range(segments):
        faces.append((foot, (k + 1) % segments, k))
    return from_pydata_mesh(name, verts, faces, mat)


def blob(name, center, radius, mat, *, elongation=1.0, seed=0.0, segments=8, rings=6):
    """Masa de humo: esfera desplazada radialmente por un campo continuo, no por ruido aleatorio.

    La esfera UV del control tenía 10×8 vértices perfectamente regulares y ocho instancias iguales
    formaban un collar de cuentas. Aquí cada vértice se empuja con una función suave de su propia
    dirección, así que el bulto es irregular y reproducible a la vez, y el sombreado suave disimula
    la jaula sin borrar el contorno.
    """
    verts = []
    for j in range(rings + 1):
        phi = math.pi * j / rings
        for k in range(segments):
            theta = 2.0 * math.pi * k / segments
            dx = math.sin(phi) * math.cos(theta)
            dy = math.sin(phi) * math.sin(theta)
            dz = math.cos(phi)
            wobble = (
                0.30 * math.sin(3.1 * dx + 1.7 * dy + seed)
                + 0.22 * math.sin(4.7 * dy + 2.3 * dz + 1.3 * seed)
                + 0.18 * math.sin(5.3 * dz + 0.9 * dx + 2.1 * seed)
            )
            s = 1.0 + 0.34 * wobble
            verts.append(
                (
                    center[0] + radius * elongation * s * dx,
                    center[1] + radius * s * dy,
                    center[2] + radius * elongation * 0.86 * s * dz,
                )
            )
    faces = []
    for j in range(rings):
        for k in range(segments):
            a = j * segments + k
            b = j * segments + (k + 1) % segments
            c = (j + 1) * segments + (k + 1) % segments
            d = (j + 1) * segments + k
            if j == 0:
                faces.append((a, c, d))
            elif j == rings - 1:
                faces.append((a, b, c))
            else:
                faces.append((a, b, c, d))
    return from_pydata_mesh(name, verts, faces, mat)


def join_export(parts, name, filename):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    out_dir = os.path.join(repo_root, "blender_artist", "sources", "original")
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, f"{filename}.blend"))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(out_dir, f"{filename}.glb"), export_format="GLB", use_selection=True
    )
    print(f"Módulo original creado: {name} -> {filename}.glb")


def build_barrier():
    clear_scene()
    orange = material("barrier_orange", (0.85, 0.4, 0.1))
    white = material("barrier_white", (0.9, 0.9, 0.88))
    steel = material("barrier_leg", (0.4, 0.42, 0.45))
    parts = []
    for i, x in enumerate((-0.85, 0.85)):
        parts.append(box(f"leg{i}", 0.06, 0.5, 1.0, (x, 0.0, 0.5), steel))
    parts.append(box("board_top", 1.9, 0.06, 0.23, (0.0, 0.0, 0.99), orange))
    parts.append(box("board_mid", 1.9, 0.06, 0.23, (0.0, 0.0, 0.62), white))
    join_export(parts, "ConstructionBarrier", "construction_barrier")


def build_debris():
    clear_scene()
    rubble = material("debris_rubble", (0.45, 0.42, 0.38))
    brick = material("debris_brick", (0.55, 0.3, 0.22))
    char = material("debris_char", (0.2, 0.18, 0.16))
    parts = []
    # Montón irregular de bloques rotos en distintas posiciones/ángulos ( determinista).
    chunks = [
        (0.0, 0.0, 0.12, 0.5, 0.4, 0.24, 0.2, rubble),
        (-0.35, 0.15, 0.1, 0.34, 0.3, 0.2, 0.5, brick),
        (0.3, -0.1, 0.09, 0.3, 0.28, 0.18, -0.4, rubble),
        (0.1, 0.25, 0.22, 0.26, 0.24, 0.2, 0.9, char),
        (-0.2, -0.2, 0.08, 0.24, 0.22, 0.16, 0.3, brick),
        (0.4, 0.2, 0.07, 0.2, 0.2, 0.14, -0.7, rubble),
        (-0.45, -0.05, 0.06, 0.18, 0.18, 0.12, 0.6, char),
        (0.0, -0.3, 0.16, 0.22, 0.2, 0.18, 1.2, brick),
    ]
    for i, (x, y, z, sx, sy, sz, rz, mat) in enumerate(chunks):
        parts.append(box(f"chunk{i}", sx, sy, sz, (x, y, z), mat, rotation=(0.1 * i, 0.05 * i, rz)))
    join_export(parts, "DamageDebris", "damage_debris")


def build_flame():
    clear_scene()
    # Tres zonas en vez de dos. El control medido (FASE 2) satura el núcleo a (255,255,165) de día y
    # cae a (233,211,173) de noche: con `flame_inner` y `flame_outer` recibiendo la misma fuerza, el
    # motor de render no tiene gradiente que resolver y el resultado es un cono pálido. Núcleo
    # amarillo cálido, cuerpo naranja, borde rojizo, cada uno con su fuerza.
    core = material("flame_core", (1.0, 0.78, 0.22), emission=((1.0, 0.66, 0.16), 2.6))
    body = material("flame_body", (1.0, 0.42, 0.10), emission=((1.0, 0.36, 0.06), 1.9))
    edge = material("flame_edge", (0.72, 0.16, 0.05), emission=((0.62, 0.12, 0.04), 1.1))
    parts = []
    # base, altura, radio, deriva, torsión, material. Las cinco lenguas son distintas en todo: un
    # cono de revolución girado 90° es idéntico a sí mismo, así que mientras la silueta fuera
    # simétrica `rotationDegrees` no aportaba variación ninguna.
    tongues = [
        ((0.00, 0.00, 0.0), 1.00, 0.26, (0.06, -0.03), 0.5, body),
        ((0.02, 0.10, 0.0), 0.66, 0.17, (-0.05, 0.04), 1.9, core),
        ((-0.24, -0.06, 0.0), 0.42, 0.13, (-0.16, 0.05), 0.2, edge),
        ((0.22, 0.08, 0.0), 0.34, 0.11, (0.18, -0.06), 2.6, edge),
        ((0.06, -0.22, 0.0), 0.28, 0.10, (0.02, -0.18), 1.2, edge),
    ]
    for i, (base, height, radius, lean, twist, mat) in enumerate(tongues):
        parts.append(
            tongue(f"flame_tongue_{i}", base, height, radius, lean, mat, twist=twist)
        )
    join_export(parts, "FireFlame", "fire_flame")


def build_smoke():
    clear_scene()
    dense = material("fire_smoke_dense", (0.19, 0.18, 0.175), roughness=1.0, alpha=0.62)
    wisp = material("fire_smoke_wisp", (0.30, 0.27, 0.25), roughness=1.0, alpha=0.34)
    parts = []
    # center, radio, alargue, semilla de ruido, material.
    #
    # Una sola bocanada, no una columna. El módulo anterior medía 5,08 m de alto con cinco esferas
    # enhebradas a radio creciente, así que cualquier instancia del compositor repetía el collar de
    # cuentas DENTRO de sí mismo y el defecto de FASE 2 volvía por otra puerta. La bocanada mide ~2,3
    # m, es más ancha que alta y son cuatro lóbulos que se solapan: la columna la arma el compositor
    # apilando bocanadas de escala creciente, que es donde vive el ensanchamiento.
    #
    # `segments`/`rings` suben de 8/6 a 12/8: el contorno geométrico de una esfera de 10×8 vértices a
    # escala 2 se leía como poliedro. El coste es offline —el navegador sólo ve el PNG—, así que se
    # puede pagar.
    lobes = [
        ((0.00, 0.00, 0.62), 0.62, 1.06, 0.0, dense),
        ((0.34, -0.20, 0.94), 0.48, 1.02, 1.7, dense),
        ((-0.30, 0.24, 1.08), 0.44, 1.08, 3.4, wisp),
        ((0.06, 0.10, 1.48), 0.56, 1.10, 5.1, wisp),
    ]
    for i, (center, radius, elongation, seed, mat) in enumerate(lobes):
        parts.append(
            blob(
                f"smoke_lobe_{i}",
                center,
                radius,
                mat,
                elongation=elongation,
                seed=seed,
                segments=12,
                rings=8,
            )
        )
    join_export(parts, "FireSmoke", "fire_smoke")


def main():
    build_barrier()
    build_debris()
    build_flame()
    build_smoke()


if __name__ == "__main__":
    main()
