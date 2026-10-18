#!/bin/sh
# Compila a janela de ajustes (macOS 26) num PainelDeUso.app universal (Apple Silicon e Intel).
# Precisa das Command Line Tools do Xcode com o SDK do macOS 26: xcode-select --install
#
#   ./build.sh                   compila; o PainelDeUso.sha256 fica como está, para conferir
#   ./build.sh --atualizar-hash  compila e grava o hash novo (só quem mantém o projeto)
set -eu
cd "$(dirname "$0")"
APP=PainelDeUso.app
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
for arq in arm64 x86_64; do
  swiftc -O -parse-as-library -target "$arq-apple-macos26.0" Sources/PainelDeUso.swift -o "$TMP/PainelDeUso-$arq"
done
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
lipo -create "$TMP/PainelDeUso-arm64" "$TMP/PainelDeUso-x86_64" -output "$APP/Contents/MacOS/PainelDeUso"
cp Info.plist "$APP/Contents/Info.plist"
codesign --force --sign - "$APP"
echo "ok: $APP"
# Impressão digital do executável. Só é regravada a pedido: assim a conferência compara o que você
# compilou com o hash publicado, e não com ele mesmo.
if [ "${1:-}" = "--atualizar-hash" ]; then
  shasum -a 256 "$APP/Contents/MacOS/PainelDeUso" | sed 's#  .*#  PainelDeUso.app/Contents/MacOS/PainelDeUso#' > PainelDeUso.sha256
  echo "hash gravado em PainelDeUso.sha256"
fi
shasum -a 256 -c PainelDeUso.sha256
