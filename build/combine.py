import os

# TODO: everything

SRC_DIR = os.path.realpath(os.path.join(os.path.dirname(__file__), os.path.pardir, "src"))

def resolve_dependencies_html(path, name, data):
  pass

def resolve_dependencies_css(path, name, data):
  pass

def resolve_dependencies(filepath):
  path, name = os.path.split(filepath)
  data = open(filepath).read()
  ext = os.path.splitext(name)[0]
  if ext in ["html"]:
    return resolve_dependencies_html(path, name, data)
  elif ext in ["css"]:
    return resolve_dependencies_css(path, name, data)
  elif ext in ["js", "woff"]:
    return data
  else:
    raise ValueError(f"cannot resolve dependencies for file {name} ({path}) - unregistered extension {ext}")

def main():
  open("superperforator.html", "w").write(resolve_dependencies(os.path.join(SRC_DIR, "index.html")))

if __name__ == "__main__":
  main()