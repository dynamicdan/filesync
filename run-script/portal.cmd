rem(){ :;};rem '
@goto windows

';node bin/app.js --config $1.config.json --search portal-pages
node bin/app.js --config $1.config.json --search portal-pages
node bin/app.js --config $1.config.json --search portal-scripts
node bin/app.js --config $1.config.json --search portal-macro
node bin/app.js --config $1.config.json --search portal-content
node bin/app.js --config $1.config.json --search portal-css
exit

:windows
@echo off
node bin/app.js --config %1.config.json --search portal-pages
node bin/app.js --config %1.config.json --search portal-pages
node bin/app.js --config %1.config.json --search portal-scripts
node bin/app.js --config %1.config.json --search portal-macro
node bin/app.js --config %1.config.json --search portal-content
node bin/app.js --config %1.config.json --search portal-css