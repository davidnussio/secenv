

for env_file in (find . \( -name "node_modules" -o -name "dist" -o -name "build" -o -name ".next" \) -prune -o \( -name ".env" -o -name ".env.*" \) ! -name ".env.example" -print);  set -l var (string split "/" $env_file); echo "Import ($var[2]): $env_file"; envsec -c $var[2] load--i $env_file; end
