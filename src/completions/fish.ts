export const fishCompletions = (bin: string): string =>
  `
# Disable file completions by default
complete -c envsec -f
complete -c esec -f

# Helper functions
function __envsec_contexts
    ${bin} __complete contexts 2>/dev/null
end

function __envsec_keys
    set -l ctx ""
    set -l args (commandline -opc)
    for i in (seq (count $args))
        if test "$args[$i]" = "-c"; or test "$args[$i]" = "--context"
            set -l next (math $i + 1)
            if test $next -le (count $args)
                set ctx $args[$next]
            end
        end
    end
    if test -z "$ctx"; and test -n "$ENVSEC_CONTEXT"
        set ctx $ENVSEC_CONTEXT
    end
    if test -n "$ctx"
        ${bin} __complete keys $ctx 2>/dev/null
    end
end

function __envsec_commands
    ${bin} __complete commands 2>/dev/null
end

function __envsec_needs_command
    set -l args (commandline -opc)
    for arg in $args[2..]
        switch $arg
            case add get delete del search list run env env-file load cmd audit share rename move copy 
                return 1
        end
    end
    return 0
end

function __envsec_using_command
    set -l cmd (commandline -opc)
    for arg in $cmd[2..]
        if test "$arg" = "$argv[1]"
            return 0
        end
    end
    return 1
end

function __envsec_cmd_needs_sub
    set -l args (commandline -opc)
    set -l found_cmd 0
    for arg in $args[2..]
        if test "$arg" = "cmd"
            set found_cmd 1
            continue
        end
        if test $found_cmd -eq 1
            switch $arg
                case run search list delete
                    return 1
            end
        end
    end
    return 0
end

function __envsec_cmd_using_sub
    set -l args (commandline -opc)
    set -l found_cmd 0
    for arg in $args[2..]
        if test "$arg" = "cmd"
            set found_cmd 1
            continue
        end
        if test $found_cmd -eq 1; and test "$arg" = "$argv[1]"
            return 0
        end
    end
    return 1
end

# Global options
complete -c envsec -l context -s c -x -a '(__envsec_contexts)' -d 'Context name'
complete -c envsec -l debug -s d -d 'Enable debug logging'
complete -c envsec -l json -d 'Output in JSON format'
complete -c envsec -l db -r -F -d 'Path to SQLite database'
complete -c envsec -l completions -x -a 'bash zsh fish' -d 'Generate completion script'
complete -c envsec -l help -s h -d 'Show help'
complete -c envsec -l version -d 'Show version'

# Subcommands
complete -c envsec -n __envsec_needs_command -a add -d 'Store a secret'
complete -c envsec -n __envsec_needs_command -a get -d 'Retrieve a secret'
complete -c envsec -n __envsec_needs_command -a delete -d 'Remove a secret'
complete -c envsec -n __envsec_needs_command -a del -d 'Remove a secret (alias)'
complete -c envsec -n __envsec_needs_command -a search -d 'Search contexts or secrets'
complete -c envsec -n __envsec_needs_command -a list -d 'List secrets or contexts'
complete -c envsec -n __envsec_needs_command -a run -d 'Execute command with secrets'
complete -c envsec -n __envsec_needs_command -a env -d 'Export secrets as env vars'
complete -c envsec -n __envsec_needs_command -a env-file -d 'Export secrets to .env file'
complete -c envsec -n __envsec_needs_command -a load -d 'Import from .env file'
complete -c envsec -n __envsec_needs_command -a cmd -d 'Saved command management'
complete -c envsec -n __envsec_needs_command -a audit -d 'Check expired secrets'
complete -c envsec -n __envsec_needs_command -a share -d 'GPG-encrypted export'
complete -c envsec -n __envsec_needs_command -a rename -d 'Rename a secret key'
complete -c envsec -n __envsec_needs_command -a move -d 'Move secrets between contexts'
complete -c envsec -n __envsec_needs_command -a copy -d 'Copy secrets between contexts'

# add
complete -c envsec -n '__envsec_using_command add' -x -a '(__envsec_keys)' -d 'Secret key'
complete -c envsec -n '__envsec_using_command add' -l value -s v -x -d 'Value to store'
complete -c envsec -n '__envsec_using_command add' -l expires -s e -x -d 'Expiry duration'

# get
complete -c envsec -n '__envsec_using_command get' -x -a '(__envsec_keys)' -d 'Secret key'
complete -c envsec -n '__envsec_using_command get' -l quiet -s q -d 'Print only the value'

# delete / del
complete -c envsec -n '__envsec_using_command delete' -x -a '(__envsec_keys)' -d 'Secret key'
complete -c envsec -n '__envsec_using_command delete' -l yes -s y -d 'Skip confirmation'
complete -c envsec -n '__envsec_using_command delete' -l all -d 'Delete all secrets'
complete -c envsec -n '__envsec_using_command del' -x -a '(__envsec_keys)' -d 'Secret key'
complete -c envsec -n '__envsec_using_command del' -l yes -s y -d 'Skip confirmation'
complete -c envsec -n '__envsec_using_command del' -l all -d 'Delete all secrets'

# run
complete -c envsec -n '__envsec_using_command run' -l save -s s -d 'Save command'
complete -c envsec -n '__envsec_using_command run' -l name -s n -x -d 'Command name'

# env
complete -c envsec -n '__envsec_using_command env' -l shell -s s -x -a 'bash zsh fish powershell' -d 'Target shell'
complete -c envsec -n '__envsec_using_command env' -l unset -s u -d 'Output unset commands'

# env-file
complete -c envsec -n '__envsec_using_command env-file' -l output -s o -r -F -d 'Output file'

# load
complete -c envsec -n '__envsec_using_command load' -r -F -d '.env file'

# audit
complete -c envsec -n '__envsec_using_command audit' -l within -s w -x -d 'Duration window'

# share
complete -c envsec -n '__envsec_using_command share' -l recipient -s r -x -d 'GPG recipient'

# rename
complete -c envsec -n '__envsec_using_command rename' -x -a '(__envsec_keys)' -d 'Secret key'
complete -c envsec -n '__envsec_using_command rename' -l force -s f -d 'Overwrite target if exists'

# move
complete -c envsec -n '__envsec_using_command move' -x -a '(__envsec_keys)' -d 'Secret key pattern'
complete -c envsec -n '__envsec_using_command move' -l to -s t -x -a '(__envsec_contexts)' -d 'Target context'
complete -c envsec -n '__envsec_using_command move' -l force -s f -d 'Overwrite existing secrets'
complete -c envsec -n '__envsec_using_command move' -l yes -s y -d 'Skip confirmation'
complete -c envsec -n '__envsec_using_command move' -l all -d 'Move all secrets'

# copy
complete -c envsec -n '__envsec_using_command copy' -x -a '(__envsec_keys)' -d 'Secret key pattern'
complete -c envsec -n '__envsec_using_command copy' -l to -s t -x -a '(__envsec_contexts)' -d 'Target context'
complete -c envsec -n '__envsec_using_command copy' -l force -s f -d 'Overwrite existing secrets'
complete -c envsec -n '__envsec_using_command copy' -l yes -s y -d 'Skip confirmation'
complete -c envsec -n '__envsec_using_command copy' -l all -d 'Copy all secrets'

# cmd subcommands
complete -c envsec -n '__envsec_using_command cmd; and __envsec_cmd_needs_sub' -a run -d 'Run a saved command'
complete -c envsec -n '__envsec_using_command cmd; and __envsec_cmd_needs_sub' -a search -d 'Search saved commands'
complete -c envsec -n '__envsec_using_command cmd; and __envsec_cmd_needs_sub' -a list -d 'List saved commands'
complete -c envsec -n '__envsec_using_command cmd; and __envsec_cmd_needs_sub' -a delete -d 'Delete a saved command'

# cmd run / cmd delete — complete with saved command names
complete -c envsec -n '__envsec_cmd_using_sub run' -x -a '(__envsec_commands)' -d 'Saved command'
complete -c envsec -n '__envsec_cmd_using_sub run' -l override-context -s o -x -a '(__envsec_contexts)' -d 'Override context'
complete -c envsec -n '__envsec_cmd_using_sub run' -l quiet -s q -d 'Suppress output'
complete -c envsec -n '__envsec_cmd_using_sub delete' -x -a '(__envsec_commands)' -d 'Saved command'

# cmd search
complete -c envsec -n '__envsec_cmd_using_sub search' -l name -s n -d 'Search names only'
complete -c envsec -n '__envsec_cmd_using_sub search' -l command -s m -d 'Search commands only'

# Duplicate all completions for esec alias
complete -c esec -l context -s c -x -a '(__envsec_contexts)' -d 'Context name'
complete -c esec -l debug -s d -d 'Enable debug logging'
complete -c esec -l json -d 'Output in JSON format'
complete -c esec -l db -r -F -d 'Path to SQLite database'
complete -c esec -l completions -x -a 'bash zsh fish' -d 'Generate completion script'
complete -c esec -l help -s h -d 'Show help'
complete -c esec -l version -d 'Show version'
complete -c esec -n __envsec_needs_command -a add -d 'Store a secret'
complete -c esec -n __envsec_needs_command -a get -d 'Retrieve a secret'
complete -c esec -n __envsec_needs_command -a delete -d 'Remove a secret'
complete -c esec -n __envsec_needs_command -a del -d 'Remove a secret (alias)'
complete -c esec -n __envsec_needs_command -a search -d 'Search contexts or secrets'
complete -c esec -n __envsec_needs_command -a list -d 'List secrets or contexts'
complete -c esec -n __envsec_needs_command -a run -d 'Execute command with secrets'
complete -c esec -n __envsec_needs_command -a env -d 'Export secrets as env vars'
complete -c esec -n __envsec_needs_command -a env-file -d 'Export secrets to .env file'
complete -c esec -n __envsec_needs_command -a load -d 'Import from .env file'
complete -c esec -n __envsec_needs_command -a cmd -d 'Saved command management'
complete -c esec -n __envsec_needs_command -a audit -d 'Check expired secrets'
complete -c esec -n __envsec_needs_command -a share -d 'GPG-encrypted export'
complete -c esec -n __envsec_needs_command -a rename -d 'Rename a secret key'
complete -c esec -n __envsec_needs_command -a move -d 'Move secrets between contexts'
complete -c esec -n __envsec_needs_command -a copy -d 'Copy secrets between contexts'
complete -c esec -n '__envsec_using_command add' -x -a '(__envsec_keys)' -d 'Secret key'
complete -c esec -n '__envsec_using_command add' -l value -s v -x -d 'Value to store'
complete -c esec -n '__envsec_using_command add' -l expires -s e -x -d 'Expiry duration'
complete -c esec -n '__envsec_using_command get' -x -a '(__envsec_keys)' -d 'Secret key'
complete -c esec -n '__envsec_using_command get' -l quiet -s q -d 'Print only the value'
complete -c esec -n '__envsec_using_command delete' -x -a '(__envsec_keys)' -d 'Secret key'
complete -c esec -n '__envsec_using_command delete' -l yes -s y -d 'Skip confirmation'
complete -c esec -n '__envsec_using_command delete' -l all -d 'Delete all secrets'
complete -c esec -n '__envsec_using_command del' -x -a '(__envsec_keys)' -d 'Secret key'
complete -c esec -n '__envsec_using_command del' -l yes -s y -d 'Skip confirmation'
complete -c esec -n '__envsec_using_command del' -l all -d 'Delete all secrets'
complete -c esec -n '__envsec_using_command run' -l save -s s -d 'Save command'
complete -c esec -n '__envsec_using_command run' -l name -s n -x -d 'Command name'
complete -c esec -n '__envsec_using_command env' -l shell -s s -x -a 'bash zsh fish powershell' -d 'Target shell'
complete -c esec -n '__envsec_using_command env' -l unset -s u -d 'Output unset commands'
complete -c esec -n '__envsec_using_command env-file' -l output -s o -r -F -d 'Output file'
complete -c esec -n '__envsec_using_command load' -r -F -d '.env file'
complete -c esec -n '__envsec_using_command audit' -l within -s w -x -d 'Duration window'
complete -c esec -n '__envsec_using_command share' -l recipient -s r -x -d 'GPG recipient'
complete -c esec -n '__envsec_using_command rename' -x -a '(__envsec_keys)' -d 'Secret key'
complete -c esec -n '__envsec_using_command rename' -l force -s f -d 'Overwrite target if exists'
complete -c esec -n '__envsec_using_command move' -x -a '(__envsec_keys)' -d 'Secret key pattern'
complete -c esec -n '__envsec_using_command move' -l to -s t -x -a '(__envsec_contexts)' -d 'Target context'
complete -c esec -n '__envsec_using_command move' -l force -s f -d 'Overwrite existing secrets'
complete -c esec -n '__envsec_using_command move' -l yes -s y -d 'Skip confirmation'
complete -c esec -n '__envsec_using_command move' -l all -d 'Move all secrets'
complete -c esec -n '__envsec_using_command copy' -x -a '(__envsec_keys)' -d 'Secret key pattern'
complete -c esec -n '__envsec_using_command copy' -l to -s t -x -a '(__envsec_contexts)' -d 'Target context'
complete -c esec -n '__envsec_using_command copy' -l force -s f -d 'Overwrite existing secrets'
complete -c esec -n '__envsec_using_command copy' -l yes -s y -d 'Skip confirmation'
complete -c esec -n '__envsec_using_command copy' -l all -d 'Copy all secrets'
complete -c esec -n '__envsec_using_command cmd; and __envsec_cmd_needs_sub' -a run -d 'Run a saved command'
complete -c esec -n '__envsec_using_command cmd; and __envsec_cmd_needs_sub' -a search -d 'Search saved commands'
complete -c esec -n '__envsec_using_command cmd; and __envsec_cmd_needs_sub' -a list -d 'List saved commands'
complete -c esec -n '__envsec_using_command cmd; and __envsec_cmd_needs_sub' -a delete -d 'Delete a saved command'
complete -c esec -n '__envsec_cmd_using_sub run' -x -a '(__envsec_commands)' -d 'Saved command'
complete -c esec -n '__envsec_cmd_using_sub run' -l override-context -s o -x -a '(__envsec_contexts)' -d 'Override context'
complete -c esec -n '__envsec_cmd_using_sub run' -l quiet -s q -d 'Suppress output'
complete -c esec -n '__envsec_cmd_using_sub delete' -x -a '(__envsec_commands)' -d 'Saved command'
complete -c esec -n '__envsec_cmd_using_sub search' -l name -s n -d 'Search names only'
complete -c esec -n '__envsec_cmd_using_sub search' -l command -s m -d 'Search commands only'
`.trimStart();
