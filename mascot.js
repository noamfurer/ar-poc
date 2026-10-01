/* The supplied model is Z-up, with its face toward +Y. Keep its sign texture intact. */
AFRAME.registerComponent('mascot-performance', {
  init() {
    this.ready = false;
    this.tracked = false;
    this.elapsed = 0;
    this.appearedAt = null;
    this.mouthLevel = 0;
    this.target = this.el.closest('[mindar-image-target]');
    this.onFound = () => {
      if (!this.tracked) { this.elapsed = 0; this.appearedAt = this.ready ? performance.now() : null; }
      this.tracked = true;
      this.el.object3D.visible = this.ready;
    };
    this.onLost = () => {
      this.tracked = false;
      this.el.object3D.visible = false;
      this.elapsed = 0;
      this.appearedAt = null;
      window.RobotSpeech?.pause();
      this.updateMouth(0);
    };
    this.onVisibility = () => {
      if (document.hidden) {
        window.RobotSpeech?.pause();
        this.updateMouth(0);
      } else if (this.tracked && this.ready) {
        this.appearedAt = performance.now();
      }
    };
    document.addEventListener('visibilitychange', this.onVisibility);
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
    // The supplied mesh has no jaw or blend shapes. Add a small articulated
    // screen-mouth at the original smile, and move both lips with the recording.
    this.originalSmile = byName.get('smile');
    this.mouth = new T.Group();
    this.mouth.name = 'speech_mouth';
    this.mouth.position.set(0, 0.457, 1.565);
    model.add(this.mouth);
    model.updateMatrixWorld(true);
    this.head.attach(this.mouth);
    const dark = new T.MeshBasicMaterial({color: 0x160b10});
    this.cavity = new T.Mesh(new T.SphereGeometry(1, 24, 16), dark);
    this.cavity.scale.set(0.06, 0.008, 0.004);
    this.mouth.add(this.cavity);
    const makeLip = (points) => {
      const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
      return new T.Mesh(new T.TubeGeometry(curve, 16, 0.004, 6, false), new T.MeshBasicMaterial({color: 0xffeee5}));
    };
    this.topLip = makeLip([[-0.055,0.010,0.004],[0,0.011,0.008],[0.055,0.010,0.004]]);
    this.bottomLip = makeLip([[-0.055,0.010,0.004],[0,0.011,-0.009],[0.055,0.010,0.004]]);
    this.mouth.add(this.topLip, this.bottomLip);
    this.mouth.visible = false;
    const sole = byName.get('sole_l');
    sole.geometry.computeBoundingBox();
    this.floorOffset = -sole.geometry.boundingBox.min.z;
    originalParent.add(model);
    this.ready = true;
    if (this.tracked) this.appearedAt = performance.now();
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
  updateMouth(level) {
    if (!this.mouth) return;
    this.mouthLevel = level;
    const talking = level > 0.025;
    this.mouth.visible = talking;
    if (this.originalSmile) this.originalSmile.visible = !talking;
    this.cavity.scale.set(0.06 - level * 0.012, 0.008, 0.004 + level * 0.031);
    this.topLip.position.z = level * 0.021;
    this.bottomLip.position.z = -level * 0.027;
    this.topLip.scale.x = this.bottomLip.scale.x = 1 - level * 0.16;
  },
  tick(time, delta) {
    if (!this.ready || !this.tracked || document.hidden) return;
    if (this.appearedAt === null) this.appearedAt = performance.now();
    this.elapsed = (performance.now() - this.appearedAt) / 1000;
    this.pose(this.elapsed);
    // Entrance lasts 1.35 s. Start five seconds after fully emerging.
    if (this.elapsed >= 1.35 + 5) window.RobotSpeech?.play();
    this.updateMouth(window.RobotSpeech?.level() || 0);
  },
  remove() {
    window.RobotSpeech?.pause();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.mouth?.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
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
