function _fjsf_native_completions
  set -l cmd (commandline -opc)

  if test (count $cmd) -eq 2; and test "$cmd[2]" = "run"
    set -l query (commandline -ct)
    fjsf --completions "$query" 2>/dev/null | while read -l line
      set -l parts (string split : -- $line)
      echo $parts[1]\t$parts[2]
    end
  end
end

complete -c bun -n "__fish_seen_subcommand_from run" -a "(_fjsf_native_completions)" -f
complete -c npm -n "__fish_seen_subcommand_from run" -a "(_fjsf_native_completions)" -f
complete -c pnpm -n "__fish_seen_subcommand_from run" -a "(_fjsf_native_completions)" -f
complete -c yarn -n "__fish_seen_subcommand_from run" -a "(_fjsf_native_completions)" -f
