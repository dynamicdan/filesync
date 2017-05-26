# filesync README

## Installation
Installation steps:
1.	Open command palette.
2.	Type vsix, selecting “Extension: Install from VSIX….”.
3.	Open the filesync-0.0.1.vsix.
4.	Click reload on the information box that pops open.
5.	Look at attached readme.md too.


## Features

This extension makes it easier for us to run the SNC-Filesync node tool.

**If you are wondering more about the commands, refer to the SNC-filesync README.md**

## Requirements

Nil

## Extension Settings

**NOTE: The following is done after running npm install in the snc-filesync folder.

Usage:
1. cmd + shft + p (Opens the command palette).
2. type RTTMS
3. Four options will come up RTTMS search, RTTMS sync, RTTMS setup, RTTMS watch.

**FIRST TIME RUNNING SNC-FILESYNC**
* RTTMS setup - Creates the necessary directories and sets your username/password in the config files:
    1. Type your user name in (i.e corp\bob.smith).
    2. Type your password in (Yes.. plain text.. not my fault..).

* RTTMS search - Pulls the specified file down from dev or patch:
    1. Select the environment you want to get the file from.
    2. Select the type of file.
    3. Type the full file name in (case INsensitive) pressing enter when complete.
    4. Check the TERMINAL that the file downloaded fine.
    5. Navigate to the file (NOTE: If the file isn't there, click the refresh symbol next to the folder name in the explorer. VSCode doesn't always automatically refresh this very well).

* RTTMS watch - Watches for changes that you have done to the files, on save it pushes them to the environment:
    1. Select the environment you want to compare and push files to.

* RTTMS sync - Runs the resync and then watches your files:
    1. Select the environemnt you want to resync your files too.

## Known Issues

* It's perfect.

## Release Notes

