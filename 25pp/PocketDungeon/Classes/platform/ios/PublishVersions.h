//
//  PublishVersions.h
//  PocketDungeon
//
//  Created by 马 颂文 on 14-1-17.
//
//

#ifndef __PocketDungeon__PublishVersions__
#define __PocketDungeon__PublishVersions__

#define UMENG_APPKEY    (@"520af08956240bffb903b5f5")
#define CHANNEL_ID_CSTR "PP25"
#define CHANNEL_ID      (@CHANNEL_ID_CSTR)
#define PP25_APPID      (2739)
#define PP25_APPKEY     (@"01aee5718a33bcbbe790bc0ca7cfb7ee")
#define TDGA_APPKEY     ("25DEA3B267F80E2AA9BDA3F4D9F23A88")

void preInitAPI();
void postInitAPI();
void onPauseApp();
void onResumeApp();

#endif /* defined(__PocketDungeon__PublishVersions__) */