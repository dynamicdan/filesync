rem(){ :;};rem '
@goto windows

';if [ -d "src" ]
then
else
    mkdir src
    mkdir src/rttmsdev
    mkdir src/riotintodev
fi;
exit

:windows
@echo off
IF NOT EXIST src (
    mkdir src
    mkdir src\rttmsdev
    mkdir src\riotintodev
)