# FileSync Changes

* 2019-10-24 (**Version 4.3.0**)
 * New features/support to help with downloading the **entire** (!) instance setup
   * added new search option templates and helpful notes for day-2-day search/resync workflows
   * added more system type tables like choice, props, dictionary etc. to extract more config
   * allow searching without the sys_class_name restriction to include all records from child tables or when that table doesn't have the field
     * Provide `"noClassName": true` in folder config per desired folder
     * See also the readme section for "Folder definitions"
 * Support for mass API calls to an instance to avoid HTTP 427 responses (better `--resync` support)


* 2017-03-26 (**Version 4.2.4**)
 * Add debug option via the command line additional to config setting. (`--debug`)
 * Fix export not using subdir format
 * Add support for more tables (service portal related)
   * NOTE: Some folders like widgets are now sp_widgets (to group SP together). Ensure you rename both records/widgets and records/.sync_data/widgets to be "sp_widgets" OR define your own "folders" mapping in your config.json
 * Add more debugging for problematic folder/sync configs and failed downloads
 * Fix readme/documentation issues

* 2016-12-22 (**Version 4.2.3**)
 * Improved support for searching and downloading records.
   * Eg. `node bin/app.js --config config.json --search <URL>`

* 2016-11-01 (**Version 4.2.2**)
 * Add new search feature allowing easier downloading of single records
   * Eg. `node bin/app.js --config config.json --search sys_script_2600fd0047202200ff95502b9f9a712a`
 * Major search refactors
 * Add new folder mappings

* 2016-07-30 (**Version 4.2.1**)
 * Refactor community fix to reduce duplicate checks. Ensures only valid responses and records are processed in search

* 2016-07-17 (**Version 4.2.0**)
 * Massive README updates
 * Add pull and push command line option support to allow integration with third party build tools (see README for more details)
   * Eg. `node bin/app.js --config config.json --pull "ui_pages/attachment.xhtml"`
   * Eg. `node bin/app.js --config config.json --push "ui_pages/attachment.xhtml"`
 * Allow subDirPattern to use display values instead of sys_ids
 * Add search support to download the whole record (for reference only) and optionally ignore individual field files
   * Eg. `node bin/app.js --config config.json --search stories --record_only`
   * Eg. `node bin/app.js --config config.json --search team --full_record`

* 2016-07-16 (**Version 4.1.3**)
 * Fix issue where multiple suffixes might get confused depending on order in folder config (fixes #30)

* 2016-06-26 (**Version 4.1.2**)
 * Add support for proxies (fixes #19)

* 2016-04-03 (**Version 4.1.1**)
 * Fix search issue: Records with multiple mapped scripts/css/xml fields do not download to multiple files when using search (fixes #25)

* 2016-03-21 (**Version 4.1.0**)
 * Add support for saving record attributes in the folder path using the new `subDirPattern` folder attribute
   * Also allows creating arbitrary folder heirarchies however you like! eg `business_rules/most used/SomeClass.js`


* 2016-03-18 (**Version 4.0.2**)
 * Drop support for `acceptBadSSL` flag (no longer needed)
 * Fix old module being included
 * Fix jshint issues

* 2016-03-17 (**Version 4.0.1**)
 * Replace restify with restler (which handles connection stuff) so that a compiler is no longer needed (fixes #22)


* 2016-03-05 (**Version 4.0.0** :mushroom:)
 * Refactor to match up with NPM and node project standards and remove binaries
   * `npm install` now required to populate the `node_modules/` dependencies
   * Special thanks @karimhernandez + @Echo3ToEcho7 for support and pull requests
   * **UPGRADE NOTICE**: ensure npm >= v3.6.0 and node >= v5.6.0 before installing modules and running via `node bin/app.js`
 * Readme updates


* 2016-01-10 (**Version 3.0.5**)
 * Search now replaces characters that would be invalid for file names so that such records can be saved (fixes #18)
 * Fix search issue where duplicate record names for a table where not being saved. Can now save the sys_id in the file name via new config option: `ensureUniqueNames` (fixes #17)
 * Readme updates

* 2016-01-09 (**Version 3.0.4**)
 * Allow saving the sys_id and other meta data about a record (fixes #5). All communications with a record will now use the sys_id except the first which uses the defined property in the config folders list
 * Tables that are extended no longer save files from their descendants (fixes #20)

* 2015-12-19 (**Version 3.0.3**)
 * Fix search issue where sync data records were not being saved on slow machines (File I/O racing is bad)
 * Fix missing callback crash (fixes #14)

* 2015-11-23 (**Version 3.0.2**)
 * Support custom "ignoreFile" config option for file watcher (thanks to @dwightgunning)


* 2015-11-16 (**Version 3.0.1**)
 * Fix issue with search where 0 byte files (no proper record data) were causing issues


* 2015-11-06 (**Version 3.0** :mushroom:)
 * Fully enable search because I love being productive! (more details in readme)


* 2015-10-14 (**Version 2.4.10**)
 * Fix rare race condition with File I/O processes that sometimes caused changed files to be overwritten instead of uploaded

* 2015-10-14 (**Version 2.4.9**)
 * Fix osx-notifier issue where record names starting with symbols crashed the notification app on mac (fixes #9)
   * If your record is like "(Keyfile)" then the notifcation will show "_(Keyfile)".

* 2015-10-13 (**Version 2.4.8**)
 * Fix password encoding issue occuring when not specifying a config path (fixes #10)

* 2015-10-09 (**Version 2.4.7**)
 * Fix windows path issues and add upgrade warning
    * **UPGRADE NOTICE**: config files on all systems should now use *nix style paths. This means `"m:\\Desktop\\records"` is now invalid and should be replaced with `"m:/Dekstop/records"`

* 2015-09-01 (**Version 2.4.6**)
 * Added more default folder configs
 * Cleaned up readme
 * Prepared for search and search based auto-download support
 * Added support for flaky SSL setups (self-signed certificates etc.)
   * see `acceptBadSSL` usage in README

* 2015-08-23 (**Version 2.4.5**)
 * Fixed notification parameter bug causing issues for certain notifications

* 2015-08-23 (**Version 2.4.4**)
 * Added option to click notifications which then loads the record in the browser
 * Fixed minor issue where exporting current setup included default folder definitions (which are not needed)

* 2015-08-12 (**Version 2.4.3**)
 * Fixed bug for first run where the file watcher was not being started if preLoad or createAllFolders was true

* 2015-07-19 (**Version 2.4.2**)
 * Updated README and added video to demo FileSync in action

* 2015-05-20 (**Version 2.4.1**)
 * FIX issue where the `--config` option with a relative path did not work

* 2015-05-17 (**Version 2.4.0**)
 * Make README more logical and easier to follow (inc. TOC)
 * Support exporting the current list of downloaded records for quickstart and backup
   * Command Line Usage `/node-darwin src/app --export your-new-file.config.json`

* 2015-05-09 (**Version 2.3.0**)
 * Improved logging (timestamps and proper info/warn/error usage via winston)
 * Refactor, improve documentation and complete test support (testSyncConflict function)
 * Add support for [SASS CSS pre-comiler](http://sass-lang.com/) based development

* 2015-05-06 (**Version 2.2.4**)
 * FIX issue where config files existing on a custom path could not be updated for first-run scenarios.

* 2015-05-01 (**Version 2.2.3**)
 * FIX issue where incorrect file names created by user caused an endless record lookup loop

* 2015-04-13 (**Version 2.2.0**)
 * Isolate file and record based functions in own Class
 * Add tests for downloading and updating records
 * Simplify function calling and add more call backs (to support testing)


* 2015-04-13 (**Version 2.1.0**)
 * Rewrite pre-loading and re-syncing of files.
 * Clean up watching files system to be enabled and disabled at the right times and avoid file writes triggering watch changes

* 2015-04-06 (**Version 2.0.0 !**)
 * Add preLoad option to download files defined per root in "preLoad" object
 * Re-write documentation for app.config.json due to massive simplification and first-run setup
 * Fix redundant requests to instance for syncing
 * Add automatic folder creation option
   * Set ```createAllFolders: true``` in app.config.json

* 2015-04-04
 * Make folder definitions standard across all projects but allow users to override the defaults or extend them.
   * Set ```"ignoreDefaultFolders": true,``` if desired and specify own ```"folders": {...}``` for a custom setup

* 2015-04-03 (**major changes!** :mushroom:)
 * Allow specifying the location of the config file:
   * ```./node-darwin app/src --config=/computer/somefile.json```
 * Cleanup formatting
 * Add help option:
   * ```./node-darwin app/src --help```
 * Save sync data in JSON format so that we can make more use of it
   * WARNING: existing users will need to remove their current .sync dir and resync. When starting the app a warning will be output on the command line explaining what to do...
     * ```./node-darwin app/src --resync```
     * ```rm - Rf .sync``` (per site root dir)

* 2015-03-26
 * Upgraded node_modules (```npm update```) to latest version other than restify (which was throwing too many errors on current and future node versions node@0.10.37 and node@0.12.0 with restify@3.0.1. restify@2.6.0 is stable)
 * Add more connection error support

* 2015-03-23
 * Add basic test support to ensure setup is upgrade safe:
   * ```./node-darwin app/src --test```
 * Add jshint for cleaner scripting
 * Add module to parse command line args easily

* 2015-03-18
 * Fixed some trivial stuff regarding connection handling

* 2015-03-16
 * Added conflict management! Now it's impossible to overwrite server records that would result in data loss!

* 2015-03-14
 * Update readme and add road map. Encourage contribution!
 * Refactored code setup and allow config file to be outside of repo
 * Enable non 'https' instance connections
 * Added notification support (OS X)

* 2015-03-10
 * Added support for Eureka+ versions
 * Initial clone and file re-structure
