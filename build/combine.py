import os
import re
import base64

BUILD_DIR = os.path.realpath(os.path.dirname(__file__))
SRC_DIR = os.path.realpath(os.path.join(BUILD_DIR, os.path.pardir, "src"))

re_icon_in_html = re.compile(rb"""<link rel="icon" href="([\w\-\/\.]+)">""")
re_style_in_html = re.compile(rb"""<link rel="stylesheet" href="([\w\-\/\.]+)">""")
re_script_in_html = re.compile(rb"""<script src="([\w\-\/\.]+)"></script>""")
mime_types = {b"svg": b"image/svg+xml"}
def resolve_dependencies_html(path, name, data):
  data = re.sub(re_icon_in_html, lambda m: b"<link rel=\"icon\" href=\"data:"+mime_types[m[1].split(b".")[-1]]+b";base64,"+base64.b64encode(resolve_dependencies(os.path.join(path, m[1].decode())))+b"\"><!-- file: " + m[1] + b" -->", data)
  data = re.sub(re_style_in_html, lambda m: b"<style>" + b"/* file: " + m[1] + b" */" + resolve_dependencies(os.path.join(path, m[1].decode())) + b"</style>", data)
  data = re.sub(re_script_in_html, lambda m: b"<script>" + b"/* file: " + m[1] + b" */" + resolve_dependencies(os.path.join(path, m[1].decode())) + b"</script>", data)
  return data

re_url_in_css = re.compile(rb"""(?<=[:\s,])url\(['"]([\w\-\.\/]+)['"]\)\s+format\(['"](\w+)['"]\)""")
url_types = {b"woff2": b"font/woff2", b"woff": b"application/font-woff"}
def resolve_dependencies_css(path, name, data):
  data = re.sub(re_url_in_css, lambda m: b"url('data:"+url_types[m[2]]+b";base64,"+base64.b64encode(resolve_dependencies(os.path.join(path, m[1].decode())))+b"') format('"+m[2]+b"')", data)
  return data

def resolve_dependencies(filepath):
  path, name = os.path.split(filepath)
  ext = os.path.splitext(name)[1][1:]
  data = open(filepath, "rb").read()
  if ext in ["html"]:
    return resolve_dependencies_html(path, name, data)
  elif ext in ["css"]:
    return resolve_dependencies_css(path, name, data)
  elif ext in ["js", "woff", "woff2", "png", "jpg", "svg"]:
    return data
  else:
    raise ValueError(f"cannot resolve dependencies for file {name} ({path}) - unregistered extension {ext}")

def main():
  data = resolve_dependencies(os.path.join(SRC_DIR, "index.html"))
  version = re.search(rb"""const\s+APP_VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]\s*;""", data)[1].decode() # find 'const APP_VERSION = "x.x.x";' line
  file = open(os.path.join(BUILD_DIR, f"superperforator-v{version}.html"), "wb")
  file.write(data)
  file.close()

if __name__ == "__main__":
  main()
