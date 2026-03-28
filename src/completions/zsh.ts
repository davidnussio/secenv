export const zshCompletions = (bin: string): string =>
  `
#compdef envsec esec

autoload -U is-at-least

_envsec_contexts() {
    local -a contexts
    contexts=("\${(@f)$(${bin} __complete contexts 2>/dev/null)}")
    _describe 'context' contexts
}

_envsec_keys() {
    local ctx="\${opt_args[-c]:-\${opt_args[--context]:-$ENVSEC_CONTEXT}}"
    if [[ -n "$ctx" ]]; then
        local -a keys
        keys=("\${(@f)$(${bin} __complete keys "$ctx" 2>/dev/null)}")
        _describe 'key' keys
    fi
}

_envsec_commands() {
    local -a cmds
    cmds=("\${(@f)$(${bin} __complete commands 2>/dev/null)}")
    _describe 'command name' cmds
}

_envsec() {
    local context curcontext="$curcontext" state line
    typeset -A opt_args

    _arguments -C \\
        '(-c --context)'{-c,--context}'[Context name]:context:_envsec_contexts' \\
        '(-d --debug)'{-d,--debug}'[Enable debug logging]' \\
        '--json[Output in JSON format]' \\
        '--db[Path to SQLite database]:file:_files' \\
        '--completions[Generate completion script]:shell:(bash zsh fish)' \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '--version[Show version]' \\
        '1: :->command' \\
        '*:: :->args' \\
        && return 0

    case $state in
        command)
            local -a subcommands=(
                'add:Store a secret'
                'get:Retrieve a secret'
                'delete:Remove a secret'
                'del:Remove a secret (alias)'
                'search:Search contexts or secrets'
                'list:List secrets or contexts'
                'run:Execute command with secrets'
                'env:Export secrets as env vars'
                'env-file:Export secrets to .env file'
                'load:Import secrets from .env file'
                'cmd:Saved command management'
                'audit:Check expired/expiring secrets'
                'share:GPG-encrypted export'
                'rename:Rename a secret key'
                'move:Move secrets between contexts'
                'copy:Copy secrets between contexts'
            )
            _describe 'subcommand' subcommands
            ;;
        args)
            case $line[1] in
                add)
                    _arguments \\
                        '(-v --value)'{-v,--value}'[Value to store]:value:' \\
                        '(-e --expires)'{-e,--expires}'[Expiry duration]:duration:' \\
                        '1:key:_envsec_keys'
                    ;;
                get)
                    _arguments \\
                        '(-q --quiet)'{-q,--quiet}'[Print only the value]' \\
                        '1:key:_envsec_keys'
                    ;;
                delete|del)
                    _arguments \\
                        '(-y --yes)'{-y,--yes}'[Skip confirmation]' \\
                        '--all[Delete all secrets]' \\
                        '1:key:_envsec_keys'
                    ;;
                search)
                    _arguments '1:pattern:'
                    ;;
                list)
                    ;;
                run)
                    _arguments \\
                        '(-s --save)'{-s,--save}'[Save command]' \\
                        '(-n --name)'{-n,--name}'[Command name]:name:' \\
                        '1:command:'
                    ;;
                env)
                    _arguments \\
                        '(-s --shell)'{-s,--shell}'[Target shell]:shell:(bash zsh fish powershell)' \\
                        '(-u --unset)'{-u,--unset}'[Output unset commands]'
                    ;;
                env-file)
                    _arguments \\
                        '(-o --output)'{-o,--output}'[Output file]:file:_files' \\
                    ;;
                load)
                    _arguments '1:file:_files'
                    ;;
                cmd)
                    local -a cmd_subcommands=(
                        'run:Run a saved command'
                        'search:Search saved commands'
                        'list:List saved commands'
                        'delete:Delete a saved command'
                    )
                    _arguments '1: :->cmd_sub' '*:: :->cmd_args'
                    case $state in
                        cmd_sub)
                            _describe 'cmd subcommand' cmd_subcommands
                            ;;
                        cmd_args)
                            case $line[1] in
                                run)
                                    _arguments \\
                                        '(-o --override-context)'{-o,--override-context}'[Override context]:context:_envsec_contexts' \\
                                        '(-q --quiet)'{-q,--quiet}'[Suppress output]' \\
                                        '1:name:_envsec_commands'
                                    ;;
                                delete)
                                    _arguments '1:name:_envsec_commands'
                                    ;;
                                search)
                                    _arguments \\
                                        '(-n --name)'{-n,--name}'[Search names only]' \\
                                        '(-m --command)'{-m,--command}'[Search commands only]' \\
                                        '1:pattern:'
                                    ;;
                                list) ;;
                            esac
                            ;;
                    esac
                    ;;
                audit)
                    _arguments \\
                        '(-w --within)'{-w,--within}'[Duration window]:duration:'
                    ;;
                share)
                    _arguments \\
                        '(-r --recipient)'{-r,--recipient}'[GPG recipient]:recipient:'
                    ;;
                rename)
                    _arguments \\
                        '(-f --force)'{-f,--force}'[Overwrite target if exists]' \\
                        '1:old key:_envsec_keys' \\
                        '2:new key:_envsec_keys'
                    ;;
                move)
                    _arguments \\
                        '(-t --to)'{-t,--to}'[Target context]:context:_envsec_contexts' \\
                        '(-f --force)'{-f,--force}'[Overwrite existing secrets]' \\
                        '(-y --yes)'{-y,--yes}'[Skip confirmation]' \\
                        '--all[Move all secrets]' \\
                        '1:pattern:_envsec_keys'
                    ;;
                copy)
                    _arguments \\
                        '(-t --to)'{-t,--to}'[Target context]:context:_envsec_contexts' \\
                        '(-f --force)'{-f,--force}'[Overwrite existing secrets]' \\
                        '(-y --yes)'{-y,--yes}'[Skip confirmation]' \\
                        '--all[Copy all secrets]' \\
                        '1:pattern:_envsec_keys'
                    ;;
            esac
            ;;
    esac
}

_envsec "$@"
`.trimStart();
