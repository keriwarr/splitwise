#!/bin/bash

# Ensure all JavaScript files staged for commit pass standard code style
function xargs-r() {
  # Portable version of "xargs -r". The -r flag is a GNU extension that
  # prevents xargs from running if there are no input files.
  if IFS= read -r -d '' path; then
    { echo -n "$path"; echo -ne "\0"; cat; } | xargs $@
  fi
}
git diff -z --name-only --cached --relative | grep -a --null '\.jsx\?$' | xargs -0 standard-markdown
git diff -z --name-only --cached --relative | grep -a --null '\.jsx\?$' | xargs -0 standard
if [[ $? -ne 0 ]]; then
  echo 'JavaScript Standard Style errors were detected. Aborting commit.'
  exit 1
fi
