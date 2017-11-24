#!/bin/bash

# Ensure all JavaScript files staged for commit pass standard code style
function xargs-r() {
  # Portable version of "xargs -r". The -r flag is a GNU extension that
  # prevents xargs from running if there are no input files.
  if IFS= read -r -d '' path; then
    { echo -n "$path"; echo -ne "\0"; cat; } | xargs $@
  fi
}
git diff --name-only --cached --relative | grep -a '\.jsx\?$' | xargs-r standard-markdown
git diff --name-only --cached --relative | grep -a '\.jsx\?$' | xargs-r standard
if [[ $? -ne 0 ]]; then
  echo 'JavaScript Standard Style errors were detected. Aborting commit.'
  exit 1
fi
