#!/bin/bash
#所有渠道自动打包工具

#global arguments
WORK_PATH=`dirname $0`
DATE_TIME=`date +"%Y%m%d"`
BINARY_VERSION=""
RESOURCE_VERSION=""
PACK_FOLDER="tools/pack/"
PACK_APP_DST="../tools/pack/Payload/"

#build arguments
BUILD_FOLDER="develop"
APP_NAME="测试版.app"
PACKAGE_NAME="内网测试版.ipa"

#build action
function build {
	echo "* building ["$BUILD_FOLDER"]"
	cd $WORK_PATH
	cd $BUILD_FOLDER
	#set versions
	sed -ie s/\"binary_version\".*,/\"binary_version\"\ :\ \"${BINARY_VERSION}\",/ ./PocketDungeon/static.json
	sed -ie s/\"resource_version\".*,/\"resource_version\"\ :\ ${RESOURCE_VERSION},/ ./PocketDungeon/static.json
	SUBCMD="s/<string>[0-9]*\.[0-9]*\.[0-9]*<\/string>/<string>"${BINARY_VERSION}"<\/string>/g"
	sed -ie $SUBCMD ./PocketDungeon/ios/Info.plist

	#build
	xcodebuild -configuration Release
	#copy
	rm -rf $PACK_APP_DST*
	cp -R -f build/Release-iphoneos/$APP_NAME $PACK_APP_DST
	cd $WORK_PATH
	cd $PACK_FOLDER
	#pack
	zip -r -q $PACKAGE_NAME iTunesArtwork iTunesMetadata Payload
	#move
	mv $PACKAGE_NAME ../../release/$PACKAGE_NAME
}

#init
cd $WORK_PATH
rm -rf release/*
cd $BUILD_FOLDER/PocketDungeon
BINARY_VERSION=`grep binary_version static.json | awk -F'"' '{print $4}'`
RESOURCE_VERSION=`grep resource_version static.json | awk -F'"| |,' '{print $9}'`
echo "BINARY_VERSION = "$BINARY_VERSION
echo "RESOURCE_VERSION = "$RESOURCE_VERSION

#build list
BUILD_FOLDER="develop"
APP_NAME="测试版.app"
PACKAGE_NAME="内网测试版.ipa"
build

BUILD_FOLDER="25pp"
APP_NAME="口袋地下城.app"
PACKAGE_NAME="口袋地下城(PP助手).ALL.ipa"
build

BUILD_FOLDER="app111"
APP_NAME="口袋地下城.app"
PACKAGE_NAME="口袋地下城(苹果园).ALL.ipa"
build

BUILD_FOLDER="AppStore"
APP_NAME="口袋地下城.app"
PACKAGE_NAME="口袋地下城.ipa"
build

BUILD_FOLDER="kuaiyong"
APP_NAME="口袋地下城.app"
PACKAGE_NAME="口袋地下城(快用).ipa"
build

BUILD_FOLDER="nd91"
APP_NAME="PocketDungeon.app"
PACKAGE_NAME="PocketDungeon_v${BINARY_VERSION}_${DATE_TIME}.ipa"
build

#debug
read -p "Press [Enter] key to continue..."