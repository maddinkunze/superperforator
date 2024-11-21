_DIFF_SENTINEL_DEL = new Object("DIFF SENTINEL DEL");

function calc_json_diff(json_1, json_2) { // TODO
  if (json_2 === undefined) {
    return _DIFF_SENTINEL_DEL;
  }
  if (json_1 == json_2) {
    return;
  }
  if (Number.isNaN(json_1) && Number.isNaN(json_2)) {
    return;
  }
  if (!(json_1 instanceof Object) || !(json_2 instanceof Object)) {
    return json_2;
  }
  const diff = {}
  const keys = Object.keys(json_1);
  const keys_2 = Object.keys(json_2);
  for (var i=0; i<keys_2.length; i++) {
    const k = keys_2[i];
    if (keys.includes(k)) { continue; }
    keys.push(k);
  }
  for (var i=0; i<keys.length; i++) {
    const k = keys[i];
    const d = calc_json_diff(json_1[k], json_2[k]);
    if (d === undefined) { continue; }
    diff[k] = d;
  }
  return diff;
}

function apply_json_diff(json_1, json_diff) {
  if (!json_diff) { return; }
  const keys = Object.keys(json_diff);
  for (var i=0; i<keys.length; i++) {
    const k = keys[i];
    var v = json_diff[k];
    if (v === _DIFF_SENTINEL_DEL) {
      delete json_1[k];
      continue;
    }
    if (v instanceof Object) {
      var v2 = json_1[k];
      if (!(v2 instanceof Object)) {
        v2 = {};
      }
      apply_json_diff(v2, v);
      v = v2;
    }
    json_1[k] = v;
  }
}

function reset_canvas(ctx) {
  ctx.save();
  ctx.resetTransform();
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

function clamp(min, v, max) {
  return Math.min(Math.max(v, min), max);
}