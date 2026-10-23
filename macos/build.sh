#!/bin/sh
# Compila a janela de ajustes (macOS 26) num PainelDeUso.app universal (Apple Silicon e Intel).
# Precisa das Command Line Tools do Xcode: xcode-select --install. O hash publicado vem do Swift 6.4;
# outra versão do compilador gera outro binário, e a conferência falha sem que nada esteja errado.
#
#   ./build.sh                   compila numa pasta temporária e confere com o PainelDeUso.sha256;
#                                o PainelDeUso.app publicado fica como está
#   ./build.sh --atualizar-hash  compila, troca o PainelDeUso.app e grava o hash novo (só quem mantém)
set -eu
cd "$(dirname "$0")"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
APP="$TMP/PainelDeUso.app"
for arq in arm64 x86_64; do
  swiftc -O -parse-as-library -target "$arq-apple-macos26.0" Sources/PainelDeUso.swift -o "$TMP/PainelDeUso-$arq"
done
mkdir -p "$APP/Contents/MacOS"
lipo -create "$TMP/PainelDeUso-arm64" "$TMP/PainelDeUso-x86_64" -output "$APP/Contents/MacOS/PainelDeUso"
cp Info.plist "$APP/Contents/Info.plist"
codesign --force --sign - "$APP"
echo "ok: compilado"
# Impressão digital do executável. Só é regravada a pedido: assim a conferência compara o que você
# compilou com o hash publicado, e não com ele mesmo.
hash=$(shasum -a 256 "$APP/Contents/MacOS/PainelDeUso" | cut -d' ' -f1)
if [ "${1:-}" = "--atualizar-hash" ]; then
  rm -rf PainelDeUso.app
  cp -R "$APP" PainelDeUso.app
  echo "$hash  PainelDeUso.app/Contents/MacOS/PainelDeUso" > PainelDeUso.sha256
  echo "PainelDeUso.app e hash gravados em PainelDeUso.sha256"
fi
if [ "$hash" = "$(cut -d' ' -f1 PainelDeUso.sha256)" ]; then
  echo "PainelDeUso.app/Contents/MacOS/PainelDeUso: OK"
else
  echo "PainelDeUso.app/Contents/MacOS/PainelDeUso: FAILED (compilado: $hash)"
  exit 1
fi
