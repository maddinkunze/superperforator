class PerforationWriter {
  static _STATE_DEFAULT = "default"
  static _STATE_CUT = "cut"
  
  static DIRECTION_CW = "cw"
  static DIRECTION_CCW = "ccw"

  _state = PerforationWriter._STATE_DEFAULT;
  #data = "";
  _lastX = 0;
  _lastY = 0;

  start() {
    this.#data = "";
  }
  write(command) {
    this.#data += command;
  }
  writeln(command) {
    this.write(command + "\n");
  }
  stop() {
    return this.#data;
  }
  start_block() {}
  end_block() {}
  start_cut() {
    this._state = PerforationWriter._STATE_CUT;
  }
  end_cut() {
    this._state = PerforationWriter._STATE_DEFAULT;
  }
  move(x, y) { this._set_last_position(x, y); }
  arc(x, y, r, d) { this._set_last_position(x, y); }

  _distance(x, y) { // calculates the distance between last known drawing point and given coordinates
    const dx = x - this._lastX;
    const dy = y - this._lastY;
    return Math.sqrt(dx*dx + dy*dy);
  }

  _center(x, y) { // calculates the midpoint between last known drawing point and given coordinates
    return [(x + this._lastX) / 2, (y + this._lastY) / 2];
  }

  _arc_center(x, y, r, d) { // calculates the center of an arc defined by two points (last known drawing point and given coordinates) a radius and a direction (clockwise or ccw)
    const xref = (d == PerforationWriter.DIRECTION_CCW) ? this._lastX : x; // --> point [ref]
    const yref = (d == PerforationWriter.DIRECTION_CCW) ? this._lastY : y;

    const dist = this._distance(x, y); // distance between last and next point
    const [xc, yc] = this._center(x, y); // coordinates of point in the center between last and next point --> point [mid]
    const th = Math.sqrt(r*r - (dist*dist)/4); // height of the isosceles triangle spanned by the start, end and circle-center points (= length of [mid<->circle-center])
    const thf = 2 * (th / dist); // ratio between [mid<->circle-center] and [ref<->mid] --> needed for "vector"-like calculations later

    const xf = xc + thf * (yc - yref); // --> point [circle-center]
    const yf = yc + thf * (xref - xc); // equivalent to obtaining a vector perpendicular to [ref<->mid] (thus parallel to [mid<->circle-center]), scaling it to the length of [mid<->circle-center] (= th) and adding it to [mid]

    return [xf, yf];
  }

  _set_last_position(x, y) {
    if (x != null) this._lastX = x;
    if (y != null) this._lastY = y;
  }
}

class _CanvasWriter extends PerforationWriter {
  _canvas;
  _path

  constructor(context) {
    super();
    this._canvas = context;
  }

  start() {
    this._canvas.beginPath();
  }
  write(command) {}
  writeln(command) {}

  move(x, y) {
    if (this._state == PerforationWriter._STATE_DEFAULT) {
      this._canvas.moveTo(x, y);
    } else if (this._state == PerforationWriter._STATE_CUT) {
      this._canvas.lineTo(x, y);
    }
    this._set_last_position(x, y);
  }

  arc(x, y, r, d) {
    if (this._state == PerforationWriter._STATE_DEFAULT) {
      this._canvas.moveTo(x, y);
    } else if (r <= 0) {
      this._canvas.lineTo(x, y);
    } else if (this._state == PerforationWriter._STATE_CUT) {
      const ccw = (d == PerforationWriter.DIRECTION_CCW);
      var [cx, cy] = this._arc_center(x, y, r, d);
      var sa = this.#angle(cx, cy, this._lastX, this._lastY, r);
      var ea = this.#angle(cx, cy, x, y, r);
      this._canvas.arc(cx, cy, r, sa, ea, ccw);
    }
    this._set_last_position(x, y);
  }

  #angle(x1, y1, x2, y2, d) {
    const dx = x2 - x1;
    var ret = Math.acos(clamp(-1, dx / d, 1));
    if (y2 < y1) {
      ret = 2 * Math.PI - ret;
    }
    return ret;
  }
}

class CanvasLineWriter extends _CanvasWriter {
  #lineWidth;
  #lineColor;
  constructor(context, lineWidth, lineColor) {
    super(context);
    this.#lineWidth = lineWidth;
    this.#lineColor = lineColor;
  }
  stop() {
    this._canvas.save();
    this._canvas.resetTransform();
    this._canvas.lineWidth = this.#lineWidth;
    this._canvas.strokeStyle = this.#lineColor;
    this._canvas.stroke();
    this._canvas.restore();
  }
}

class CanvasCutterWriter extends _CanvasWriter {
  constructor(context) {
    super(context);
  }
  stop() {
    this._canvas.save();
    this._canvas.clip();
    this._canvas.resetTransform();
    this._canvas.clearRect(0, 0, this._canvas.canvas.width, this._canvas.canvas.height);
    this._canvas.restore();
  }
  end_cut() {}
  end_block() {
    this._state = PerforationWriter._STATE_DEFAULT;
    this._canvas.closePath();
  }
}

class SVGWriter extends PerforationWriter {

}

class GCodeWriter extends PerforationWriter {
  #feedrates = {};
  #gcode_commands_move = {};
  #gcode_commands_arc = {};

  constructor(feedrate_cut, feedrate_default) {
    super();
    this.#feedrates[PerforationWriter._STATE_DEFAULT] = feedrate_default;
    this.#feedrates[PerforationWriter._STATE_CUT] = feedrate_cut;

    this.#gcode_commands_move[PerforationWriter._STATE_DEFAULT] = "G0";
    this.#gcode_commands_move[PerforationWriter._STATE_CUT] = "G1";

    var arc_default = {};
    arc_default[PerforationWriter.DIRECTION_CW] = "G2";
    arc_default[PerforationWriter.DIRECTION_CCW] = "G3";
    this.#gcode_commands_arc[PerforationWriter._STATE_DEFAULT] = arc_default;
  }

  move(x, y) {
    var command_default = this.#gcode_commands_move[PerforationWriter._STATE_DEFAULT];
    var command = this.#gcode_commands_move[this._state] || command_default;

    var xa = x.toFixed(5)
    var ya = y.toFixed(5)

    var feedrate_default = this.#feedrates[PerforationWriter._STATE_DEFAULT];
    var feedrate = this.#feedrates[PerforationWriter._STATE_CUT] || feedrate_default;

    var line = command + " X" + xa + " Y" + ya + " F" + feedrate;
    this.writeln(line);
    this._set_last_position(x, y);
  }

  arc(x, y, r, d) {
    const commands_default = this.#gcode_commands_arc[PerforationWriter._STATE_DEFAULT];
    const commands = this.#gcode_commands_arc[this._state] || commands_default;
    const command = commands[d] || commands_default[d] || "; ERROR: No valid command found for arc in direction \"" + d + "\" while in state \"" + this._state + "\" / G#";

    const xa = x.toFixed(5)
    const ya = y.toFixed(5)

    const [cx, cy] = this._arc_center(x, y, r, d);
    const ia = (cx - this._lastX).toFixed(5);
    const ja = (cy - this._lastY).toFixed(5);

    const feedrate_default = this.#feedrates[PerforationWriter._STATE_DEFAULT];
    const feedrate = this.#feedrates[PerforationWriter._STATE_CUT] || feedrate_default;

    const line = command + " X" + xa + " Y" + ya + " I" + ia + " J" + ja + " R" + r + " F" + feedrate;
    this.writeln(line);
    this._set_last_position(x, y);
  }
}

class GCodeWriterLaser extends GCodeWriter {
  #power_cut;

  constructor(power_cut, feedrate_cut, feedrate_default) {
    super(feedrate_cut, feedrate_default);
    this.#power_cut = power_cut;
  }

  #enable_laser() {
    this.writeln("M3 S"+this.#power_cut);
  }

  #disable_laser() {
    this.writeln("M5");
  }

  start() {
    super.start();
    this.#disable_laser();
  }

  stop() {
    this.#disable_laser();
    return super.stop();
  }

  start_cut() {
    super.start_cut();
    this.#enable_laser();
  }

  end_cut() {
    this.#disable_laser();
    super.end_cut();
  }
}

class GCodeWriterCutter extends GCodeWriter {
  #speed_cut;

  constructor(speed_cut, feedrate_cut, feedrate_default) {
    super(feedrate_cut, feedrate_default);
    this.#speed_cut = speed_cut;
  }

  #start_motor() {
    this.writeln("M3 S"+this.#speed_cut);
  }

  #stop_motor() {
    this.writeln("M5");
  }

  start() {
    super.start();
    this.#stop_motor();
  }

  stop() {
    this.#stop_motor();
    return super.stop();
  }

  start_cut() {
    super.start_cut();
    this.#start_motor();
  }

  end_cut() {
    this.#stop_motor();
    super.end_cut();
  }
}