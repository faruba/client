//
//  KuaiyongUAC.cpp
//  PocketDungeon
//
//  Created by 马 颂文 on 14-1-17.
//
//

#include "KuaiyongUAC.h"
#include "PublishVersions.h"
#include "cocos2d.h"

#define PP25FILE ("PP25Pay.plist")

using namespace cocos2d;
using namespace std;

static NSMutableArray* gPurchaseList = nil;

void initKuaiyong()
{
    NSLog(@"initKuaiyong");
    [KYSDK instance];
}

void KuaiyongUAC::initUAC()
{
    NSLog(@"initUAC");
    [[KYSDK instance] setSdkdelegate:[KuaiyongDelegate sharedInstance]];
    [[KYSDK instance] changeLogOption:KYLOG_OFFGAMENAME];
    getUACDelegate()->onUACReady();
    [[KuaiyongDelegate sharedInstance] setUACDelegate:this->getUACDelegate()];
}

void KuaiyongUAC::presentLoginView()
{
    NSLog(@"presentLoginView");
    [[KYSDK instance] showUserView];
}

void KuaiyongUAC::presentManageView()
{
    NSLog(@"presentManageView");
    [[KYSDK instance] showUserView];
}

void KuaiyongUAC::logout()
{
    NSLog(@"logout");
    [[KYSDK instance] userLogOut];
}

void KuaiyongUAC::getUserName(std::string &name)
{
    name = "unknown";
}

void KuaiyongUAC::getUserId(std::string &token)
{
    token = "unknown";
}

void KuaiyongUAC::initPayment()
{
    //load products
    @autoreleasepool {
        string fullpath = CCFileUtils::sharedFileUtils()->fullPathForFilename(PP25FILE);
        NSString* strPath = [NSString stringWithCString:fullpath.c_str() encoding:NSUTF8StringEncoding];
        mProducts = [NSArray arrayWithContentsOfFile:strPath];
        [mProducts retain];
        if( gPurchaseList != nil ){
            [gPurchaseList release];
        }
        gPurchaseList = [NSMutableArray array];
        [gPurchaseList retain];
    }
    [[KuaiyongDelegate sharedInstance] setIAPDelegate:this->getIAPDelegate()];
}

bool KuaiyongUAC::isPaymentEnabled()
{
    return true;
}

void KuaiyongUAC::makePayment(string billno, int product, uint32_t quantity, string username, int zoneId)
{
    //find product
    @autoreleasepool {
        NSDictionary* detail = [mProducts objectAtIndex:product];
        if( detail != nil ){
            NSString* strBillNo = [NSString stringWithUTF8String:billno.c_str()];
            NSString* strUserName = [NSString stringWithUTF8String:username.c_str()];
            NSString* strTitle = [detail objectForKey:@"title"];
            NSNumber* numPrice = [detail objectForKey:@"price"];
            int cost = [numPrice intValue]*quantity;
            
            //record purchase
            NSMutableDictionary* payment = [NSMutableDictionary dictionary];
            [payment setObject:strBillNo forKey:@"BillNo"];
            [payment setObject:[NSNumber numberWithInt:product] forKey:@"Product"];
            [payment setObject:[NSNumber numberWithInt:quantity] forKey:@"Quantity"];
            [payment setObject:strUserName forKey:@"UserName"];
            [payment setObject:[NSNumber numberWithInt:zoneId] forKey:@"ZoneId"];
            [gPurchaseList addObject:payment];
            
            NSLog(@"*** MAKEPAYMENT\nCOST=%d\nBILLNO=%@\nTITLE=%@\nROLE=%@\nZONE=%d\nFEE=%@\n\n",
                  cost, strBillNo, strTitle, strUserName, zoneId, [numPrice stringValue]);
            [[KYSDK instance] showPayWith:strBillNo fee:[numPrice stringValue] game:@"4032" gamesvr:@"" subject:strTitle md5Key:@"yh3SljbeMwGzu0w0wF10TYJ30r49XOxv" userId:nil];
            
        }
        else{
            NSLog(@"KuaiyongUAC.makePayment: product(%d) not found.", product);
        }
    }
}

void KuaiyongUAC::getStoreName(std::string &name)
{
    name = "Kuaiyong";
}

static KuaiyongDelegate* gKuaiyongDelegate = nil;

@implementation KuaiyongDelegate

- (id)init{
    if( self = [super init] )
    {
        mpUACD = NULL;
        mpIAPD = NULL;
    }
    return self;
}

+ (KuaiyongDelegate*) sharedInstance{
    if( gKuaiyongDelegate == nil ){
        gKuaiyongDelegate = [[KuaiyongDelegate alloc] init];
    }
    return gKuaiyongDelegate;
}

- (void)setUACDelegate:(UACDelegate *)pInstance{
    //NSLog(@"setUACDelegate = %p", pInstance);
    mpUACD = pInstance;
}

- (void)setIAPDelegate:(IAPDelegate *)pInstance{
    mpIAPD = pInstance;
}

- (void)userLoginWithserviceTokenKey:(NSString*)tokenKey{
    mpUACD->onLoggedIn(string([tokenKey cStringUsingEncoding:NSUTF8StringEncoding]));
}

- (void)quickGameWithserviceTokenKey:(NSString*)tokenKey{
    mpUACD->onLoggedIn(string([tokenKey cStringUsingEncoding:NSUTF8StringEncoding]));
}

- (void)gameLogBack:(NSString *)username passWord:(NSString *)password{
    NSLog(@"*** gameLogBack");
}

- (void)userLoginOut:(NSString*)guid{
    mpUACD->onLoggedOut();
}

-(void)returnKeyDidClick{
    NSLog(@"*** returnKeyDidClick");
}

-(void)singleLogin{
    NSLog(@"*** singleLogin");
}

////快捷支付 验证
- (void)checkResult:(CHECK)result{
    NSLog(@"*** checkResult(%d)", result);
}
//用户行为
-(void)userBehavior:(UNIPAYTYPE)kind{
    NSLog(@"*** userBehavior(%d)", kind);
}

//查看订单返回结果
/**
 result: code为0时，成功 其他失败
 deal：订单信息 orderid：sdk内部订单信息 dealSeq：游戏订单信息 dealSeq
 payresult = 0支付成功，1支付失败
 **/
-(void)backCheckDel:(NSMutableDictionary *)map{
    NSLog(@"--- backCheckDel ---");
    for(id key in map) NSLog(@"key=%@ value=%@", key, [map objectForKey:key]);
    
    NSNumber* result = [map objectForKey:@"result"];
    NSNumber* payresult = [map objectForKey:@"payresult"];
    NSDictionary* payment = [gPurchaseList lastObject];
    if( payment != nil ){
        PaymentResult pr;
        if( result == 0
           && payresult == 0 ){
            pr = Payment_Success;
        }
        else{
            pr = Payment_Failed;
        }
        NSNumber* numProduct = [payment objectForKey:@"Product"];
        NSString* strBillNo = [payment objectForKey:@"BillNo"];
        //NSLog(@"\n\n** RES=%d\n PRD=%@\n BILL=%@\n", pr, numProduct, strBillNo);
        mpIAPD->onPaymentResult(pr, [numProduct intValue], string([strBillNo cStringUsingEncoding:NSUTF8StringEncoding]));
        [gPurchaseList removeLastObject];
    }
    else{
        NSLog(@"*** payment not found");
    }
}

@end