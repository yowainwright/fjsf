function _fjsf_widget
  set -l line (commandline)

  if string match -qr '^(npm|pnpm|yarn|bun)\s+run(\s.*)?$' -- $line
    set -l parts (string match -r '^(npm|pnpm|yarn|bun)\s+run(\s(.*))?$' -- $line)
    set -l pm $parts[2]
    set -l query $parts[4]
    if test -z "$query"
      set query ""
    end
    set -l script (fjsf --widget "$query")

    if test -n "$script"
      commandline -r "$pm run $script"
      commandline -f execute
    end
  else
    commandline -f complete
  end
end

bind \t _fjsf_widget
