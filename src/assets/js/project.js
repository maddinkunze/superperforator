class Project extends BaseProject {
  static VERSION = APP_VERSION;

  html_element = document.getElementById("settings-container");

  project = new ProjectSettings(this, "Project");
  machine = new MachineSettings(this, "Machine");
  paper = new PaperSettings(this, "Paper");
  objects = new ObjectList(this, "Objects", this._object);
  _object = new ObjectSettings(this, "Object");
  display = new DisplaySettings(this, "Display");
  output = new OutputSettings(this, "Output");

  static SETTINGS_MAP = ["project", "machine", "paper", "objects", "display", "output"];

  canvas_render_back = document.getElementById("render-canvas-back");
  canvas_render_front = document.getElementById("render-canvas-front");
  output_perforation_front = "";
  canvas_preview_back = document.getElementById("preview-canvas-back");
  canvas_preview_front = document.getElementById("preview-canvas-front");

  get_filename() {
    return this.project.name.value + PROJECT_FILE_EXTENSION;
  }

  async export() {
    var [width, height] = this.paper.calc_size();
    const ppmm = dpi_to_ppmm(parseFloat(this.output.quality.value))
    width = Math.round(ppmm * width);
    height = Math.round(ppmm * height);
    this.canvas_render_back.width = width;
    this.canvas_render_back.height = height;
    this.canvas_render_front.width = width;
    this.canvas_render_front.height = height;

    await this.draw(false);
    
    saveAs(this.canvas_render_back.toDataURL("image/png"), "back.png");
    saveAs(this.canvas_render_front.toDataURL("image/png"), "front.png");
    saveAs(new Blob([this.output_perforation_front]), "laser.gcode");
  }

  update_constraints() {
    this.draw(true);
  }

  get_machine_writer() {
    return new GCodeWriterLaser(this.machine.power.value, this.machine.feedrate_cut.to_mms(), this.machine.feedrate_travel.to_mms());
  }

  async draw(preview) {
    loadingScreen.show();
    const canvas_back = preview ? this.canvas_preview_back : this.canvas_render_back;
    const canvas_front = preview ? this.canvas_preview_front : this.canvas_render_front;
    const context_back = canvas_back.getContext("2d");
    const context_front = canvas_front.getContext("2d");
    const contexts = [context_back, context_front];
    const perforator_front = new Perforator(
      this.paper.width_bridge.to_mm(),
      this.paper.width_perf_cut.to_mm(),
      this.paper.width_perf_material.to_mm(),
      preview
        ? new CanvasLineWriter(context_front, parseFloat(this.display.line_width.value), this.display.line_color.value)
        : this.get_machine_writer(),
    );
    
    const [width_mm, height_mm] = this.paper.calc_size();
    const width_px = canvas_back.clientWidth;
    const height_px = canvas_back.clientHeight;
    const width_ppm = width_px / width_mm;
    const height_ppm = height_px / height_mm;
    const scale_factor = Math.min(width_ppm, height_ppm);
    const width_mm_out = width_px / scale_factor;
    const height_mm_out = height_px / scale_factor;

    // transform canvas, such that 1 drawing unit = 1 mm and (0, 0) is always the top left corner of the paper
    contexts.forEach(function(c) {
      reset_canvas(c);
      c.save();
      c.scale(scale_factor, scale_factor);
      c.translate((width_mm_out-width_mm)/2, (height_mm_out-height_mm)/2);
    });

    // draw (usually white) paper background for preview
    // dont draw background in render, because the paper could be non-white, but the printer should not print the paper color again
    if (preview) contexts.forEach(function(c) {
      c.fillStyle = "#ffffff"; // TODO: paper color
      c.fillRect(0, 0, width_mm, height_mm);
    });
    // clip paper -> prohibit drawing outside of paper area
    contexts.forEach(function(c) {
      c.beginPath();
      c.rect(0, 0, width_mm, height_mm);
      c.clip();
    });

    await this.paper.draw(context_front);

    // check if back needs to be drawn:
    //  - render: definitely
    //  - preview: only if there are "holes" in the front; i.e. "Hide Cutouts" option is set
    const hide_cutouts = this.display.hide_cutouts.checked;
    const draw_back = !preview || hide_cutouts;
    perforator_front.start();
    for (var i=0; i<this.objects.objects.length; i++) {
      const obj = this.objects.objects[i];
      if (!obj.settings.visibility[preview ? "preview" : "final"]) { continue; }
      if (draw_back) await obj.draw_back(context_back);
      obj.perforate_front(perforator_front);
      obj.draw_front(context_front);
    }
    perforator_front.stop();

    if (preview && hide_cutouts) {
      const cutter_front = new Perforator(0, 0, 0, new CanvasCutterWriter(context_front));
      cutter_front.start();
      for (var i=0; i<this.objects.objects.length; i++) {
        const obj = this.objects.objects[i];
        if (!obj.settings.visibility.preview) { continue; }
        obj.perforate_front(cutter_front);
      }
      cutter_front.stop();
    }

    if (!preview) {
      this.output_perforation_front = perforator_front.stop();
    }

    loadingScreen.hide();

    context_back.restore();
    context_front.restore();
  }
}


/* ------------------
    Project Settings
   ------------------ */

class ProjectSettings extends SettingsGroup {
  name = new Entry(this, "Name", DEFAULT_PROJECT_NAME);
  _load = new FileUpload(this, "Load Project", [PROJECT_FILE_EXTENSION], (function(_this) { return function(files) { _this.project.load_file(files[0]); }; })(this));
  _save = new Button(this, "Save Project", (function(_this) { return function(_) { _this.project.save_to_file(); } })(this));

  static SETTINGS_MAP = ["name"];
}

class MachineSettings extends SettingsGroup {
  init_children() {
    this.type = new Select(this, "Type", {laser: "Laser", cutter: "Cutter"});
    this.speed = new RotationalSpeed(this, "Motor Speed", "2000");
    this.power = new EntryWithUnit(this, "Power", "100", {percent: "%"});
    this.feedrate_travel = new Speed(this, "Feedrate Travel", "500");
    this.feedrate_cut = new Speed(this, "Feedrate Cut", "200");
  }

  static SETTINGS_MAP = ["type", "speed", "power"];

  update_constraints() {
    if (this.type.value == "laser") {
      this.speed.hide();
      this.power.show();
    }
    if (this.type.value == "cutter") {
      this.speed.show();
      this.power.hide();
    }
  }
}

class PaperSettings extends SettingsGroup {
  init_children() {
    this.size = new Size(this, "Size", "210", "148");
    this.width_bridge = new Length(this, "Bridge Width", "1.1");
    this.width_perf_material = new Length(this, "Perforation Material", "1.1");
    this.width_perf_cut = new Length(this, "Perforation Cut", "0.6");
    this._add_divider();
    this.image = new ImageEl(this, "Image", ["100", "100"], "percent", "0");
    this.image_pos = new AnchoredPosition(this, "Image Position", ["50", "50"], "percent", ["50", "50"]);
    this.update_constraints();
  }

  update_constraints() {
    if (this.image.valid()) {
      this.image_pos.show();
    } else {
      this.image_pos.hide();
    }
    this._size_mm = null;
    this._img_size_mm = null;
    this._img_rot_deg = null;
    this._img_pos_mm = null;
  }
  
  _size_mm;
  calc_size() {
    if (!this._size_mm) {
      this._size_mm = this.size.to_mm();
    }
    return this._size_mm;
  }

  _img_size_mm;
  async calc_image_size() {
    if (!this._img_size_mm) {
      this._img_size_mm = await this.image.to_mm(...this.calc_size());
    }
    return this._img_size_mm;
  }

  _img_rot_deg
  calc_image_rot() {
    if (!this._img_rot_deg) {
      this._img_rot_deg = this.image.to_deg();
    }
    return this._img_rot_deg;
  }

  _img_pos_mm;
  async calc_image_pos() {
    if (!this._img_pos_mm) {
      this._img_pos_mm = this.image_pos.to_mm(...this.calc_size(), ...await this.calc_image_size());
    }
    return this._img_pos_mm;
  }

  async draw(ctx) {
    if (!this.image.valid()) {
      return;
    }

    const [img_width, img_height] = await this.calc_image_size();
    const [img_x, img_y] = await this.calc_image_pos();
    const img_rot = ANGLE_UNITS.rad.from_deg(this.calc_image_rot());
    const img_data = this.image.data;
    const img_el = new Image();
    await new Promise(function(resolve, reject) {
      img_el.onload = function() {
        resolve(img_el);
      };
      img_el.src = img_data;
    });

    ctx.save();
    ctx.translate(img_x, img_y);
    ctx.rotate(img_rot);
    ctx.drawImage(img_el, -img_width/2, -img_height/2, img_width, img_height);
    ctx.restore();
  }

  static SETTINGS_MAP = ["size", "width_bridge", "width_perf_material", "width_perf_cut", "image", "image_pos"];
}

class _ObjectItemVisibility extends _DoubleCheckbox {
  static SETTINGS_MAP = ["preview", "final"];
}

class ObjectItem extends SettingsListItem {
  _name_element;
  _label_element;
  static SETTINGS_MAP = ["name", "visibility", "shape", "size", "radius", "position", "rotation", "label", "label_font", "label_color", "label_pos", "image", "image_pos"];
  constructor(list) {
    super(list);
    this._name_element = this._add_text("");
    this._label_element = this._add_text("");

    const _this = this;
    this.html_element.addEventListener("click", function(e) { _this.project._object.toggle_object(_this); _this.html_element.classList.toggle("selected") });
    this.init_settings();
    this.update_constraints();
  }

  init_settings() {
    this.settings = {
      name: "Window",
      visibility: {preview: true, final: true},
      shape: "rect",
      size: {width: "14", height: "13", unit: "mm"},
      radius: {value: "3", unit: "mm"},
      position: {position_x: "50", position_y: "50", position_unit: "percent", anchor_inner_x: "50", anchor_inner_y: "50", anchor_outer_x: "left", anchor_outer_y: "top"},
      rotation: {value: "0", unit: "deg"},
      label: "" + (this.list.objects.length+1),
      label_font: {value: "60", unit: "percent"},
      label_color: "#000000",
      label_pos: {position_x: "50", position_y: "55", position_unit: "percent", anchor_inner_x: "50", anchor_inner_y: "50", anchor_outer_x: "left", anchor_outer_y: "top"},
      image: {data: null, width: "100", height: "100", size_unit: "percent", scale_mode: "cover", rotation: "0", rotation_unit: "deg"},
      image_pos: {position_x: "50", position_y: "50", position_unit: "percent", anchor_inner_x: "50", anchor_inner_y: "50", anchor_outer_x: "left", anchor_outer_y: "top"},
    };
  }

  update_constraints() {
    this._name_element.innerText = this.settings.name + ":";
    this._label_element.innerText = this.settings.label;

    this._size_mm = null;
    this._pos_mm = null;
    this._rot_deg = null;
    this._radius_mm = null;
    this._img_size_mm = null;
    this._img_rot_deg = null;
    this._img_pos_mm = null;
  }

  _dep_pps;
  _check_dependencies() {
    const _dep_pps = this._dep_pps;
    const paper_size_changed = (_dep_pps != (this._dep_pps = this.project.paper.calc_size()));
    if (paper_size_changed) {
      this._size_mm = null;
      this._pos_mm = null;
      this._radius_mm = null;
      this._img_size_mm = null;
      this._img_pos_mm = null;
    }
  }

  _size_mm;
  calc_size() {
    this._check_dependencies();
    if (!this._size_mm) {
      this._size_mm = SizeRel.to_mm(this.settings.size.width, this.settings.size.height, this.settings.size.unit, this._dep_pps);
    }
    return this._size_mm;
  }

  _pos_mm;
  calc_pos() {
    this._check_dependencies();
    if (!this._pos_mm) {
      this._pos_mm = AnchoredPosition.to_mm(this.settings.position.position_x, this.settings.position.position_y, this.settings.position.position_unit, this.settings.position.anchor_inner_x, this.settings.position.anchor_inner_y, this.settings.position.anchor_outer_x, this.settings.position.anchor_outer_y, ...this._dep_pps, ...this.calc_size());
    }
    return this._pos_mm;
  } 

  _rot_deg;
  calc_rot() {
    if (!this._rot_deg) {
      this._rot_deg = Rotation.to_deg(this.settings.rotation.value, this.settings.rotation.unit);
    }
    return this._rot_deg;
  }

  _radius_mm;
  calc_radius() {
    this._check_dependencies();
    if (!this._radius_mm) {
      this._radius_mm = LengthRel.to_mm(this.settings.radius.value, this.settings.radius.unit, Math.min(...this.calc_size()));
    }
    return this._radius_mm;
  }

  _img_size_mm;
  async calc_image_size() {
    this._check_dependencies();
    if (!this._img_size_mm) {
      this._img_size_mm = ImageEl.to_mm(await ImageEl.get_aspect_ratio(this.settings.image.data), this.settings.image.width, this.settings.image.height, this.settings.image.size_unit, this.settings.image.scale_mode, ...this.calc_size());
    }
    return this._img_size_mm;
  }

  _img_rot_deg
  calc_image_rot() {
    if (!this._img_rot_deg) {
      this._img_rot_deg = ImageEl.to_deg(this.settings.image.rotation, this.settings.image.rotation_unit);
    }
    return this._img_rot_deg;
  }

  _img_pos_mm;
  async calc_image_pos() {
    this._check_dependencies();
    if (!this._img_pos_mm) {
      const [win_w, win_h] = this.calc_size();
      const [win_x, win_y] = this.calc_pos();
      const [img_x, img_y] = AnchoredPosition.to_mm(this.settings.image_pos.position_x, this.settings.image_pos.position_y, this.settings.image_pos.position_unit, this.settings.image_pos.anchor_inner_x, this.settings.image_pos.anchor_inner_y, this.settings.image_pos.anchor_outer_x, this.settings.image_pos.anchor_outer_y, ...this.calc_size(), ...await this.calc_image_size());
      this._img_pos_mm = [win_x - win_w/2 + img_x, win_y - win_h/2 + img_y];
    }
    return this._img_pos_mm;
  }

  async draw_back(ctx) {
    if (!ImageEl.valid(this.settings.image.data)) {
      return;
    }

    const [img_width, img_height] = await this.calc_image_size();
    const [img_x, img_y] = await this.calc_image_pos();
    const img_rot = ANGLE_UNITS.rad.from_deg(this.calc_image_rot());
    const img_data = this.settings.image.data;
    const img_el = new Image();
    await new Promise(function(resolve, reject) {
      img_el.onload = function() {
        resolve(img_el);
      };
      img_el.src = img_data;
    });

    ctx.save();
    ctx.translate(img_x, img_y);
    ctx.rotate(img_rot);
    ctx.drawImage(img_el, -img_width/2, -img_height/2, img_width, img_height);
    ctx.restore();
  }

  draw_front(ctx) {
    const text = this.settings.label;
    const csize = this.calc_size();
    const cpos = this.calc_pos();
    const fontSize = LengthRel.to_mm(this.settings.label_font.value, this.settings.label_font.unit, csize[1]);
    
    ctx.save();
    ctx.font = "bold " + fontSize + "px sans-serif";
    ctx.fillStyle = this.settings.label_color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const tsize = ctx.measureText(text);
    const [pos_x, pos_y] = AnchoredPosition.to_mm(this.settings.label_pos.position_x, this.settings.label_pos.position_y, this.settings.label_pos.position_unit, this.settings.label_pos.anchor_inner_x, this.settings.label_pos.anchor_inner_y, this.settings.label_pos.anchor_outer_x, this.settings.label_pos.anchor_outer_y, ...this.calc_size(), tsize.width, fontSize);
    ctx.fillText(text, pos_x+cpos[0]-csize[0]/2, pos_y+cpos[1]-csize[1]/2);
    ctx.restore();
  }

  perforate_front(perforator) {
    switch (this.settings.shape) {
      case "rect":
        perforator.rounded_square(...this.calc_pos(), ...this.calc_size(), this.calc_radius(), this.calc_rot());
        return;
      case "window":
        perforator.rounded_window(...this.calc_pos(), ...this.calc_size(), this.calc_radius(), this.calc_rot());
        return;
    }
    console.warn(this.constructor.name + ": cannot perforate_front with shape " + this.settings.shape);
  }
}

class ObjectList extends SettingsList {
  static ITEM_CONSTRUCTOR = ObjectItem;
}

class ObjectSettings extends DeferredSettingsGroup {
  static SETTINGS_MAP = ["name", "visibility", "shape", "size", "radius", "position", "rotation", "label", "label_font", "label_color", "label_pos", "image", "image_pos"];
  init_children() {
    this.name = new Entry(this, "Name", "");
    this.visibility = new _ObjectItemVisibility(this, "Visible in Preview", true, "Export", true);
    this._dividers = [];
    this._add_divider();
    this.shape = new Select(this, "Shape", {rect: "Rectangle", window: "Window"});
    this.size = new SizeRel(this, "Size", "", "");
    this.radius = new LengthRel(this, "Radius", "");
    this._add_divider();
    this.position = new AnchoredPosition(this, "Position", ["", ""], "", ["", ""]); // AnchoredPosition (-> always relative)
    this.rotation = new Rotation(this, "Rotation", "0");
    this._add_divider();
    this.label = new Entry(this, "Label", "");
    this.label_font = new LengthRel(this, "Font Size", "");
    this.label_color = new Color(this, "Color", "");
    this.label_pos = new AnchoredPosition(this, "Label Position", ["", ""], "", ["", ""]);
    this._add_divider();
    this.image = new ImageEl(this, "Image", ["", ""], "", "");
    this.image_pos = new AnchoredPosition(this, "Image Position", ["", ""], "", ["", ""]);

    const _this = this;
    this._delete = new WarningButton(this, "Delete", function() { _this.project.objects.delete_objects(_this.objects); _this.objects = []; _this.update_shown_settings(); });
  }

  _add_divider() {
    const div = super._add_divider();
    this._dividers.push(div);
  }

  update_shown_settings() {
    super.update_shown_settings();
    if (!this.objects || (this.objects.length < 1)) {
      this._delete.hide();
      this._dividers.forEach(function(e) { e.classList.add("hidden"); });
    } else {
      this._delete.show();
      this._dividers.forEach(function(e) { e.classList.remove("hidden"); });
    }
  }

  update_constraints() {
    super.update_constraints();
    
    if (this.image.valid() && this.image.visible) {
      this.image_pos.show();
    } else {
      this.image_pos.hide();
    }

    if (this.label.value && this.label.visible) {
      this.label_font.show();
      this.label_color.show();
      this.label_pos.show();
    } else {
      this.label_font.hide();
      this.label_color.hide();
      this.label_pos.hide();
    }
  }
}

class DisplaySettings extends SettingsGroup {
  init_children() {
    this.line_width = new EntryWithUnit(this, "Line Width", "1.5", {px: "px"});
    this.line_color = new Color(this, "Line Color", "#000000");
    this.hide_cutouts = new Checkbox(this, "Hide Cutouts", false);
  }

  static SETTINGS_MAP = ["line_width", "line_color", "hide_cutouts"];
}

class OutputSettings extends SettingsGroup {
  init_children() {
    this.quality = new EntryWithUnit(this, "Print Quality", "72", {dpi: "dpi"});
    this._export = new PrimaryButton(this, "Export Project", (function(_this) { return function(_) { _this.project.export(); } })(this));
  }

  static SETTINGS_MAP = ["quality"];
}