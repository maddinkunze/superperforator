class Image {
  data;
  size_mode;
  width;
  height;
  position;
  anchor_image;
  flipped;
  rotation;
}

class Shape {
  // visible, enabled, name, label, shape, width, height, radius, flipped, rotation, image, image_size_mode, image_width, image_height, image_x, image_y, image_rotation
  static ATTRIBUTE_NAMES = {
    NAME: "name",
    LABEL: "label",
    WIDTH: "width",
    HEIGHT: "height",
    SIIZE: "",
    POSITION: "position",
    RADIUS: "radius",
    FLIPPED: "flipped",
    ROTATION: "rotation",
    IMAGE: "image",
  };
  static ATTRIBUTES = [this.ATTRIBUTE_NAMES.NAME];
  draw(writer) {}
  cutout(writer) {}
  bounding() {}
  to_settings() {}
  static from_settings(settings) {}
}

class PositionedImageShape extends Shape {
  static ATTRIBUTES = [...super.ATTRIBUTES, super.ATTRIBUTE_NAMES.LABEL, super.ATTRIBUTE_NAMES]
}

class RoundedSquare extends Shape {
  static ATTRIBUTES = ["width", "height", ""];
}

class Square extends RoundedSquare {}

class RoundedWindow extends Shape {}

class Window extends Shape {}

class Heart extends Shape {}