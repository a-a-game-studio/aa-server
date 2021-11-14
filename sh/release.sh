#!/usr/bin/bash

if [ ! $1 ]; then
    echo "Error: you should pass version number"
else
    echo "[@a-a-game-studio/aa-core]: creating version"
    npm version $1

    echo "[@a-a-game-studio/aa-core]: pushing updates"
    git push

    echo "[@a-a-game-studio/aa-core]: publish updates"
    npm publish --access public --registry https://registry.npmjs.org
fi