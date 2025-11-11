_fjsf_native_completions() {
  local cur prev words cword
  _get_comp_words_by_ref -n : cur prev words cword

  if [[ "${words[1]}" == "run" ]] && [[ ${cword} -eq 2 ]]; then
    local scripts
    scripts=$(fjsf --completions "$cur" 2>/dev/null | cut -d: -f1)

    COMPREPLY=($(compgen -W "$scripts" -- "$cur"))
  fi
}

complete -F _fjsf_native_completions bun
complete -F _fjsf_native_completions npm
complete -F _fjsf_native_completions pnpm
complete -F _fjsf_native_completions yarn
