if ! (( $+_comps )); then
  autoload -Uz compinit
  compinit -D
fi

_fjsf_original_bun=${_comps[bun]:-_default}
_fjsf_original_npm=${_comps[npm]:-_default}
_fjsf_original_pnpm=${_comps[pnpm]:-_default}
_fjsf_original_yarn=${_comps[yarn]:-_default}

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

  $_fjsf_original_bun "$@"
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

  $_fjsf_original_npm "$@"
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

  $_fjsf_original_pnpm "$@"
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

  $_fjsf_original_yarn "$@"
}

compdef _fjsf_native_bun_run bun
compdef _fjsf_native_npm_run npm
compdef _fjsf_native_pnpm_run pnpm
compdef _fjsf_native_yarn_run yarn
