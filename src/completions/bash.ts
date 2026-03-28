export const bashCompletions = (bin: string): string =>
  `
_envsec_completions() {
    local i cur prev opts cmd subcmd context_val
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    cmd=""
    subcmd=""
    context_val=""

    # Detect current subcommand and --context value
    for ((i=1; i < COMP_CWORD; i++)); do
        case "\${COMP_WORDS[i]}" in
            -c|--context)
                context_val="\${COMP_WORDS[i+1]}"
                ((i++))
                ;;
            add|get|delete|del|search|list|run|env|env-file|load|cmd|audit|share|tui)
                if [[ -z "$cmd" ]]; then
                    cmd="\${COMP_WORDS[i]}"
                fi
                ;;
            run|search|list|delete)
                if [[ "$cmd" == "cmd" && -z "$subcmd" ]]; then
                    subcmd="\${COMP_WORDS[i]}"
                fi
                ;;
        esac
    done

    # Also check ENVSEC_CONTEXT env var
    if [[ -z "$context_val" && -n "$ENVSEC_CONTEXT" ]]; then
        context_val="$ENVSEC_CONTEXT"
    fi

    # Complete --context / -c values with dynamic contexts
    if [[ "$prev" == "-c" || "$prev" == "--context" ]]; then
        local contexts
        contexts="$(${bin} __complete contexts 2>/dev/null)"
        COMPREPLY=( $(compgen -W "$contexts" -- "$cur") )
        return 0
    fi

    # Complete --override-context / -o values with dynamic contexts
    if [[ "$prev" == "-o" || "$prev" == "--override-context" ]]; then
        local contexts
        contexts="$(${bin} __complete contexts 2>/dev/null)"
        COMPREPLY=( $(compgen -W "$contexts" -- "$cur") )
        return 0
    fi

    # Complete --shell / -s values
    if [[ "$prev" == "-s" || "$prev" == "--shell" ]]; then
        COMPREPLY=( $(compgen -W "bash zsh fish powershell" -- "$cur") )
        return 0
    fi

    # Complete --completions values
    if [[ "$prev" == "--completions" ]]; then
        COMPREPLY=( $(compgen -W "bash zsh fish" -- "$cur") )
        return 0
    fi

    # Complete --db with file paths
    if [[ "$prev" == "--db" ]]; then
        COMPREPLY=( $(compgen -f -- "$cur") )
        return 0
    fi

    # If typing an option, complete options
    if [[ "$cur" == -* ]]; then
        case "$cmd" in
            "")
                opts="-c -d -h --context --debug --json --db --completions --help --version add get delete del search list run env env-file load cmd audit share tui"
                ;;
            add)
                opts="-v -e -h --value --expires --help"
                ;;
            get)
                opts="-q -h --quiet --help"
                ;;
            delete|del)
                opts="-y -h --yes --all --help"
                ;;
            search)
                opts="-h --help"
                ;;
            list)
                opts="-h --help"
                ;;
            run)
                opts="-s -n -h --save --name --help"
                ;;
            env)
                opts="-s -u -h --shell --unset --help"
                ;;
            env-file)
                opts="-o -h --output --help"
                ;;
            load)
                opts="-h --help"
                ;;
            cmd)
                opts="-h --help run search list delete"
                ;;
            audit)
                opts="-w -h --within --help"
                ;;
            share)
                opts="-r -h --recipient --help"
                ;;
        esac
        COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
        return 0
    fi

    # Positional argument completions
    case "$cmd" in
        "")
            # Top-level: complete subcommands
            COMPREPLY=( $(compgen -W "add get delete del search list run env env-file load cmd audit share tui" -- "$cur") )
            ;;
        get|delete|del|add)
            # Complete secret keys if context is known
            if [[ -n "$context_val" ]]; then
                local keys
                keys="$(${bin} __complete keys "$context_val" 2>/dev/null)"
                COMPREPLY=( $(compgen -W "$keys" -- "$cur") )
            fi
            ;;
        cmd)
            if [[ -z "$subcmd" ]]; then
                COMPREPLY=( $(compgen -W "run search list delete" -- "$cur") )
            elif [[ "$subcmd" == "run" || "$subcmd" == "delete" ]]; then
                local cmds
                cmds="$(${bin} __complete commands 2>/dev/null)"
                COMPREPLY=( $(compgen -W "$cmds" -- "$cur") )
            fi
            ;;
        env-file)
            # Complete file paths
            COMPREPLY=( $(compgen -f -- "$cur") )
            ;;
        load)
            # Complete file paths
            COMPREPLY=( $(compgen -f -- "$cur") )
            ;;
    esac
    return 0
}

complete -F _envsec_completions -o nosort -o bashdefault -o default envsec
complete -F _envsec_completions -o nosort -o bashdefault -o default esec
`.trimStart();
