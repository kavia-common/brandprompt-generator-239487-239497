#!/bin/bash
cd /home/kavia/workspace/code-generation/brandprompt-generator-239487-239497/prompt_extension_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

