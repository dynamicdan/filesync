# Start Sync
```
node process.env.npm_package_config_snfs /bin/app.js --config c:/DEV/github/sn-filesync/rttmsdev.config.json
node c:/DEV/github/sn-filesync/bin/app.js --config c:/DEV/github/sn-filesync/rttmsdev.config.json
node c:/DEV/github/sn-filesync/bin/app.js --config c:/DEV/github/sn-filesync/riotintodev.config.json
```



# Portal download
```
node c:/DEV/github/sn-filesync/bin/app.js --config c:/DEV/github/sn-filesync/rttmsdev.config.json --search portal-pages
node c:/DEV/github/sn-filesync/bin/app.js --config c:/DEV/github/sn-filesync/rttmsdev.config.json --search portal-scripts
node c:/DEV/github/sn-filesync/bin/app.js --config c:/DEV/github/sn-filesync/rttmsdev.config.json --search portal-macro
node c:/DEV/github/sn-filesync/bin/app.js --config c:/DEV/github/sn-filesync/rttmsdev.config.json --search portal-content
node c:/DEV/github/sn-filesync/bin/app.js --config c:/DEV/github/sn-filesync/rttmsdev.config.json --search portal-css

```



# Start Sync with RESYNC - NOTE: blows away local changes
```
node c:/DEV/github/sn-filesync/bin/app.js --config c:/DEV/github/sn-filesync/rttmsdev.config.json --resync
```



# Search for a file
```
node c:/DEV/github/sn-filesync/bin/app.js --config c:/DEV/github/sn-filesync/rttmsdev.config.json --search --search_query "name=render_gadget_performance_controls" --search_table "sys_ui_page"
node c:/DEV/github/sn-filesync/bin/app.js --config c:/DEV/github/sn-filesync/riotintodev.config.json --search --search_query "name=helpQnA" --search_table "sys_ui_page"
```



# Portal files

## sys_ui_page
portal.*
## sys_ui_script
portal.*
## sys_ui_macro
portal.*
## content_block_programmatic
rttms-v2-home
## content_css
portal.*