rem(){ :;};rem '
@goto windows

';echo "Table name: "
read table
echo "Entity name: "
read name;
node bin/app.js --config $1.config.json --search --search_query "name=$name" --search_table "$table" --download;
exit

:windows
@echo off
set /P table="Table name: "
set /P name="Entity name: "
node bin/app.js --config %1.config.json --search --search_query "name=%name%" --search_table "%table%" --download