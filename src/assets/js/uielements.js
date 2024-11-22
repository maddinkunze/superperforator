loadingScreen = {
  _waiting: 1,
  _element: null,
  element: function() {
    if (!this._element) { this._element = document.getElementById("loading-container"); }
    return this._element;
  },
  show: function() {
    if (this._waiting++) { return; }
    this.element().classList.remove("hidden");
  },
  hide: function() {
    if (--this._waiting) { return; }
    this.element().classList.add("hidden");
  }
};

class SettingsObject {
  project;
  html_element;
  visible = true;
  constructor(project) {
    this.project = project;
  }
  static SETTINGS_MAP;
  update_from_json(settings_json) {
    const _this = this;
    this.constructor.SETTINGS_MAP.forEach(function(name) { _this.update_property_from_json(name, settings_json[name]); });
    this.update_constraints();
  }
  are_all_the_same_settings(settings_json, key) {
    const setting = (key === undefined) ? settings_json[0] : settings_json[0][key];
    return settings_json.every(function(e) { return ((key === undefined) ? e : e[key]) == setting; });
  }
  update_property_from_json(prop, setting_json) {
    this[prop].update_from_json(setting_json);
  }
  update_property_from_multiple_json(prop, settings_json) {
    this[prop].update_from_multiple_json(settings_json);
  }
  update_from_multiple_json(settings_json) {
    if (!settings_json || (settings_json.length < 1)) {
      return;
    }
    const settings_map = this.constructor.SETTINGS_MAP;
    if (settings_map) {
      for (var i=0; i<settings_map.length; i++) {
        const _setting = settings_map[i];
        if (this.are_all_the_same_settings(settings_json, _setting)) {
          this.update_property_from_json(_setting, settings_json[0][_setting]);
        } else {
          this.update_property_from_multiple_json(_setting, settings_json.map(function(e) { return e[_setting]; }));
        }
      }
      this.update_constraints();
      return;
    } else if (!this.are_all_the_same_settings(settings_json)) {
      this.clear();
      return;
    }
    return this.update_from_json(settings_json[0]);
  }
  to_json() {
    const settings_json = {};
    const _this = this;
    this.constructor.SETTINGS_MAP.forEach(function(name) { settings_json[name] = _this[name].to_json(); });
    return settings_json;
  }
  hide() {
    this.html_element.classList.add("hidden");
    this.visible = false;
  }
  show() {
    this.html_element.classList.remove("hidden");
    this.visible = true;
  }
  on_child_updated() {
    this.update_constraints();
  }
  update_constraints() {}

  static #uid = 0;
  static generate_uid(prefix) {
    return prefix + this.#uid++;
  }
  static to_html_id(text) {
    return text.toLowerCase().replace(" ", "-");
  }
}

class BaseProject extends SettingsObject {
  static VERSION;
  static SETTINGS_COMPATIBILITY = {};

  html_element = document.getElementById("settings-container");

  load_file(file) {
    loadingScreen.show();
    file.text()
      .then((function(_this) { return function(text) { _this.update_from_string(text); }; })(this))
      .finally(function() { loadingScreen.hide(); });
  }

  update_from_string(data_json) {
    this.update_from_json(JSON.parse(data_json));
  }

  update_from_json(settings_json) {
    settings_json = this.#make_legacy_settings_compatible(settings_json);
    this.update_from_latest_json(settings_json);
  }

  to_json() {
    const settings_json = {version: this.constructor.VERSION};
    this.add_to_json(settings_json);
    return settings_json;
  }

  add_to_json(settings_json) {
    const super_json = super.to_json();
    const keys = Object.keys(super_json);
    for (var i=0; i<keys.length; i++) {
      settings_json[keys[i]] = super_json[keys[i]];
    }
  }
  update_from_latest_json(settings_json) {
    super.update_from_json(settings_json);
  }
  get_filename() {}

  save_to_file() {
    const settings_json = this.to_json();
    const filename = this.get_filename();
    saveAs(new Blob([JSON.stringify(settings_json)]), filename, {});
  }

  #make_legacy_settings_compatible(settings_old) {
    var settings = settings_old;
    while (true) {
      if (settings.version == this.constructor.VERSION) { return settings; } // already same version (or finally same version) -> return (final/updated) settings
      
      const cmp = this.#compare_versions(settings.version, this.constructor.VERSION);
      if (cmp == 0) { return settings; } // same as (settings.version == Project.SETTINGS_DEFAULT.version)
      if (cmp > 0) { // the loaded project is newer than the program -> dont attempt to load
        console.warn("Version of loaded project is newer than this program version, please update your program.");
        return null;
      }
      if (cmp == null) { // the loaded project version or the program version could not be compared with each other for some reason -> try to update settings anyway (will probably fail)
        console.warn("Could not compare version of the program with the version of the loaded project. Trying to restore/upgrade settings anyways.");
      }

      const upgrade = this.constructor.SETTINGS_COMPATIBILITY[settings.version];
      if (upgrade == null) { // no upgrade function found despite differing versions -> dont attempt to load
        console.warn("Could not upgrade project version to match program version; no matching upgrade function defined.");
        return null;
      }
      settings = upgrade(settings); // upgrade function found -> upgrade and try again
    }
  }

  #compare_versions(version1, version2) { // -1 if version1 < version2; 0 if version1 = version2; 1 if version1 > version2; null if versions cannot be compared
    const v1 = version1.split(".").map(function(s, _1, _2) { return +s });
    const v2 = version2.split(".").map(function(s, _1, _2) { return +s });
    if (v1.length != v2.length) { return null; }
    for (var i=0; i<v1.length; i++) {
      if (v1[i] < v2[i]) {
        return -1;
      }
      if (v1[i] > v2[i]) {
        return 1;
      }
    }
    return 0;
  }

  update_according_to_settings() {
  
    this.update_to_html();
  }
}

class SettingsGroup extends SettingsObject {
  _expanded_element;
  constructor(project, title) {
    super(project);
    const element_outer = document.createElement("div");
    element_outer.classList.add("settings-group-outer");

    const expanded_id = SettingsObject.generate_uid("checkbox-settings-" + SettingsObject.to_html_id(title) + "-expanded-")
    const element_title = document.createElement("label");
    element_title.innerText = title;
    element_title.htmlFor = expanded_id;
    const element_expanded = document.createElement("input");
    element_expanded.type = "checkbox";
    element_expanded.id = expanded_id;

    const element_inner = this._create_inner_element();
    element_inner.classList.add("settings-group-inner");

    this._expanded_element = element_outer.appendChild(element_expanded);
    element_outer.appendChild(element_title);
    this.html_element = element_outer.appendChild(element_inner);
    project.html_element.appendChild(element_outer);

    this.init_children();
    this.update_constraints();
  }
  _create_inner_element() { return document.createElement("div"); }
  _add_divider() {
    const div_element = document.createElement("div");
    div_element.classList.add("settings-divider");
    return this.html_element.appendChild(div_element);
  }
  init_children() {}
  on_child_updated() {
    super.on_child_updated();
    this.project.on_child_updated();
  }
  open() {
    this._expanded_element.checked = true;
  }
  close() {
    this._expanded_element.checked = false;
  }
  toggle() {
    this._expanded_element.checked = !this._expanded_element.checked;
  }
  show() {
    this.open();
  }
  hide() {
    this.close();
  }
}

class DeferredSettingsGroup extends SettingsGroup {
  objects = [];
  _last_settings;
  constructor(project, title) {
    super(project, title);
    this.update_shown_settings();
  }
  update_shown_settings() {
    const hide_all = !this.objects || (this.objects.length == 0);
    const settings_map = this.constructor.SETTINGS_MAP;
    for (var i=0; i<settings_map.length; i++) {
      const _setting = settings_map[i];
      if (hide_all || !this.objects.every(function(e) { return e.constructor.SETTINGS_MAP.includes(_setting); })) {
        this[_setting].hide();
      } else {
        this[_setting].show();
        this[_setting].update_from_multiple_json(this.objects.map(function(e) { return e.settings[_setting]; }));
      }
    }
    if (hide_all) {
      this.html_element.classList.add("empty");
    } else {
      this.html_element.classList.remove("empty");
      this.open();
    }
    this.update_constraints();
    this._last_settings = this.to_json();
  }
  apply_changes_to_object() {
    const _current_settings = this.to_json();
    const diff = calc_json_diff(this._last_settings, _current_settings);
    this._last_settings = _current_settings;
    for (var i=0; i<this.objects.length; i++) {
      apply_json_diff(this.objects[i].settings, diff);
      this.objects[i].update_constraints();
    }
  }
  toggle_object(obj) {
    if (this.objects.includes(obj)) {
      this.objects = this.objects.filter(function(e) { return e != obj; });
    } else {
      this.objects.push(obj);
    }
    this.update_shown_settings();
  }
  update_constraints() {
    super.update_constraints();
    if (this.objects) { this.apply_changes_to_object(); }
  }
}

class SettingsList extends SettingsGroup {
  objects = [];
  group_deferred;
  static ITEM_CONSTRUCTOR;
  _create_inner_element() { return document.createElement("ul"); }

  to_json() {
    return this.objects.map(function(obj) { return obj.to_json(); });
  }
  update_from_json(settings_json) {
    const _this = this;
    this.objects = settings_json.map(function(e) { const item = new _this.constructor.ITEM_CONSTRUCTOR(_this); item.update_from_json(e); return item; });
    this.update_constraints();
  }
  create_object() {
    this.objects.push(new this.constructor.ITEM_CONSTRUCTOR(this));
    this.open();
    this.on_child_updated();
  }
  delete_objects(objects) {
    objects.forEach(function(e) { e.remove_from_list(); })
    this.objects = this.objects.filter(function(e) { return !objects.includes(e); });
    this.on_child_updated();
  }
  update_constraints() {
    super.update_constraints();
    if (this.objects && this.objects.length > 0) {
      this.html_element.classList.remove("empty");
    } else {
      this.html_element.classList.add("empty");
    }
  }
}

class _SettingsGroupItem extends SettingsObject {
  constructor(parent) {
    super(parent.project);
    this._init_parent_element(parent);
    this.html_element = this._add_line();
  }

  on_child_updated() {
    super.on_child_updated();
    this._parent_element().on_child_updated();
  }

  _init_parent_element(parent) {}
  _parent_element() {}

  _add_line() {
    const html_element = document.createElement("div");
    html_element.classList.add("settings-line");
    return this._parent_element().html_element.appendChild(html_element);
  }

  _add_title(title) {
    const title_element = document.createElement("label");
    title_element.innerText = title + ":";
    this.html_element.appendChild(title_element);
  }

  _add_entry(value) {
    const entry_element = document.createElement("input");
    const _this = this;
    entry_element.addEventListener("change", function(_) { _this.on_child_updated(); })
    entry_element.type = "text";
    entry_element.value = value;
    return this.html_element.appendChild(entry_element);
  }

  _add_select(options) {
    const select_element = document.createElement("select");
    const _this = this;
    select_element.addEventListener("change", function(_) { _this.on_child_updated(); });
    const keys = Object.keys(options);
    for (var i=0; i<keys.length; i++) {
      const option_element = document.createElement("option");
      option_element.value = keys[i];
      option_element.innerText = options[keys[i]];
      select_element.appendChild(option_element);
    }
    select_element.value = keys[0];
    return this.html_element.appendChild(select_element);
  }

  _add_text(text) {
    const text_element = document.createElement("span");
    text_element.innerText = text;
    return this.html_element.appendChild(text_element);
  }

  #to_unit_text(unit) {
    if (unit instanceof Selectable) {
      return unit.select_display_name();
    }
    return unit;
  }
  _add_unit_select(units) {
    const keys = Object.keys(units);
    if (keys.length == 1) {
      const text_element = this._add_text(this.#to_unit_text(units[keys[0]]));
      text_element.classList.add("unit");
      text_element.value = keys[0];
      return text_element;
    }

    const unit_options = {};
    for (var i=0; i<keys.length; i++) {
      unit_options[keys[i]] = this.#to_unit_text(units[keys[i]]);
    }
    const select_element = this._add_select(unit_options);
    select_element.classList.add("unit");
    return select_element;
  }

  _add_color_select(value) {
    const color_element = document.createElement("input");
    color_element.type = "color";
    color_element.value = value;
    const _this = this;
    color_element.addEventListener("change", function(_) { _this.on_child_updated(); });
    return this.html_element.appendChild(color_element);
  }

  _add_file_input(filetypes) {
    const file_element = document.createElement("input");
    file_element.type = "file";
    file_element.accept = filetypes.join(",");
    return this.html_element.appendChild(file_element);
  }

  _add_grow() {
    const grow_element = document.createElement("div");
    grow_element.style.flexGrow = "1";
    return this.html_element.appendChild(grow_element);
  }

  _add_checkbox(checked) {
    const checkbox_element = document.createElement("input");
    checkbox_element.type = "checkbox";
    checkbox_element.checked = checked;
    const _this = this;
    checkbox_element.addEventListener("change", function(e) { _this.on_child_updated(); });
    return this.html_element.appendChild(checkbox_element);
  }
}

class SettingsListItem extends _SettingsGroupItem {
  list = this.list;
  settings;
  constructor(list) {
    super(list);
  }
  _init_parent_element(list) {
    this.list = list;
  }
  _parent_element() {
    return this.list;
  }
  _add_line() {
    const html_element = document.createElement("li");
    html_element.classList.add("settings-line");
    return this._parent_element().html_element.appendChild(html_element);
  }
  to_json() {
    return this.settings;
  }
  update_from_json(settings_json) {
    this.settings = settings_json;
    this.update_constraints();
  }
  remove_from_list() {
    this.html_element.remove();
  }
}

class SettingsLine extends _SettingsGroupItem {
  group = this.group;
  constructor(group) {
    super(group);
  }
  _init_parent_element(group) {
    this.group = group;
  }
  _parent_element() {
    return this.group;
  }
  to_json() {
    const settings_map = this.constructor.SETTINGS_MAP;
    if (!settings_map) { return; }
    const result = {}
    for (var i=0; i<settings_map.length; i++) {
      result[settings_map[i]] = this[settings_map[i]];
    }
    return result;
  }
}

class SettingsLineContent extends SettingsLine {
  constructor(group, title) {
    super(group);
    this._add_title(title);
  }
}

class SettingsMultilineContent extends SettingsLineContent {
  _html_elements = this._html_elements;
  hide() {
    this._html_elements.forEach(function(e) { e.classList.add("hidden"); });
    this.visible = false;
  }
  show() {
    this._html_elements.forEach(function(e) { e.classList.remove("hidden"); });
    this.visible = true;
  }
  _add_line() {
    const el = super._add_line();
    if (!this._html_elements) { this._html_elements = []; }
    this._html_elements.push(el);
    return el;
  }
}

class Button extends SettingsLine {
  _button_element;
  constructor(group, title, callback) {
    super(group);
    this.html_element.classList.add("h16");
    const button_element = document.createElement("button");
    button_element.innerText = title;
    button_element.classList.add("settings-button");
    button_element.addEventListener("click", callback);
    this._button_element = this.html_element.appendChild(button_element);
  }
}

class PrimaryButton extends Button {
  constructor(group, title, callback) {
    super(group, title, callback);
    this._button_element.classList.add("primary");
  }
}

class WarningButton extends Button {
  constructor(group, title, callback) {
    super(group, title, callback);
    this._button_element.classList.add("warning");
  }
}

class _Select extends SettingsLineContent {
  static _value_name;
  static _select_element;
  constructor(group, title, options) {
    super(group, title);
    this._select_element = this._add_select(options);
    this.update_constraints();
  }
  update_from_json(setting) {
    this._select_element.value = setting;
    this.update_constraints();
  }
  to_json() {
    return this[this.constructor._value_name];
  }
  update_constraints() {
    this[this.constructor._value_name] = this._select_element.value;
  }
  clear() {
    this._select_element.value = null;
  }
}

class _Entry extends SettingsLineContent {
  static _value_name;
  _entry_element;
  constructor(group, title, value) {
    super(group, title);
    this._entry_element = this._add_entry(value);
    this.update_constraints();
  }
  update_from_json(setting) {
    this._entry_element.value = setting;
    this.update_constraints();
  }
  to_json() {
    return this[this.constructor._value_name];
  }
  clear() {
    this._entry_element.value = "";
  }
  update_constraints() {
    this[this.constructor._value_name] = this._entry_element.value;
  }
}

class _EntryWithUnit extends SettingsLineContent {
  _entry_element;
  _unit_element;
  static _value_name() { return this.SETTINGS_MAP[0]; }
  static _unit_name() { return this.SETTINGS_MAP[1]; }
  constructor(group, title, value, units) {
    super(group, title, value);
    this._entry_element = this._add_entry(value);
    this._unit_element = this._add_unit_select(units);
    this.update_constraints();
  }
  update_from_json(setting) {
    this._entry_element.value = setting[this.constructor._value_name()];
    this._unit_element.value = setting[this.constructor._unit_name()];
    this.update_constraints();
  }
  update_property_from_json(prop, settings_json) {
    switch (prop) {
      case this.constructor._value_name():
        this._entry_element.value = settings_json;
        return;
      case this.constructor._unit_name():
        this._unit_element.value = settings_json;
        return;
    }
    console.log(this.constructor.name + ": tried to update_property_from_json with unsupprted " + prop);
  }
  update_property_from_multiple_json(prop, settings_json) {
    switch (prop) {
      case this.constructor._value_name():
        this._clear_value_entry();
        return;
      case this.constructor._unit_name():
        this._clear_unit_select();
        return;
    }
    console.log(this.constructor.name + ": tried to update_property_from_multiple_json with unsupprted " + prop);
  }
  update_constraints() {
    this[this.constructor._value_name()] = this._entry_element.value;
    this[this.constructor._unit_name()] = this._unit_element.value;
  }
  _clear_value_entry() {
    this._entry_element.value = "";
  }
  _clear_unit_select() {
    this._unit_element.value = null;
  }
  clear() {
    this._clear_value_entry();
    this._clear_unit_select();
  }
}

class _DoubleEntryWithUnit extends SettingsLineContent {
  _value_1_element;
  _value_2_element;
  _unit_element;
  static _value_1_name() { return this.SETTINGS_MAP[0]; }
  static _value_2_name() { return this.SETTINGS_MAP[1]; }
  static _unit_name() { return this.SETTINGS_MAP[2]; }
  constructor(group, title, value1, connector, value2, units) {
    super(group, title);
    this._value_1_element = this._add_entry(value1);
    this._add_text(connector).classList.add("connector");
    this._value_2_element = this._add_entry(value2);
    this._unit_element = this._add_unit_select(units);
    this.update_constraints();
  }
  update_from_json(setting) {
    this._value_1_element.value = setting[this.constructor._value_1_name()];
    this._value_2_element.value = setting[this.constructor._value_2_name()];
    this._unit_element.value = setting[this.constructor._unit_name()];
    this.update_constraints();
  }
  update_property_from_json(prop, setting_json) {
    switch (prop) {
      case this.constructor._value_1_name():
        this._value_1_element.value = setting_json;
        return;
      case this.constructor._value_2_name():
        this._value_2_element.value = setting_json;
        return;
      case this.constructor._unit_name():
        this._unit_element.value = setting_json;
        return;
    }
  }
  update_property_from_multiple_json(prop, setting_json) {
    switch (prop) {
      case this.constructor._value_1_name():
        this._clear_value_1_entry();
        return;
      case this.constructor._value_2_name():
        this._clear_value_2_entry();
        return;
      case this.constructor._unit_name():
        this._clear_unit_select();
        return;
    }
  }
  update_constraints() {
    this[this.constructor._value_1_name()] = this._value_1_element.value;
    this[this.constructor._value_2_name()] = this._value_2_element.value;
    this[this.constructor._unit_name()] = this._unit_element.value;
  }
  _clear_value_1_entry() {
    this._value_1_element.value = "";
  }
  _clear_value_2_entry() {
    this._value_2_element.value = "";
  }
  _clear_unit_select() {
    this._unit_element.value = null;
  }
  clear() {
    this._clear_value_1_entry();
    this._clear_value_2_entry();
    this._clear_unit_select();
  }
}

class Checkbox extends SettingsLineContent {
  checked;
  _checkbox_element;
  constructor(group, title, checked) {
    super(group, title);
    this._add_grow();
    this._checkbox_element = this._add_checkbox(checked);
    this.update_constraints();
  }
  update_from_json(settings) {
    this._checkbox_element.checked = settings;
  }
  to_json() {
    return this.checked;
  }
  update_constraints() {
    this.checked = this._checkbox_element.checked;
  }
  clear() {
    this._checkbox_element.checked = false;
    this.update_constraints();
  }
}

class _DoubleCheckbox extends SettingsLineContent {
  static _value_1_name() { return this.SETTINGS_MAP[0]; }
  static _value_2_name() { return this.SETTINGS_MAP[1]; }
  _checkbox_1_element;
  _checkbox_2_element;
  constructor(group, title1, checked1, title2, checked2) {
    super(group, title1);
    this._add_grow();
    this._checkbox_1_element = this._add_checkbox(checked1);
    this._add_text("|").classList.add("connector");
    this._add_title(title2);
    this._add_grow();
    this._checkbox_2_element = this._add_checkbox(checked2);
    this.update_constraints();
  }
  update_property_from_json(prop, setting) {
    switch (prop) {
      case this.constructor._value_1_name():
        this._checkbox_1_element.value = setting;
        return;
      case this.constructor._value_2_name():
        this._checkbox_2_element.value = setting;
        return;
    }
  }
  update_property_from_multiple_json(prop, settings) {
    switch (prop) {
      case this.constructor._value_1_name():
        this._clear_checkbox_1();
        return;
      case this.constructor._value_2_name():
        this._clear_checkbox_2();
        return;
    }
  }
  _clear_checkbox_1() {
    this._checkbox_1_element.checked = false;
  }
  _clear_checkbox_2() {
    this._checkbox_2_element.checked = false;
  }
  clear() {
    this._clear_checkbox_1();
    this._clear_checkbox_2();
    this.update_constraints();
  }
  update_constraints() {
    this[this.constructor._value_1_name()] = this._checkbox_1_element.checked;
    this[this.constructor._value_2_name()] = this._checkbox_2_element.checked;
  }
}

class Select extends _Select {
  value = this.value;
  static _value_name = ["value"];
}

class Entry extends _Entry {
  value = this.value;
  static _value_name = "value";
}

class EntryWithUnit extends _EntryWithUnit {
  value = this.value;
  unit = this.unit;
  static SETTINGS_MAP = ["value", "unit"];
}

class Length extends EntryWithUnit {
  constructor(group, title, value) {
    super(group, title, value, LENGTH_UNITS_ABS);
  }
  to_mm() {
    return this.constructor.to_mm(this.value, this.unit);
  }
  static to_mm(value, unit) {
    return LENGTH_UNITS_ABS[unit].to_mm(parseFloat(value));
  }
}

class LengthRel extends EntryWithUnit {
  constructor(group, title, value) {
    super(group, title, value, LENGTH_UNITS_REL);
  }
  to_mm(ref) {
    return this.constructor.to_mm(this.value, this.unit, ref);
  }
  static to_mm(value, unit, ref) {
    return LENGTH_UNITS_REL[unit].to_mm(parseFloat(value), ref);
  }
}

class Speed extends EntryWithUnit {
  constructor(group, title, value) {
    super(group, title, value, VELOCITY_UNITS);
  }

  to_mms() {
    return VELOCITY_UNITS[this.unit].to_mms(this.value);
  }
}

class Rotation extends EntryWithUnit {
  constructor(group, title, value) {
    super(group, title, value, ANGLE_UNITS);
  }
  to_deg() {
    return this.constructor.to_deg(this.value, this.unit);
  }
  static to_deg(value, unit) {
    return ANGLE_UNITS[unit].to_deg(value);
  }
}

class RotationalSpeed extends EntryWithUnit {
  constructor(group, title, value) {
    super(group, title, value, ROTVEL_UNITS);
  }
}


class _Size extends _DoubleEntryWithUnit {
  width = this.width;
  height = this.height;
  unit = this.unit;
  static SETTINGS_MAP = ["width", "height", "unit"]
}

class Size extends _Size {
  constructor(group, title, width, height) {
    super(group, title, width, "x", height, LENGTH_UNITS_ABS);
  }
  to_mm() {
    return this.constructor.to_mm(this.width, this.height, this.unit)
  }
  static to_mm(width, height, unit) {
    return [width, height].map(function(l) { return LENGTH_UNITS_ABS[unit].to_mm(parseFloat(l)); });
  }
}

class SizeRel extends _Size {
  constructor(group, title, width, height) {
    super(group, title, width, "x", height, LENGTH_UNITS_REL);
  }
  to_mm(ref) {
    return this.constructor.to_mm(this.width, this.height, this.unit, ref);
  }
  static to_mm(width, height, unit, ref) {
    return [width, height].map(function(l, i) { return LENGTH_UNITS_ABS[unit].to_mm(parseFloat(l), ref[i]); });
  }
}

class Color extends SettingsLineContent {
  value;
  _color_element;
  constructor(group, title, value) {
    super(group, title);
    this._color_element = this._add_color_select(value);
    this.update_constraints();
  }

  update_from_json(setting) {
    this._color_element.value = setting;
    this.update_constraints();
  }

  to_json() {
    return this.value;
  }

  update_constraints() {
    this.value = this._color_element.value;
  }
}

class FileUpload extends SettingsLine {
  _file_element;
  constructor(group, title, filetypes, callback) {
    super(group);
    this.html_element.classList.add("h16");
    this._file_element = super._add_file_input(filetypes);
    this._file_element.id = SettingsObject.generate_uid("file-settings-" + SettingsObject.to_html_id(title) + "-upload-");
    this._file_element.addEventListener("change", function() { callback(this.files); this.value = ""; });
    const label = document.createElement("label");
    label.classList.add("settings-file");
    label.htmlFor = this._file_element.id;
    label.innerText = title;
    this.html_element.appendChild(label);
  }
}

class AnchoredPosition extends SettingsMultilineContent {
  position_x;
  position_y;
  position_unit;
  anchor_inner_x;
  anchor_inner_y
  anchor_outer_x;
  anchor_outer_y;
  _pos_x_element;
  _pos_y_element;
  _pos_unit_element;
  _anchor_inner_x_element;
  _anchor_inner_y_element;
  _anchor_inner_display_element;
  _anchor_outer_x_element;
  _anchor_outer_y_element;
  _anchor_outer_display_element;
  static SETTINGS_MAP = ["position_x", "position_y", "position_unit", "anchor_inner_x", "anchor_inner_y", "anchor_outer_x", "anchor_outer_y"];
  constructor(group, title, pos, pos_unit, ainn) {
    super(group, title);
    this._pos_x_element = super._add_entry(pos[0]);
    this._add_text("|").classList.add("connector");
    this._pos_y_element = super._add_entry(pos[1]);
    this._pos_unit_element = super._add_unit_select(LENGTH_UNITS_REL);
    this._pos_unit_element.value = pos_unit;
    this._add_anchor();
    this.html_element = super._add_line();
    this.html_element.classList.add("mr30");
    this._add_title("Anchor");
    this._anchor_inner_x_element = super._add_entry(ainn[0]);
    this._add_text("|").classList.add("connector");
    this._anchor_inner_y_element = super._add_entry(ainn[1]);
    this._add_text("%").classList.add("unit");
    this.html_element = super._add_line();
    this.html_element.classList.add("mr30");
    this._add_title("From edge");
    this._anchor_outer_x_element = super._add_select({left: "Left", right: "Right"});
    this._anchor_outer_y_element = super._add_select({top: "Top", bottom: "Bottom"});
    this.update_constraints();
  }
  _add_anchor() {
    const outer = document.createElement("div");
    outer.classList.add("settings-anchor-outer");
    const grid = document.createElement("div");
    grid.classList.add("settings-anchor-grid");
    outer.appendChild(grid);
    const inner = document.createElement("div");
    inner.classList.add("settings-anchor-inner");
    this._anchor_inner_display_element = outer.appendChild(inner);
    this._anchor_outer_display_element = this.group.html_element.appendChild(outer);
    this._html_elements.push(outer);
  }

  update_constraints() {
    this.position_x = this._pos_x_element.value;
    this.position_y = this._pos_y_element.value;
    this.position_unit = this._pos_unit_element.value;
    this.anchor_inner_x = this._anchor_inner_x_element.value;
    this.anchor_inner_y = this._anchor_inner_y_element.value;
    this.anchor_outer_x = this._anchor_outer_x_element.value;
    this.anchor_outer_y = this._anchor_outer_y_element.value;

    this._anchor_inner_display_element.style.left = this.anchor_inner_x + "%";
    this._anchor_inner_display_element.style.top = this.anchor_inner_y + "%";
    this._anchor_outer_display_element.classList.remove("left"); this._anchor_outer_display_element.classList.remove("right");
    this._anchor_outer_display_element.classList.remove("top"); this._anchor_outer_display_element.classList.remove("bottom");
    if (this.anchor_outer_x) { this._anchor_outer_display_element.classList.add(this.anchor_outer_x); }
    if (this.anchor_outer_y) { this._anchor_outer_display_element.classList.add(this.anchor_outer_y); }
  }

  update_property_from_json(prop, setting_json) {
    switch (prop) {
      case "position_x":
        this._pos_x_element.value = setting_json;
        return;
      case "position_y":
        this._pos_y_element.value = setting_json;
        return;
      case "position_unit":
        this._pos_unit_element.value = setting_json;
        return;
      case "anchor_inner_x":
        this._anchor_inner_x_element.value = setting_json;
        return;
      case "anchor_inner_y":
        this._anchor_inner_y_element.value = setting_json;
        return;
      case "anchor_outer_x":
        this._anchor_outer_x_element.value = setting_json;
        return;
      case "anchor_outer_y":
        this._anchor_outer_y_element.value = setting_json;
        return;
    }
  }
  update_property_from_multiple_json(prop, settings_json) {
    switch (prop) {
      case "position_x":
        this._clear_pos_x_element();
        return;
      case "position_y":
        this._clear_pos_y_element();
        return;
      case "position_unit":
        this._clear_pos_unit_element();
        return;
      case "anchor_inner_x":
        this._clear_ainn_x_element();
        return;
      case "anchor_inner_y":
        this._clear_ainn_y_element();
        return;
      case "anchor_outer_x":
        this._clear_aout_x_element();
        return;
      case "anchor_outer_y":
        this._clear_aout_y_element();
        return;
    }
  }

  _clear_pos_x_element() {
    this._pos_x_element.value = "";
  }
  _clear_pos_y_element() {
    this._pos_y_element.value = "";
  }
  _clear_pos_unit_element() {
    this._pos_unit_element.value = null;
  }
  _clear_ainn_x_element() {
    this._anchor_inner_x_element.value = "";
    this._anchor_inner_display_element.style.left = null;
  }
  _clear_ainn_y_element() {
    this._anchor_inner_y_element.value = "";
    this._anchor_inner_display_element.style.top = null;
  }
  _clear_aout_x_element() {
    this._anchor_outer_x_element.value = null;
    this._anchor_outer_display_element.classList.remove("left");
    this._anchor_outer_display_element.classList.remove("right");
  }
  _clear_aout_y_element() {
    this._anchor_outer_y_element.value = null;
    this._anchor_outer_display_element.classList.remove("top");
    this._anchor_outer_display_element.classList.remove("bottom");
  }
  clear() {
    this._clear_pos_x_element();
    this._clear_pos_y_element();
    this._clear_pos_unit_element();
    this._clear_ainn_x_element();
    this._clear_ainn_y_element();
    this._clear_aout_x_element();
    this._clear_aout_y_element();
    this.update_constraints();
  }

  to_mm(width_out, height_out, width_inn, height_inn) {
    return this.constructor.to_mm(this.position_x, this.position_y, this.position_unit, this.anchor_inner_x, this.anchor_inner_y, this.anchor_outer_x, this.anchor_outer_y, width_out, height_out, width_inn, height_inn);
  }

  // calculates final center point
  static to_mm(pos_x, pos_y, pos_unit, ainn_x, ainn_y, aout_x, aout_y, width_out, height_out, width_inn, height_inn) {
    var [x, y] = [pos_x, pos_y].map(function(e, i) { return LENGTH_UNITS_REL[pos_unit].to_mm(parseFloat(e), (i == 0) ? width_out : height_out); });
    if (aout_x == "right") { x = width_out - x; }
    if (aout_y == "bottom") { y = height_out - y; }
    x -= (parseFloat(ainn_x) / 100 - 0.5) * width_inn;
    y -= (parseFloat(ainn_y) / 100 - 0.5) * height_inn;
    return [x, y];
  }
}

class ImageEl extends SettingsMultilineContent {
  data;
  width;
  height;
  size_unit;
  scale_mode;
  rotation;
  rotation_unit;
  _file_element;
  _width_element;
  _height_element;
  _size_unit_element;
  _scale_mode_element;
  _rotation_element;
  _rotation_unit_element;
  static SETTINGS_MAP = ["data", "width", "height", "size_unit", "scale_mode", "rotation", "rotation_unit"];
  constructor(group, title, size, size_unit, rotation) {
    super(group, title);
    this._file_element = this._add_file_input(["image/*"]);
    this._file_element.id = SettingsObject.generate_uid("file-settings-" + SettingsObject.to_html_id(title) + "-upload-");
    const _this = this;
    this._file_element.addEventListener("change", function() { _this._on_image_file_selected(this.files[0]); this.value = ""; });
    const label = document.createElement("label");
    label.classList.add("settings-file-select");
    label.htmlFor = this._file_element.id;
    label.innerText = "Select (new) image";
    const button = document.createElement("button");
    button.classList.add("settings-file-remove");
    button.addEventListener("click", function(e) { _this.data = null; _this.on_child_updated(); })
    this.html_element.appendChild(label);
    this.html_element.appendChild(button);

    this.html_element = this._add_line();
    this._add_title("Size");
    this._width_element = this._add_entry(size[0]);
    this._add_text("x").classList.add("connector");
    this._height_element = this._add_entry(size[1]);
    this._size_unit_element = this._add_unit_select(LENGTH_UNITS_REL);
    this._size_unit_element.value = size_unit;
    
    this.html_element = this._add_line();
    this._add_title("Scale Mode");
    this._scale_mode_element = this._add_select({cover: "Zoom In/Cover", contain: "Zoom Out/Contain", squish: "Squish"});

    this.html_element = this._add_line();
    this._add_title("Rotation");
    this._rotation_element = this._add_entry(rotation);
    this._rotation_unit_element = this._add_unit_select(ANGLE_UNITS);

    this.update_constraints();
  }

  _on_image_file_selected(file) {
    loadingScreen.show();
    const _this = this;
    const reader = new FileReader();
    reader.onload = function() {
      _this.data = reader.result;
      _this.on_child_updated();
      loadingScreen.hide();
    };
    reader.onerror = function() {
      loadingScreen.hide();
    };
    reader.readAsDataURL(file);
  }

  update_constraints() {
    this.width = this._width_element.value;
    this.height = this._height_element.value;
    this.size_unit = this._size_unit_element.value;
    this.scale_mode = this._scale_mode_element.value;
    this.rotation = this._rotation_element.value;
    this.rotation_unit = this._rotation_unit_element.value;

    if (this.data) {
      this._file_element.classList.remove("empty");
      this._html_elements.forEach(function(e, i) { if (i == 0) { return; } e.classList.remove("hidden"); });
    } else {
      this._file_element.classList.add("empty");
      this._html_elements.forEach(function(e, i) { if (i == 0) { return; } e.classList.add("hidden"); });
    }
  }

  valid() {
    return this.constructor.valid(this.data);
  }

  static valid(data) {
    if (data === "#") {
     return false;
    }
    return !!data;
  }

  update_property_from_json(prop, setting) {
    switch (prop) {
      case "data":
        this.data = setting;
        return;
      case "width":
        this._width_element.value = setting;
        return;
      case "height":
        this._height_element.value = setting;
        return;
      case "size_unit":
        this._size_unit_element.value = setting;
        return;
      case "scale_mode":
        this._scale_mode_element.value = setting;
        return;
      case "rotation":
        this._rotation_element.value = setting;
        return;
      case "rotation_unit":
        this._rotation_unit_element.value = setting;
        return;
    }
    console.warn(this.constructor.name + ": tried to update_property_from_json with invalid prop: " + prop);
  }

  update_property_from_multiple_json(prop, settings) {
    switch (prop) {
      case "data":
        if (settings.some(function(e) { return !!e; })) {
          this.data = "#";
        } else {
          this._clear_image();
        }
        return;
      case "width":
        this._clear_width();
        return;
      case "height":
        this._clear_height();
        return;
      case "size_unit":
        this._clear_size_unit();
        return;
      case "scale_mode":
        this._clear_scale_mode();
        return;
      case "rotation":
        this._clear_rotation();
        return;
      case "rotation_unit":
        this._clear_rotunit();
        return;
    }
    console.warn(this.constructor.name + ": tried to update_property_from_json with invalid prop: " + prop);
  }

  _clear_image() {
    this.data = null;
  }
  _clear_width() {
    this._width_element.value = "";
  }
  _clear_height() {
    this._height_element.value = "";
  }
  _clear_size_unit() {
    this._size_unit_element.value = null;
  }
  _clear_scale_mode() {
    this._scale_mode_element.value = null;
  }
  _clear_rotation() {
    this._rotation_element.value = "";
  }
  _clear_rotunit() {
    this._rotation_unit_element.value = null;
  }
  clear() {
    this._clear_image();
    this._clear_width();
    this._clear_height();
    this._clear_size_unit();
    this._clear_scale_mode();
    this._clear_rotation();
    this._clear_rotunit();
    this.update_constraints();
  }

  static async get_aspect_ratio(data) {
    return new Promise(function(resolve, reject) {
      const img = new Image();
      img.onload = function() {
        resolve(img.naturalWidth/img.naturalHeight);
      }
      img.onerror = function() {
        debugger;
        reject();
      }
      img.src = data;
    });
  }

  async to_mm(ref_width, ref_height) {
    const aspect = await this.constructor.get_aspect_ratio(this.data);
    return this.constructor.to_mm(aspect, this.width, this.height, this.size_unit, this.scale_mode, ref_width, ref_height);
  }

  static to_mm(raw_aspect, width, height, size_unit, scale_mode, ref_width, ref_height) {
    var width_ret = LENGTH_UNITS_REL[size_unit].to_mm(parseFloat(width), ref_width);
    var height_ret = LENGTH_UNITS_REL[size_unit].to_mm(parseFloat(height), ref_height);

    const _width_wanted = height_ret * raw_aspect;
    if (scale_mode == "cover") {
      if (width_ret >= _width_wanted) {
        height_ret = width_ret / raw_aspect;
      } else {
        width_ret = _width_wanted;
      }
    }
    if (scale_mode == "contain") {
      if (width_ret >= _width_wanted) {
        width_ret = _width_wanted;
      } else {
        height_ret = width_ret / raw_aspect;
      }
    }
    return [width_ret, height_ret];
  }

  to_deg() {
    return this.constructor.to_deg(this.rotation, this.rotation_unit);
  }

  static to_deg(value, unit) {
    return ANGLE_UNITS[unit].to_deg(parseFloat(value));
  }
}