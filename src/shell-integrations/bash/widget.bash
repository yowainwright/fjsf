_fjsf_complete() {
  local line="$READLINE_LINE"

  if [[ "$line" =~ ^(npm|pnpm|yarn|bun)[[:space:]]+run([[:space:]](.*))?$ ]]; then
    local pm=${BASH_REMATCH[1]}
    local query=${BASH_REMATCH[3]:-""}
    local script
    script=$(fjsf --widget "$query")

    if [ -n "$script" ]; then
      READLINE_LINE="$pm run $script"
      READLINE_POINT=${#READLINE_LINE}
      return
    fi
  fi

  complete -p &>/dev/null && return 124
}

_fjsf_ensure_binding() {
  if ! bind -X | grep -q '_fjsf_complete'; then
    bind -x '"\C-i": _fjsf_complete' 2>/dev/null
  fi
}

bind -x '"\C-i": _fjsf_complete'

if [[ ":$PROMPT_COMMAND:" != *":_fjsf_ensure_binding:"* ]]; then
  PROMPT_COMMAND="_fjsf_ensure_binding${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
fi
