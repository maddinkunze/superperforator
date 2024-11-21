class Perforator {
  #writer;
  #width_bridge
  #width_cut
  #width_material
  
  constructor(width_bridge, width_cut, width_material, writer) {
    this.#writer = writer;

    this.#width_bridge = width_bridge;
    this.#width_cut = width_cut;
    this.#width_material = width_material;
  }

  static #relative_to_absolute_point(point, origin) {
    const [ox, oy] = origin;
    const [px, py] = point;
    return [px+ox, py+oy];
  }

  static #flip_point(point, origin, flip) {
    const [ox, oy] = origin;
    const [px, py] = point;

    const qx = flip ? 2*ox-px : px;
    const qy = py;
    return [qx, qy];
  }

  static #deg2rad(angle) {
    return angle * (Math.PI/180);
  }

  static #rotate_point(point, origin, angle) {
    var [ox, oy] = origin;
    var [px, py] = point;
    var angle = this.#deg2rad(angle);

    const qx = ox + Math.cos(angle) * (px - ox) - Math.sin(angle) * (py - oy);
    const qy = oy + Math.sin(angle) * (px - ox) + Math.cos(angle) * (py - oy);
    return [qx, qy];
  }

  static #flip_and_rotate_point(point, origin, flip, angle) {
    const pf = this.#flip_point(point, origin, flip);
    const pr = this.#rotate_point(pf, origin, angle);
    return pr;
  }

  static #flip_and_rotate_relative_point(point, origin, flip, angle) {
    const pa = this.#relative_to_absolute_point(point, origin);
    const pf = this.#flip_and_rotate_point(pa, origin, flip, angle);
    return pf;
  }

  static #distance_between_points(p1, p2) {
    const [x1, y1] = p1;
    const [x2, y2] = p2;

    const dx = x2 - x1;
    const dy = y2 - y1;

    return Math.sqrt(dx*dx + dy*dy);
  }

  start() {
    this.#writer.start();
  }

  stop() {
    return this.#writer.stop();
  }

  movexy(x, y, cx, cy, flipped, angle) {
    const [xf, yf] = Perforator.#flip_and_rotate_relative_point([x, y], [cx, cy], flipped, angle);
    this.#writer.move(xf, yf, null);
  }

  arcxy(x, y, r, cx, cy, flipped, angle) {
    const [xf, yf] = Perforator.#flip_and_rotate_relative_point([x, y], [cx, cy], flipped, angle);
    const d = flipped ? PerforationWriter.DIRECTION_CCW : PerforationWriter.DIRECTION_CW;
    this.#writer.arc(xf, yf, r, d);
  }

  perforatexy(sx, sy, ex, ey, cx, cy, flipped, angle) {
    const [sxf, syf] = Perforator.#flip_and_rotate_relative_point([sx, sy], [cx, cy], flipped, angle);
    const [exf, eyf] = Perforator.#flip_and_rotate_relative_point([ex, ey], [cx, cy], flipped, angle);

    const distance = Perforator.#distance_between_points([sxf, syf], [exf, eyf]);
    const perforations = Math.floor((distance - this.#width_material) / (this.#width_cut + this.#width_material));
    const offset = (distance - this.#width_material - perforations * (this.#width_cut + this.#width_material)) / 2;

    const dx = (exf - sxf) / distance;
    const dy = (eyf - syf) / distance;

    const dxo = dx * offset;
    const dyo = dy * offset;

    const dxm = dx * this.#width_material;
    const dym = dy * this.#width_material;

    const dxc = dx * this.#width_cut;
    const dyc = dy * this.#width_cut;

    if (offset >= 0) {
      var xcur = sxf + dxo;
      var ycur = syf + dyo;

      this.#writer.move(xcur, ycur, null);
      this.#writer.end_cut();

      xcur += dxm;
      ycur += dym;

      this.#writer.move(xcur, ycur, null);

      for (var i=0; i<perforations; i++) {
        this.#writer.start_cut();

        xcur += dxc;
        ycur += dyc;
        
        this.#writer.move(xcur, ycur, null);

        this.#writer.end_cut();
        
        xcur += dxm;
        ycur += dym;
        
        this.#writer.move(xcur, ycur, null);
      }
    }

    this.#writer.start_cut();
    this.#writer.move(exf, eyf, null);
  }

  // movexy_with_bridge(x, y, cx, cy, ) {}

  rounded_square(cx, cy, width, height, radius, angle) {
    this.#writer.start_block();
    this.movexy(-width/2, -this.#width_bridge/2, cx, cy, false, angle);
    this.#writer.start_cut();

    // Top left corner
    this.movexy(-width/2, -height/2+radius, cx, cy, false, angle);
    if (radius) this.arcxy(-width/2+radius, -height/2, radius, cx, cy, false, angle);
    this.movexy(-this.#width_bridge/2, -height/2, cx, cy, false, angle);

    // Top bridge
    this.#writer.end_cut();
    this.movexy(this.#width_bridge/2, -height/2,  cx, cy, false, angle);
    this.#writer.start_cut();

    // Top right corner
    this.movexy(width/2-radius, -height/2, cx, cy, false, angle);
    if (radius) this.arcxy(width/2, -height/2+radius, radius, cx, cy, false, angle);

    // Right perforation
    this.perforatexy(width/2, -height/2+radius, width/2, height/2-radius, cx, cy, false, angle);

    // Bottom right corner
    if (radius) this.arcxy(width/2-radius, height/2, radius, cx, cy, false, angle);
    this.movexy(this.#width_bridge/2, height/2, cx, cy, false, angle);

    // Bottom bridge
    this.#writer.end_cut();
    this.movexy(-this.#width_bridge/2, height/2, cx, cy, false, angle);
    this.#writer.start_cut();

    // Bottom left corner
    this.movexy(-width/2+radius, height/2, cx, cy, false, angle);
    if (radius) this.arcxy(-width/2, height/2-radius, radius, cx, cy, false, angle);
    this.movexy(-width/2, this.#width_bridge/2, cx, cy, false, angle);

    // Left bridge
    this.#writer.end_cut();
    this.#writer.end_block();
  }

  square(cx, cy, width, height, angle) {
    this.rounded_square(cx, cy, width, height, 0, angle);
  }

  rounded_window(cx, cy, width, height, radius, angle) {
    const quart = (width - 2*radius) / 4
    
    this.#writer.start_block();
    this.movexy(-quart+this.#width_bridge/2, -height/2, cx, cy, false, angle);
    this.#writer.start_cut();

    // Top center
    this.movexy(quart-this.#width_bridge/2, -height/2, cx, cy, false, angle);

    // Top right bridge
    this.#writer.end_cut();
    this.movexy(quart+this.#width_bridge/2, -height/2, cx, cy, false, angle);
    this.#writer.start_cut();

    // Top right corner
    this.movexy(width/2-radius, -height/2,  cx, cy, false, angle);
    if (radius) this.arcxy(width/2, -height/2+radius, radius, cx, cy, false, angle);

    // Right perforation
    this.perforatexy(width/2, -height/2+radius, width/2, height/2-radius, cx, cy, false, angle);

    // Bottom right corner
    if (radius) this.arcxy(width/2-radius, height/2, radius, cx, cy, false, angle);
    this.movexy(quart+this.#width_bridge/2, height/2, cx, cy, false, angle);

    // Bottom right bridge
    this.#writer.end_cut();
    this.movexy(quart-this.#width_bridge/2, height/2, cx, cy, false, angle);
    this.#writer.start_cut();

    // Bottom center
    this.movexy(-quart+this.#width_bridge/2, height/2, cx, cy, false, angle);

    // Bottom left bridge
    this.#writer.end_cut();
    this.movexy(-quart-this.#width_bridge/2, height/2, cx, cy, false, angle);
    this.#writer.start_cut();

    // Bottom left corner
    this.movexy(-width/2+radius, height/2, cx, cy, false, angle);
    if (radius) this.arcxy(-width/2, height/2-radius, radius, cx, cy, false, angle);
    
    // Left perforation
    this.perforatexy(-width/2, height/2-radius, -width/2, -height/2+radius, cx, cy, false, angle);

    // Top left corner
    if (radius) this.arcxy(-width/2+radius, -height/2, radius, cx, cy, false, angle)
    this.movexy(-quart-this.#width_bridge/2, -height/2, cx, cy, false, angle);

    // Top left bridge
    this.#writer.end_cut();

    // Middle bridge
    this.movexy(0, -height/2, cx, cy, false, angle);
    this.#writer.start_cut();
    this.movexy(0, -this.#width_bridge/2, cx, cy, false, angle);
    this.#writer.end_cut();
    this.movexy(0, this.#width_bridge/2, cx, cy, false, angle);
    this.#writer.start_cut();
    this.movexy(0, height/2, cx, cy, false, angle);
    this.#writer.end_cut();

    this.#writer.end_block();
  }

  window(cx, cy, width, height, angle) {
    this.rounded_window(cx, cy, width, height, 0, angle);
  }
}