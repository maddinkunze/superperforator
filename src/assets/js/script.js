window.addEventListener("load", function() {
  const project = new Project();
  loading_screen.hide();
  this.project = project;

  const canvas = ["preview-canvas-front", "preview-canvas-back"].map(function(e) { return document.getElementById(e); });
  var _resize_debounce_id = null;
  function _on_resize_debounced() {
    clearTimeout(_resize_debounce_id);
    _resize_debounce_id = setTimeout(function() {
      canvas.forEach(function(e) { e.width = e.clientWidth; e.height = e.clientHeight; });
      project.draw(true);
    });
  }
  _on_resize_debounced();
  window.addEventListener("resize", _on_resize_debounced);
  document.getElementById("add-object").addEventListener("click", function() { project.objects.create_object(); });
});