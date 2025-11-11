_fjsf_completions() {
  local -a commands
  commands=(
    'find:Find all versions of file'
    'f:Find (short)'
    'path:Query specific file'
    'p:Path (short)'
    'exec:Execute key from file'
    'e:Exec (short)'
    'help:Show help'
    'h:Help (short)'
    'init:Setup shell integration'
    'quit:Exit'
    'q:Quit (short)'
  )
  _describe 'command' commands
}

compdef _fjsf_completions fjsf
