_fjsf_completions() {
  local cur="${COMP_WORDS[COMP_CWORD]}"
  local commands="find f path p exec e help h quit q init"

  if [ ${COMP_CWORD} -eq 1 ]; then
    COMPREPLY=($(compgen -W "$commands" -- "$cur"))
  fi
}

complete -F _fjsf_completions fjsf
