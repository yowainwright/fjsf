if ! (( $+_comps )); then
  autoload -Uz compinit
  compinit -D
fi

_fjsf_get_original_completion() {
  local cmd=$1
  local comp_func="${_comps[$cmd]}"

  if [[ -n "$comp_func" && "$comp_func" != "_fjsf_native_${cmd}_run" ]]; then
    echo "$comp_func"
  else
    echo "_default"
  fi
}

_fjsf_native_bun_run() {
  if [[ ${words[2]} == "run" ]] && (( CURRENT >= 3 )); then
    local -a scripts
    local query="${words[3]:-}"

    scripts=("${(@f)$(fjsf --completions "$query" 2>/dev/null)}")

    if (( ${#scripts} > 0 )); then
      _describe 'npm scripts' scripts
      return 0
    fi
  fi

  local original_func=$(_fjsf_get_original_completion "bun")
  $original_func "$@"
}

_fjsf_native_npm_run() {
  if [[ ${words[2]} == "run" ]] && (( CURRENT >= 3 )); then
    local -a scripts
    local query="${words[3]:-}"

    scripts=("${(@f)$(fjsf --completions "$query" 2>/dev/null)}")

    if (( ${#scripts} > 0 )); then
      _describe 'npm scripts' scripts
      return 0
    fi
  fi

  local original_func=$(_fjsf_get_original_completion "npm")
  $original_func "$@"
}

_fjsf_native_pnpm_run() {
  if [[ ${words[2]} == "run" ]] && (( CURRENT >= 3 )); then
    local -a scripts
    local query="${words[3]:-}"

    scripts=("${(@f)$(fjsf --completions "$query" 2>/dev/null)}")

    if (( ${#scripts} > 0 )); then
      _describe 'npm scripts' scripts
      return 0
    fi
  fi

  local original_func=$(_fjsf_get_original_completion "pnpm")
  $original_func "$@"
}

_fjsf_native_yarn_run() {
  if [[ ${words[2]} == "run" ]] && (( CURRENT >= 3 )); then
    local -a scripts
    local query="${words[3]:-}"

    scripts=("${(@f)$(fjsf --completions "$query" 2>/dev/null)}")

    if (( ${#scripts} > 0 )); then
      _describe 'npm scripts' scripts
      return 0
    fi
  fi

  local original_func=$(_fjsf_get_original_completion "yarn")
  $original_func "$@"
}

_fjsf_ensure_completions() {
  compdef _fjsf_native_bun_run bun
  compdef _fjsf_native_npm_run npm
  compdef _fjsf_native_pnpm_run pnpm
  compdef _fjsf_native_yarn_run yarn
}

_fjsf_ensure_completions

autoload -Uz add-zsh-hook
add-zsh-hook precmd _fjsf_ensure_completions
