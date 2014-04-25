//
//  PP25UAC.h
//  PocketDungeon
//
//  Created by 马 颂文 on 14-1-17.
//
//

#ifndef __PocketDungeon__PP25UAC__
#define __PocketDungeon__PP25UAC__

#include "IUAC.h"
#include "IIAP.h"
#import <PPAppPlatformKit/PPAppPlatformKit.h>

class PP25UAC : public IUAC, public IIAP
{
public:
    //--- UAC ---
    void initUAC();
    void presentLoginView();
    void presentManageView();
    void logout();
    
    void getUserName(std::string &name);
    void getUserId(std::string &token);
    
    //--- IAP ---
    void initPayment();
    bool isPaymentEnabled();
    void makePayment(std::string billno, int product, uint32_t quantity, std::string username, int zoneId);
    void getStoreName(std::string &name);

private:
    NSArray* mProducts;
};

@interface PPDelegate : NSObject<PPAppPlatformKitDelegate>{
    UACDelegate* mpUACD;
    IAPDelegate* mpIAPD;
}

+ (PPDelegate*) sharedInstance;

- (void) setUACDelegate:(UACDelegate*)pInstance;

- (void) setIAPDelegate:(IAPDelegate*)pInstance;

@end

#endif /* defined(__PocketDungeon__PP25UAC__) */