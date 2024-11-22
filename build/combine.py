import os
import re
import base64

SRC_DIR = os.path.realpath(os.path.join(os.path.dirname(__file__), os.path.pardir, "src"))

re_style_in_html = re.compile(r"""<link rel="stylesheet" href="([\w\-\/\.]+)" \/>""")
re_script_in_html = re.compile(r"""<script src="([\w\-\/\.]+)"></script>""")
def resolve_dependencies_html(path, name, data):
  data = re.sub(re_style_in_html, lambda m: "<style>" + resolve_dependencies(os.path.join(path, m[1])) + "</style>", data)
  data = re.sub(re_script_in_html, lambda m: "<script>" + resolve_dependencies(os.path.join(path, m[1])) + "</script>", data)
  return data

re_url_in_css = re.compile(r"""(?<=[:\s,])url\(['"]([\w\-\.\/]+)['"]\)\s+format\(['"](\w+)['"]\)""")
url_types = {"woff2": "font/woff2", "woff": "application/font-woff"}
def resolve_dependencies_css(path, name, data):
  data = re.sub(re_url_in_css, lambda m: f"url('data:{url_types[m[2]]};base64,{base64.b64encode(resolve_dependencies(os.path.join(path, m[1]))).decode()}') format('{m[2]}')", data)
  return data

def resolve_dependencies(filepath):
  path, name = os.path.split(filepath)
  ext = os.path.splitext(name)[1][1:]
  _mode = "rb" if ext in ["woff", "woff2", "png", "jpg"] else "r"
  data = open(filepath, _mode).read()
  if ext in ["html"]:
    return resolve_dependencies_html(path, name, data)
  elif ext in ["css"]:
    return resolve_dependencies_css(path, name, data)
  elif ext in ["js", "woff", "woff2", "png", "jpg"]:
    return data
  else:
    raise ValueError(f"cannot resolve dependencies for file {name} ({path}) - unregistered extension {ext}")

def main():
  data = resolve_dependencies(os.path.join(SRC_DIR, "index.html"))
  version = re.search(r"""const\s+APP_VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]\s*;""", data)[1] # find 'const APP_VERSION = "x.x.x";' line
  file = open(f"superperforator-v{version}.html", "w")
  file.write(data)
  file.close()

if __name__ == "__main__":
  main()