class Selectable {
  select_display_name() {}
}

class Unit extends Selectable {
  name;
  symbol;
  constructor(name, symbol) {
    super()
    this.name = name;
    this.symbol = symbol;
  }
  select_display_name() {
    return this.symbol;
  }
}


/* Length Units */

class LengthUnit extends Unit {
  to_mm(value, reference) {}
}

class _LengthUnit extends LengthUnit {
  mm_per_unit;
  constructor(name, symbol, mm_per_unit) {
    super(name, symbol);
    this.mm_per_unit = mm_per_unit;
  }
  to_mm(value, reference) {
    return value * this.mm_per_unit;
  }
}

class _LengthUnitPercent extends LengthUnit {
  constructor() {
    super("Percent", "%");
  }
  to_mm(value, reference) {
    return (value / 100) * reference;
  }
}

const LENGTH_UNITS_ABS = {
  mm: new _LengthUnit("millimeter", "mm", 1),
  cm: new _LengthUnit("centimeter", "cm", 10),
  in: new _LengthUnit("inch", "in", 25.4),
};

const LENGTH_UNITS_REL = {
  ...LENGTH_UNITS_ABS,
  percent: new _LengthUnitPercent(),
};


/* Velocity Units */

class VelocityUnit extends Unit {
  mms_per_unit;
  constructor(name, symbol, mms_per_unit) {
    super(name, symbol);
    this.mms_per_unit = mms_per_unit;
  }
  to_mms(value) {
    return this.mms_per_unit * value;
  }
}

const VELOCITY_UNITS = {
  mms: new VelocityUnit("millimeters per second", "mm/s", 1),
  ins: new VelocityUnit("inches per second", "in/s", 25.4),
};


/* Angle Units */

class AngleUnit extends Unit {
  deg_per_unit;
  constructor(name, symbol, deg_per_unit) {
    super(name, symbol);
    this.deg_per_unit = deg_per_unit;
  }
  to_deg(value) {
    return this.deg_per_unit * value;
  }
  from_deg(value) {
    return value / this.deg_per_unit;
  }
}

const ANGLE_UNITS = {
  deg: new AngleUnit("degree", "°", 1),
  rad: new AngleUnit("radian", "rad", 180/Math.PI),
};


/* Rotational Velocity Units */

class RotVelUnit extends Unit {
  rpm_per_unit;
  constructor(name, symbol, rpm_per_unit) {
    super(name, symbol);
    this.rpm_per_unit = rpm_per_unit;
  }
  to_rpm(value) {
    return this.rpm_per_unit * value;
  }
}

const ROTVEL_UNITS = {
  rpm: new RotVelUnit("rotations per minute", "rpm", 1),
};



class Anchor {
  static _COMPONENTS = {
    LEFT: 0,
    TOP: 0,
    CENTER: 0.5,
    RIGHT: 1,
    BOTTOM: 1
  };

  x;
  y;

  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  static TOP_LEFT      = new Anchor(this._COMPONENTS.LEFT,   this._COMPONENTS.TOP);
  static TOP_CENTER    = new Anchor(this._COMPONENTS.CENTER, this._COMPONENTS.TOP);
  static TOP_RIGHT     = new Anchor(this._COMPONENTS.RIGHT,  this._COMPONENTS.TOP);
  static CENTER_LEFT   = new Anchor(this._COMPONENTS.LEFT,   this._COMPONENTS.CENTER);
  static CENTER        = new Anchor(this._COMPONENTS.CENTER, this._COMPONENTS.CENTER);
  static CENTER_RIGHT  = new Anchor(this._COMPONENTS.RIGHT,  this._COMPONENTS.CENTER);
  static BOTTOM_LEFT   = new Anchor(this._COMPONENTS.LEFT,   this._COMPONENTS.BOTTOM);
  static BOTTOM_CENTER = new Anchor(this._COMPONENTS.CENTER, this._COMPONENTS.BOTTOM);
  static BOTTOM_RIGHT  = new Anchor(this._COMPONENTS.RIGHT,  this._COMPONENTS.BOTTOM);
}

class Position {
  x;
  y;
  anchor;
  constructor(x, y, anchor) {
    this.x = x;
    this.y = y;
    this.anchor = anchor;
  }

  get_center_position(container_bb, bounding_bb) {

  }

  get_top_left_position(container_bb, object_bb) {
  }

  #get_position(container_bb, object_bb, position_anchor) {

  }
}