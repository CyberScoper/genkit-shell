#!/bin/bash

BASHRC="$HOME/.bashrc"
AUTOSTART="if [[ \$- == *i* ]]; then /usr/bin/genkit-shell; exit; fi"

if grep -Fxq "$AUTOSTART" "$BASHRC"; then
  echo "✅ Автозапуск уже добавлен."
else
  echo -e "\n# genkit-shell автозапуск\n$AUTOSTART" >> "$BASHRC"
  echo "✅ Автозапуск успешно добавлен."
fi
