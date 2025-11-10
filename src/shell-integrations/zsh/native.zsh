_fjsf_native_bun_run() {
  local context state line

  if [[ ${words[2]} == "run" ]] && (( CURRENT == 3 )); then
    local -a scripts
    local query="${words[3]:-}"

    scripts=("${(@f)$(fjsf --completions "$query" 2>/dev/null)}")

    if (( ${#scripts} > 0 )); then
      _describe 'npm scripts' scripts
    fi
  else
    _default
  fi
}

_fjsf_native_npm_run() {
  local context state line

  if [[ ${words[2]} == "run" ]] && (( CURRENT == 3 )); then
    local -a scripts
    local query="${words[3]:-}"

    scripts=("${(@f)$(fjsf --completions "$query" 2>/dev/null)}")

    if (( ${#scripts} > 0 )); then
      _describe 'npm scripts' scripts
    fi
  else
    _default
  fi
}

_fjsf_native_pnpm_run() {
  local context state line

  if [[ ${words[2]} == "run" ]] && (( CURRENT == 3 )); then
    local -a scripts
    local query="${words[3]:-}"

    scripts=("${(@f)$(fjsf --completions "$query" 2>/dev/null)}")

    if (( ${#scripts} > 0 )); then
      _describe 'npm scripts' scripts
    fi
  else
    _default
  fi
}

_fjsf_native_yarn_run() {
  local context state line

  if [[ ${words[2]} == "run" ]] && (( CURRENT == 3 )); then
    local -a scripts
    local query="${words[3]:-}"

    scripts=("${(@f)$(fjsf --completions "$query" 2>/dev/null)}")

    if (( ${#scripts} > 0 )); then
      _describe 'npm scripts' scripts
    fi
  else
    _default
  fi
}

compdef _fjsf_native_bun_run bun
compdef _fjsf_native_npm_run npm
compdef _fjsf_native_pnpm_run pnpm
compdef _fjsf_native_yarn_run yarn
