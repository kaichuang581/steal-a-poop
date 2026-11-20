# Renders the farm animals in Blender as the game builds them, set up like Brian's reference picture (2026-11-18): a
# white studio floor, soft light from the upper left, the six in a row (cow, sheep, chicken, horse, pig, goat) turned
# three-quarters to the left, every voxel's edges rounded a little.
#   npx vite-node tools/blender/dumpAnimals.ts -- --out /tmp/animals.json
#   /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/blender/lineup.py -- /tmp/animals.json out.png [species] [samples]
# With a species, renders that animal alone, framed close (for side-by-side checks against a crop of the reference).
# With a species and `sheet` after the samples, renders its six orthographic views (front, back, left, right, top,
# bottom) as out-<view>.png, like Brian's turnaround sheets; tools/blender/sheet.mjs lays them out on one page.
import json
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
only = argv[2] if len(argv) > 2 and argv[2] != 'all' else None
samples = int(argv[3]) if len(argv) > 3 else 64
sheet = len(argv) > 4 and argv[4] == 'sheet'
data = json.load(open(src))

ORDER = ['cow', 'sheep', 'chicken', 'horse', 'pig', 'goat']
# Where each stands along the row (metres), from the reference's spacing.
ROW_X = {'cow': 0.0, 'sheep': 1.84, 'chicken': 3.3, 'horse': 4.8, 'pig': 6.6, 'goat': 8.1}
YAW = 0.0 if sheet else math.radians(-40)  # the model faces three's +z (Blender -Y); turned to face left and a little toward the camera

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

N6 = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
# The four corners of each face of a unit cell, counter-clockwise from outside.
QUADS = {
    (1, 0, 0): [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)],
    (-1, 0, 0): [(0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)],
    (0, 1, 0): [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)],
    (0, -1, 0): [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)],
    (0, 0, 1): [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)],
    (0, 0, -1): [(0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)],
}


def material():
    m = bpy.data.materials.new('voxel')
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.7
    return m


MAT = material()


def mesh_from(cells, size, origin, name):
    """Only the faces a cell shows (no neighbour in the same group); shared corners; colours per corner."""
    # A cell listed twice (a feature kept both in its part and in the head's own cells) is drawn once.
    cells = list({(c[0], c[1], c[2]): c for c in cells}.values())
    occ = {(c[0], c[1], c[2]) for c in cells}
    verts, index, faces, cols = [], {}, [], []

    def vid(p):
        if p not in index:
            index[p] = len(verts)
            # three (x, y, z) to Blender (x, -z, y), about the origin, in metres
            verts.append(((p[0] * size) - origin[0], -((p[2] * size) - origin[2]), (p[1] * size) - origin[1]))
        return index[p]

    for c in cells:
        x, y, z = c[0], c[1], c[2]
        for d in N6:
            if (x + d[0], y + d[1], z + d[2]) in occ:
                continue
            faces.append([vid((x + q[0], y + q[1], z + q[2])) for q in QUADS[d]])
            cols.append((c[3], c[4], c[5], 1.0))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    k = 0
    for i, poly in enumerate(me.polygons):
        for _ in poly.loop_indices:
            attr.data[k].color = cols[i]
            k += 1
    me.materials.append(MAT)
    ob = bpy.data.objects.new(name, me)
    bev = ob.modifiers.new('round', 'BEVEL')
    bev.width = size * 0.18
    bev.segments = 3
    bev.limit_method = 'ANGLE'
    bev.harden_normals = False
    return ob


def animal(sp, at):
    d = data[sp]
    size, k = d['size'], d['drawScale']
    root = bpy.data.objects.new(sp, None)
    scene.collection.objects.link(root)
    root.location = at
    root.rotation_euler = (0, 0, YAW)
    root.scale = (k, k, k)
    body = mesh_from(d['body'], size, (0, 0, 0), sp + '-body')
    scene.collection.objects.link(body)
    body.parent = root
    piv = d['headPivot']
    head = mesh_from(d['head'], size, piv, sp + '-head')
    scene.collection.objects.link(head)
    head.parent = root
    head.location = (piv[0], -piv[2], piv[1])
    head.rotation_euler = (d['headPitch'], 0, 0)
    return root


species = [only] if only else ORDER
for sp in species:
    animal(sp, (0, 0, 0) if only else (ROW_X[sp], 0, 0))

# ---- Floor and world: a white studio, the floor bright and matte.
bpy.ops.mesh.primitive_plane_add(size=400, location=(4, 150, 0))
floor = bpy.context.active_object
fm = bpy.data.materials.new('floor')
fm.use_nodes = True
fb = fm.node_tree.nodes['Principled BSDF']
fb.inputs['Base Color'].default_value = (0.8, 0.8, 0.79, 1)
fb.inputs['Roughness'].default_value = 0.9
floor.data.materials.append(fm)
world = bpy.data.worlds.new('w')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.9, 0.9, 0.89, 1)
bg.inputs['Strength'].default_value = 0.55
# The camera sees a brighter, even backdrop (the reference's seamless white); everything else is lit by the dimmer one.
wn = world.node_tree.nodes
path, mix, seen = wn.new('ShaderNodeLightPath'), wn.new('ShaderNodeMixShader'), wn.new('ShaderNodeBackground')
seen.inputs['Color'].default_value = (0.93, 0.93, 0.92, 1)
seen.inputs['Strength'].default_value = 1.0
world.node_tree.links.new(path.outputs['Is Camera Ray'], mix.inputs['Fac'])
world.node_tree.links.new(bg.outputs['Background'], mix.inputs[1])
world.node_tree.links.new(seen.outputs['Background'], mix.inputs[2])
world.node_tree.links.new(mix.outputs['Shader'], wn['World Output'].inputs['Surface'])

# ---- Key light: a big soft area light high on the left, toward the camera.
light = bpy.data.lights.new('key', 'AREA')
light.size = 7
light.energy = 1700
key = bpy.data.objects.new('key', light)
scene.collection.objects.link(key)
key.location = (-3, -7, 9)
centre = Vector((0, 0, 0.5)) if only else Vector((4.05, 0, 0.5))
key.location = centre + Vector((-6, -6, 8))
key.rotation_euler = (centre - key.location).to_track_quat('-Z', 'Y').to_euler()

# ---- Camera: a little above, three-quarters of the row's width in a 1024 x 572 frame.
cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 50
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
if only:
    d = data[only]
    hgt = (max(c[1] for c in d['body'] + d['head']) + 1) * d['size'] * d['drawScale']
    dist = 3.2 * max(hgt, 0.7)
    target = Vector((0, 0, hgt * 0.5))
    cam.location = target + Vector((0, -dist, dist * 0.2))
    scene.render.resolution_x, scene.render.resolution_y = 640, 640
else:
    target = Vector((3.85, 0, 0.62))
    cam.location = target + Vector((0, -14.2, 2.7))
    scene.render.resolution_x, scene.render.resolution_y = 1024, 572
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()

scene.render.engine = 'CYCLES'
scene.cycles.samples = samples
scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for dev in prefs.devices:
        dev.use = True
    scene.cycles.device = 'GPU'
except Exception:
    pass
scene.view_settings.view_transform = 'Standard'
scene.view_settings.exposure = 0.0
if not sheet:
    scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print('wrote', out)
else:
    # Six orthographic views, one scale for all: Blender's -Y is the animal's front, +X its left side.
    lo = Vector((1e9, 1e9, 1e9)); hi = -lo
    for ob in scene.objects:
        if ob.type != 'MESH' or ob == floor:
            continue
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            lo = Vector((min(lo[i], w[i]) for i in range(3))); hi = Vector((max(hi[i], w[i]) for i in range(3)))
    mid = (lo + hi) / 2
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = max(hi - lo) * 1.15
    scene.render.resolution_x, scene.render.resolution_y = 600, 600
    D = 20
    views = {
        'front': (Vector((mid.x, lo.y - D, mid.z)), (math.radians(90), 0, 0)),
        'back': (Vector((mid.x, hi.y + D, mid.z)), (math.radians(90), 0, math.radians(180))),
        'left': (Vector((hi.x + D, mid.y, mid.z)), (math.radians(90), 0, math.radians(90))),
        'right': (Vector((lo.x - D, mid.y, mid.z)), (math.radians(90), 0, math.radians(-90))),
        'top': (Vector((mid.x, mid.y, hi.z + D)), (0, 0, math.radians(90))),
        'bottom': (Vector((mid.x, mid.y, lo.z - D)), (math.radians(180), 0, math.radians(90))),
    }
    for name, (loc, rot) in views.items():
        cam.location = loc
        cam.rotation_euler = rot
        floor.hide_render = name in ('top', 'bottom')
        scene.render.filepath = out.replace('.png', f'-{name}.png')
        bpy.ops.render.render(write_still=True)
        print('wrote', scene.render.filepath)
