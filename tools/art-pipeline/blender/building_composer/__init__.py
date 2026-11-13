"""Building Composer (V.f): núcleo determinista de composición modular.

Los módulos de este paquete que no necesitan `bpy` (prng, module_catalog, style_profile, anchors,
grammar, compose) funcionan con el `python3` del sistema: así §32 puede comprobar composición, firma y
anclajes sin arrancar Blender, y el render queda acotado a `scene.py`.
"""
