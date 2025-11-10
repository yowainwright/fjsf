_fjsf_widget() {
  if [[ "$BUFFER" =~ ^(npm|pnpm|yarn|bun)[[:space:]]+run([[:space:]](.*))?$ ]]; then
    local pm=${match[1]}
    local query=${match[3]:-""}
    query=${query%;*}
    local script
    script=$(fjsf --widget "$query")

    if [ -n "$script" ]; then
      BUFFER="$pm run $script"
      CURSOR=$#BUFFER
      zle accept-line
    fi
  else
    zle expand-or-complete
  fi
}

zle -N _fjsf_widget

_fjsf_ensure_binding() {
  local current_widget="${widgets[^I]}"
  if [[ "$current_widget" != "user:_fjsf_widget" ]]; then
    bindkey '^I' _fjsf_widget
  fi
}

bindkey '^I' _fjsf_widget

autoload -Uz add-zsh-hook
add-zsh-hook precmd _fjsf_ensure_binding
