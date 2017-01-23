@echo off
set /P table="Table name: "
set /P name="Name: "
node bin/app.js --config %1.config.json --search --search_query "name=%name%" --search_table "%table%" --download