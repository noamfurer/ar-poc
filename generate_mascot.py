#!/usr/bin/env python3
import json, math, os, struct

OUT = os.path.join(os.path.dirname(__file__), 'assets', 'red_creature_mascot.glb')
os.makedirs(os.path.dirname(OUT), exist_ok=True)

def uv_sphere(segments=24, rings=16):
    positions=[]; indices=[]
    for r in range(rings+1):
        v=r/rings; phi=math.pi*v
        y=math.cos(phi); sr=math.sin(phi)
        for s in range(segments+1):
            u=s/segments; th=2*math.pi*u
            x=sr*math.cos(th); z=sr*math.sin(th)
            positions.append((x,y,z))
    row=segments+1
    for r in range(rings):
        for s in range(segments):
            a=r*row+s; b=a+row; c=b+1; d=a+1
            if r != 0: indices += [a,b,d]
            if r != rings-1: indices += [d,b,c]
    return positions, indices

def box():
    p=[(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),
       (-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)]
    i=[0,1,2,0,2,3, 4,6,5,4,7,6, 0,4,5,0,5,1,
       3,2,6,3,6,7, 1,5,6,1,6,2, 0,3,7,0,7,4]
    return p,i

def cylinder(segments=20):
    p=[]; i=[]
    for y in (-.5,.5):
        for s in range(segments):
            th=2*math.pi*s/segments
            p.append((math.cos(th),y,math.sin(th)))
    for s in range(segments):
        n=(s+1)%segments
        a=s; b=n; c=segments+n; d=segments+s
        i += [a,d,b, b,d,c]
    bot=len(p); p.append((0,-.5,0))
    top=len(p); p.append((0,.5,0))
    for s in range(segments):
        n=(s+1)%segments
        i += [bot,n,s]
        i += [top,segments+s,segments+n]
    return p,i

binbuf=bytearray(); bufferViews=[]; accessors=[]; meshes=[]; nodes=[]; materials=[]

def align4():
    while len(binbuf)%4: binbuf.append(0)

def add_view(data, target=None):
    align4(); off=len(binbuf); binbuf.extend(data)
    v={'buffer':0,'byteOffset':off,'byteLength':len(data)}
    if target is not None: v['target']=target
    bufferViews.append(v); return len(bufferViews)-1

def add_accessor_f32(values, typ, count, mins=None, maxs=None):
    flat=[]
    for v in values:
        if isinstance(v,(tuple,list)): flat.extend(v)
        else: flat.append(v)
    data=struct.pack('<'+'f'*len(flat), *flat)
    vi=add_view(data)
    a={'bufferView':vi,'componentType':5126,'count':count,'type':typ}
    if mins is not None: a['min']=mins
    if maxs is not None: a['max']=maxs
    accessors.append(a); return len(accessors)-1

def add_geom(pos, ind):
    flat=[c for v in pos for c in v]
    pv=add_view(struct.pack('<'+'f'*len(flat),*flat),34962)
    mins=[min(v[k] for v in pos) for k in range(3)]
    maxs=[max(v[k] for v in pos) for k in range(3)]
    pa={'bufferView':pv,'componentType':5126,'count':len(pos),'type':'VEC3','min':mins,'max':maxs}
    accessors.append(pa); pai=len(accessors)-1
    if max(ind) < 65536:
        iv=add_view(struct.pack('<'+'H'*len(ind),*ind),34963); ct=5123
    else:
        iv=add_view(struct.pack('<'+'I'*len(ind),*ind),34963); ct=5125
    ia={'bufferView':iv,'componentType':ct,'count':len(ind),'type':'SCALAR'}
    accessors.append(ia); iai=len(accessors)-1
    return pai,iai

def mat(name, rgba):
    materials.append({
      'name':name,
      'pbrMetallicRoughness':{'baseColorFactor':rgba,'metallicFactor':0.0,'roughnessFactor':0.85},
      'doubleSided':True,
      'extensions':{'KHR_materials_unlit':{}}
    })
    return len(materials)-1

MAT_BODY=mat('Warm White Body',[0.98,0.965,0.925,1])
MAT_RED=mat('Logo Red',[0.93,0.055,0.075,1])
MAT_EYE=mat('Eye White',[1,1,1,1])
MAT_BLACK=mat('Pupil',[0.025,0.025,0.035,1])
MAT_SIGN=mat('Sign White',[1,0.995,0.97,1])
MAT_PINK=mat('Cheek',[1.0,0.55,0.58,1])

sphere_pa,sphere_ia=add_geom(*uv_sphere())
box_pa,box_ia=add_geom(*box())
cyl_pa,cyl_ia=add_geom(*cylinder())

def mesh_variant(name, geom, material):
    pa,ia=geom
    meshes.append({'name':name,'primitives':[{'attributes':{'POSITION':pa},'indices':ia,'material':material}]})
    return len(meshes)-1

sphere_mesh={
 'body':mesh_variant('sphere_body',(sphere_pa,sphere_ia),MAT_BODY),
 'red':mesh_variant('sphere_red',(sphere_pa,sphere_ia),MAT_RED),
 'eye':mesh_variant('sphere_eye',(sphere_pa,sphere_ia),MAT_EYE),
 'black':mesh_variant('sphere_black',(sphere_pa,sphere_ia),MAT_BLACK),
 'pink':mesh_variant('sphere_pink',(sphere_pa,sphere_ia),MAT_PINK),
}
box_mesh={
 'red':mesh_variant('box_red',(box_pa,box_ia),MAT_RED),
 'sign':mesh_variant('box_sign',(box_pa,box_ia),MAT_SIGN),
}
cyl_mesh={
 'body':mesh_variant('cyl_body',(cyl_pa,cyl_ia),MAT_BODY),
 'red':mesh_variant('cyl_red',(cyl_pa,cyl_ia),MAT_RED),
}

def quat_euler(rx=0, ry=0, rz=0):
    rx,ry,rz=[math.radians(v)/2 for v in (rx,ry,rz)]
    cx,sx=math.cos(rx),math.sin(rx); cy,sy=math.cos(ry),math.sin(ry); cz,sz=math.cos(rz),math.sin(rz)
    x=sx*cy*cz + cx*sy*sz
    y=cx*sy*cz - sx*cy*sz
    z=cx*cy*sz + sx*sy*cz
    w=cx*cy*cz - sx*sy*sz
    return [x,y,z,w]

def node(name, mesh=None, translation=None, rotation=None, scale=None, children=None):
    n={'name':name}
    if mesh is not None: n['mesh']=mesh
    if translation is not None: n['translation']=translation
    if rotation is not None: n['rotation']=rotation
    if scale is not None: n['scale']=scale
    if children: n['children']=children
    nodes.append(n); return len(nodes)-1

root=node('mascot_root',translation=[-0.55,0,-0.08],rotation=quat_euler(0,-14,0),scale=[1,1,1])
body_children=[]
body_children.append(node('body',sphere_mesh['body'],[0,0.55,0],[0,0,0,1],[0.44,0.58,0.36]))
body_children.append(node('belly',sphere_mesh['body'],[0,0.28,0.01],[0,0,0,1],[0.38,0.38,0.34]))
body_children.append(node('ear_L',sphere_mesh['red'],[-0.33,1.03,0.02],quat_euler(0,0,24),[0.13,0.28,0.075]))
body_children.append(node('ear_R',sphere_mesh['red'],[0.33,1.03,0.02],quat_euler(0,0,-24),[0.13,0.28,0.075]))
for x in (-0.15,0.15):
    body_children.append(node('eye_white',sphere_mesh['eye'],[x,0.78,0.315],[0,0,0,1],[0.13,0.17,0.07]))
    body_children.append(node('pupil',sphere_mesh['black'],[x,0.78,0.372],[0,0,0,1],[0.058,0.078,0.028]))
    body_children.append(node('eye_glint',sphere_mesh['eye'],[x-0.018,0.815,0.397],[0,0,0,1],[0.016,0.021,0.010]))
body_children.append(node('cheek_L',sphere_mesh['pink'],[-0.27,0.60,0.33],[0,0,0,1],[0.065,0.035,0.018]))
body_children.append(node('cheek_R',sphere_mesh['pink'],[0.27,0.60,0.33],[0,0,0,1],[0.065,0.035,0.018]))
body_children.append(node('mouth',sphere_mesh['red'],[0,0.55,0.36],[0,0,0,1],[0.055,0.022,0.016]))
body_children.append(node('foot_L',sphere_mesh['red'],[-0.18,-0.02,0.06],quat_euler(0,0,-8),[0.19,0.075,0.23]))
body_children.append(node('foot_R',sphere_mesh['red'],[0.18,-0.02,0.06],quat_euler(0,0,8),[0.19,0.075,0.23]))
body_children.append(node('arm_L',cyl_mesh['body'],[-0.43,0.43,0.02],quat_euler(0,0,-28),[0.065,0.27,0.065]))
body_children.append(node('arm_R',cyl_mesh['body'],[0.43,0.43,0.02],quat_euler(0,0,28),[0.065,0.27,0.065]))

feathers=[
 (-0.16,0.48,0.348, 18, .095,.155), (0.0,0.50,0.365, 0,.10,.17), (0.16,0.48,0.348,-18,.095,.155),
 (-0.10,0.30,0.335,-12,.085,.135),(0.10,0.30,0.335,12,.085,.135),
 (0.0,0.15,0.29,0,.075,.115)
]
for i,(x,y,z,ang,sx,sy) in enumerate(feathers):
    body_children.append(node(f'feather_{i}',sphere_mesh['red'],[x,y,z],quat_euler(0,0,ang),[sx,sy,0.035]))

sign_children=[]
sign_children.append(node('sign_border',box_mesh['red'],[0,0,0],[0,0,0,1],[0.68,0.25,0.035]))
sign_children.append(node('sign_face',box_mesh['sign'],[0,0,0.038],[0,0,0,1],[0.62,0.20,0.025]))
for x,y,ang in [(-0.08,0.02,20),(0,0.02,0),(0.08,0.02,-20)]:
    sign_children.append(node('sign_logo',sphere_mesh['red'],[x,y,0.075],quat_euler(90,0,ang),[0.033,0.060,0.014]))
sign_children.append(node('raise_arm_L',cyl_mesh['body'],[-0.28,-0.22,0.0],quat_euler(0,0,-10),[0.055,0.24,0.055]))
sign_children.append(node('raise_arm_R',cyl_mesh['body'],[0.28,-0.22,0.0],quat_euler(0,0,10),[0.055,0.24,0.055]))
sign_children.append(node('hand_L',sphere_mesh['body'],[-0.28,-0.04,0.0],[0,0,0,1],[0.075,0.075,0.075]))
sign_children.append(node('hand_R',sphere_mesh['body'],[0.28,-0.04,0.0],[0,0,0,1],[0.075,0.075,0.075]))
sign_rig=node('sign_rig',translation=[0,0.22,0.42],children=sign_children)
body_children.append(sign_rig)
nodes[root]['children']=body_children

def add_anim_accessor(values, typ):
    count=len(values)
    mins=maxs=None
    if typ=='SCALAR':
        mins=[min(values)]; maxs=[max(values)]
    return add_accessor_f32(values,typ,count,mins,maxs)

def animation(name, tracks):
    samplers=[]; channels=[]
    for node_idx,path,times,values in tracks:
        ti=add_anim_accessor(times,'SCALAR')
        typ='VEC3' if path in ('translation','scale') else 'VEC4'
        oi=add_anim_accessor(values,typ)
        samplers.append({'input':ti,'output':oi,'interpolation':'LINEAR'})
        channels.append({'sampler':len(samplers)-1,'target':{'node':node_idx,'path':path}})
    return {'name':name,'samplers':samplers,'channels':channels}

entrance_times=[0.0,0.55,1.05,1.45,1.9,2.35,2.85,3.2]
entrance_pos=[
 [-0.55,0,-0.08],[-0.38,0,-0.035],[-0.35,0,-0.02],[-0.35,0,-0.02],
 [-0.18,0,0.08],[0,0,0.18],[0,0.05,0.20],[0,0.02,0.20]
]
entrance_rot=[
 quat_euler(0,-16,0),quat_euler(0,-8,0),quat_euler(0,16,0),quat_euler(0,-16,0),
 quat_euler(0,8,0),quat_euler(0,0,0),quat_euler(0,0,4),quat_euler(0,0,0)
]
sign_times=[0.0,2.25,2.55,2.95,3.2]
sign_pos=[[0,0.22,0.42],[0,0.22,0.42],[0,0.72,0.42],[0,1.14,0.42],[0,1.10,0.42]]

entrance=animation('Entrance',[
 (root,'translation',entrance_times,entrance_pos),
 (root,'rotation',entrance_times,entrance_rot),
 (sign_rig,'translation',sign_times,sign_pos),
])

dance_times=[0.0,0.28,0.56,0.84,1.12,1.4]
dance_pos=[[0,0.02,0.20],[0.045,0.08,0.20],[0,0.02,0.20],[-0.045,0.08,0.20],[0,0.02,0.20],[0,0.02,0.20]]
dance_rot=[quat_euler(0,0,0),quat_euler(0,7,7),quat_euler(0,0,0),quat_euler(0,-7,-7),quat_euler(0,0,0),quat_euler(0,0,0)]
sign_rot=[quat_euler(0,0,0),quat_euler(0,0,-4),quat_euler(0,0,0),quat_euler(0,0,4),quat_euler(0,0,0),quat_euler(0,0,0)]
dance=animation('Dance',[
 (root,'translation',dance_times,dance_pos),
 (root,'rotation',dance_times,dance_rot),
 (sign_rig,'rotation',dance_times,sign_rot),
])

gltf={
 'asset':{'version':'2.0','generator':'OpenAI procedural mascot generator'},
 'scene':0,
 'scenes':[{'name':'Mascot Scene','nodes':[root]}],
 'nodes':nodes,
 'meshes':meshes,
 'materials':materials,
 'buffers':[{'byteLength':len(binbuf)}],
 'bufferViews':bufferViews,
 'accessors':accessors,
 'animations':[entrance,dance],
 'extensionsUsed':['KHR_materials_unlit']
}

j=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode('utf-8')
while len(j)%4: j += b' '
while len(binbuf)%4: binbuf.append(0)
gltf['buffers'][0]['byteLength']=len(binbuf)
j=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode('utf-8')
while len(j)%4: j += b' '
length=12+8+len(j)+8+len(binbuf)
with open(OUT,'wb') as f:
    f.write(struct.pack('<4sII',b'glTF',2,length))
    f.write(struct.pack('<II',len(j),0x4E4F534A)); f.write(j)
    f.write(struct.pack('<II',len(binbuf),0x004E4942)); f.write(binbuf)
print(OUT)
