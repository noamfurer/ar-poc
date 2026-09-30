/* The supplied model is Z-up, with its face toward +Y. Keep its sign texture intact. */
AFRAME.registerComponent('mascot-performance', {
  init() {
    this.ready = false;
    this.tracked = false;
    this.elapsed = 0;
    this.target = this.el.closest('[mindar-image-target]');
    this.onFound = () => {
      if (!this.tracked) this.elapsed = 0;
      this.tracked = true;
      this.el.object3D.visible = this.ready;
    };
    this.onLost = () => {
      this.tracked = false;
      this.el.object3D.visible = false;
      this.elapsed = 0;
    };
    this.target.addEventListener('targetFound', this.onFound);
    this.target.addEventListener('targetLost', this.onLost);
    this.el.addEventListener('model-loaded', ({detail}) => this.prepare(detail.model));
    this.el.addEventListener('model-error', () => {
      document.getElementById('status').textContent = 'לא ניתן לטעון את הדמות. רענן את העמוד.';
    });
    this.el.object3D.visible = false;
  },
  prepare(model) {
    const T = AFRAME.THREE;
    this.model = model;
    // MindAR uses a zero matrix while the target is hidden. Rig in a detached
    // coordinate frame so attach() never inverts that singular matrix.
    const originalParent = model.parent;
    model.removeFromParent();
    model.updateMatrixWorld(true);
    const ground = model.getObjectByName('ground');
    if (ground) ground.removeFromParent();
    // Mesh vertices are baked in the model's common coordinate system.
    // attach() reparents them without changing their original rest pose.
    const byName = new Map();
    model.traverse(o => { if (o.isMesh) byName.set(o.name, o); });
    const pivot = (name, position, names, parent = model) => {
      const group = new T.Group();
      group.name = name;
      group.position.set(...position);
      parent.add(group);
      model.updateMatrixWorld(true);
      names.forEach(name => { const mesh = byName.get(name); if (mesh) group.attach(mesh); });
      return group;
    };
    this.upper = pivot('upper_body_motion', [0, 0, 0.45], []);
    this.head = pivot('head_motion', [0, 0, 0.75], [...byName.keys()].filter(n => /^(head|visor|iris|pupil|shine|smile|brow|ear)/.test(n)), this.upper);
    this.waveArm = pivot('wave_arm_motion', [0.34, 0.03, 0.58], ['shoulder_r','upperarm_r','lowerarm_r','hand_r','armpad_2','armpad_3'], this.upper);
    this.signArm = pivot('sign_arm_motion', [-0.34, 0.03, 0.58], ['shoulder_l','upperarm_l','lowerarm_l','hand_l','hand_l_palm','armpad_0','armpad_1','sign_board','sign_texture_plane','sign_pole','excite_0','excite_1'], this.upper);
    this.leftLeg = pivot('left_step', [-0.16, 0, 0.3], ['thigh_l','knee_l','shin_l','foot_l','sole_l','legpad_0']);
    this.rightLeg = pivot('right_step', [0.16, 0.06, 0.3], ['thigh_r','knee_r','shin_r','foot_r','sole_r','legpad_1']);
    model.updateMatrixWorld(true);
    byName.forEach(mesh => { if (mesh.parent.name === 'world') this.upper.attach(mesh); });
    // Original geometry and texture bytes remain unchanged.
    // The supplied sign plane has inward winding and inverted UVs when viewed
    // from the robot's front. Correct display only; preserve the embedded image.
    const signText = byName.get('sign_texture_plane');
    if (signText) {
      signText.material = signText.material.clone();
      signText.material.side = T.DoubleSide;
      signText.material.color.set(0xffffff);
      signText.material.metalness = 0;
      const uv = signText.geometry.attributes.uv;
      if (uv) {
        signText.geometry = signText.geometry.clone();
        const fixed = signText.geometry.attributes.uv;
        for (let i = 0; i < fixed.count; i++) fixed.setXY(i, 1 - fixed.getX(i), 1 - fixed.getY(i));
        fixed.needsUpdate = true;
      }
    }
    const sole = byName.get('sole_l');
    sole.geometry.computeBoundingBox();
    this.floorOffset = -sole.geometry.boundingBox.min.z;
    originalParent.add(model);
    this.ready = true;
    this.el.object3D.visible = this.tracked;
    this.pose(0);
  },
  pose(t) {
    const root = this.el.object3D;
    const rise = Math.min(t / 1.35, 1);
    const ease = 1 - Math.pow(1 - rise, 3);
    const danceT = Math.max(0, t - 1.35);
    const beat = danceT * Math.PI * 2 / 1.5;
    const intensity = Math.min(danceT / 0.7, 1);
    const cycle = danceT % 12;
    const wave = Math.sin(Math.PI * Math.min(Math.max((cycle - 2) / 4, 0), 1)) ** 2;
    const s = 0.34;
    root.scale.setScalar(s);
    root.position.set(0, 0, this.floorOffset * s - (1 - ease) * 1.08);
    root.rotation.set(0, 0, Math.PI + Math.sin(beat / 2) * 0.10 * intensity);
    this.upper.rotation.y = Math.sin(beat) * 0.065 * intensity;
    this.upper.position.z = 0.45 + Math.pow(Math.sin(beat), 2) * 0.025 * intensity;
    this.head.rotation.y = -Math.sin(beat) * 0.075 * intensity;
    this.head.rotation.z = Math.sin(beat / 2) * 0.09 * intensity;
    // The free hand lifts from its shoulder to wave. Sign, pole and holding hand move together.
    this.waveArm.rotation.y = (-0.12 - wave * 1.65 + wave * Math.sin(danceT * 12) * 0.18) * intensity;
    this.waveArm.rotation.x = Math.sin(beat) * 0.08 * intensity;
    this.signArm.rotation.y = Math.sin(beat / 2 + 0.4) * 0.08 * intensity;
    this.signArm.rotation.x = Math.sin(beat / 2) * 0.04 * intensity;
    this.leftLeg.position.z = 0.3 + Math.max(0, Math.sin(beat)) * 0.06 * intensity;
    this.rightLeg.position.z = 0.3 + Math.max(0, -Math.sin(beat)) * 0.06 * intensity;
    this.leftLeg.position.y = Math.max(0, Math.sin(beat)) * 0.035 * intensity;
    this.rightLeg.position.y = 0.06 + Math.max(0, -Math.sin(beat)) * 0.035 * intensity;
  },
  tick(time, delta) {
    if (!this.ready || !this.tracked) return;
    this.elapsed += Math.min(delta, 50) / 1000;
    this.pose(this.elapsed);
  },
  remove() {
    this.target.removeEventListener('targetFound', this.onFound);
    this.target.removeEventListener('targetLost', this.onLost);
  }
});
AFRAME.registerComponent('table-occluder', {
  init() {
    const T = AFRAME.THREE;
    const mesh = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshBasicMaterial({colorWrite:false, depthWrite:true, side:T.DoubleSide}));
    mesh.renderOrder = -10;
    this.el.setObject3D('mesh', mesh);
  },
  remove() {
    const mesh = this.el.getObject3D('mesh');
    if (mesh) { mesh.geometry.dispose(); mesh.material.dispose(); }
  }
});
