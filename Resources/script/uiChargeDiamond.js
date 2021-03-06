/**
 * User: hammer
 * Date: 13-9-26
 * Time: 下午1:59
 */

var ui = loadModule("UIComposer.js");
var uikit = loadModule("uiKit.js");
var libTable = loadModule("table.js");

var theAlert = null;
var theLayer = null;
var theLoad = null;

var MODE_NORMAL = 0;
var MODE_EXIT = 1;
var theMode;

var closeCBFUNC;
var closeCBOBJ;

var payStr = [
    {str:translate(engine.game.language, "uiChargeDiamond6"), cost:6, dm:60 },
    {str:translate(engine.game.language, "uiChargeDiamond12"), cost:12, dm:130 },
    {str:translate(engine.game.language, "uiChargeDiamond30"), cost:30, dm:330 },
    {str:translate(engine.game.language, "uiChargeDiamond68"), cost:68, dm:760 },
    {str:translate(engine.game.language, "uiChargeDiamond128"), cost:128, dm:1460 },
    {str:translate(engine.game.language, "uiChargeDiamond198"), cost:198, dm:2260 },
    {str:translate(engine.game.language, "uiChargeDiamond328"), cost:328, dm:3760 },
    {str:translate(engine.game.language, "uiChargeDiamond648"), cost:648, dm:7480 },
    {str:translate(engine.game.language, "uiChargeDiamond25"), cost:25, dm:2500 }
];

var COLOR_UID_YELLOW = cc.c3b(252, 230, 38);
var COLOR_UID_RED = cc.c3b(233, 24, 24);

var theLastBillNo = null;

function fixNumber(num, len){
    var str = ""+num;
    if( str.length > len ){
        str = str.substr(0, len);
    }
    while(str.length < len){
        str = "0" + str;
    }
    return str;
}

function genBillNo(pid){
    var actorName = fixNumber(engine.user.player.AID, 8);
    var productId = fixNumber(pid, 2);
    var zoneId = fixNumber(engine.session.zoneId, 2);
    var time = fixNumber(Math.floor(engine.game.getServerTime()/1000), 10);
    return actorName+productId+zoneId+time+engine.game.getConfig().binary_channel;
}


function onEvent(event)
{
    switch(event.NTF)
    {
        case Message_PaymentResult:
        {
            switch(event.arg.result)
            {
                case 0://success
                {
                    if( theLastBillNo != null ){
                        tdga.paymentSuccess(theLastBillNo);
                        theLastBillNo = null;
                    }
                    if( iap.getStoreName() == "AppStore" ){
                        uikit.waitRPC(Request_ChargeDiamond, {
                            pid: event.arg.product,
                            stp: iap.getStoreName(),
                            bill: genBillNo(event.arg.product),
                            rep: event.arg.message
                        }, function(rsp){
                            if( rsp.RET == RET_OK ){
                                uikit.showAlert(translate(engine.game.language, "uiChargeDiamondSuc"));
                            }
                            else{
                                uikit.showAlert(translate(engine.game.language, "uiChargeDiamondFail"));
                            }
                        }, theLayer);
                    }
                }
                    break;
                case 1://cancel
                    uikit.showAlert(translate(engine.game.language, "uiChargeDiamondCancel"));
                    break;
                case 2://failed
                    uikit.showAlert(translate(engine.game.language, "uiChargeDiamondFail"));
                    break;
            }
            if( theLoad != null ){
                theLoad.removeFromParent();
                theLoad = null;
            }
        }
            return true;
        case Message_UpdateVIPLevel:
            updateVIP();
            return false;
        case Message_UpdateTreasure:
            theLayer.ui.treasureDisplay.setTreasure(engine.user.inventory.Gold, engine.user.inventory.Diamond);
            return false;
        case Message_UpdateBounty:{
            if (engine.user.player.MonthCardCount <= 0){
                theLayer.owner.nodePurMC.setVisible(true);
                theLayer.owner.nodeHasMC.setVisible(false);
            }
            else{
                theLayer.owner.nodePurMC.setVisible(false);
                theLayer.owner.nodeHasMC.setVisible(true);
                theLayer.owner.labLv.setString(engine.user.player.MonthCardCount);
            }
        }
            return false;
    }
    return false;
}

function updateVIP(){
    //加载npc信息
    var vipInfo = libTable.readTable(TABLE_VIP);
    var maxVipLevel = vipInfo.VIP.requirement.length - 1;
    var vip = engine.user.actor.vip;
    if( vip == null ) vip = 0;
    vip = Number(vip);
    var curVipLevel = vip;
    if( curVipLevel < 0 ) curVipLevel = 0;
    var spent = 0;
    if( engine.user.player.RMB != null ){
        spent = engine.user.player.RMB;
    }
    if( curVipLevel >= maxVipLevel ){
        theLayer.owner.labVipNext.setVisible(true);
        theLayer.owner.labVipNext.setString(translate(engine.game.language, "uiChargeDiamondMaxVip"));
    }
    else{
        var left = vipInfo.VIP.requirement[curVipLevel+1].rmb - spent;
        var labPos = theLayer.owner.labVipNext.getPosition();
        theLayer.owner.labVipNext.setString(translate(engine.game.language, "uiChargeDiamondVipLevUp",[left,(curVipLevel+1)]));
        var labCont = theLayer.owner.labVipNext.getContentSize();
        theLayer.owner.labVipNext.setVisible(true);
        theLayer.owner.labVipNext.setString("");
        var text = DCTextArea.create();
        text.setDimension(490);
        text.setTextLine(true);
        text.pushText({//push desc
            text: translate(engine.game.language, "uiChargeDiamondChargeAgain"),
            color: cc.c3b(255, 255, 255),
            size: UI_SIZE_XS
        });
        text.pushText({//push desc
            text: left,
            color: COLOR_UID_YELLOW,
            size: UI_SIZE_XS
        });
        text.pushText({//push desc
            text: translate(engine.game.language, "uiChargeDiamondYuan"),
            color: COLOR_UID_YELLOW,
            size: UI_SIZE_XS
        });
        text.pushText({//push desc
            text: translate(engine.game.language, "uiChargeDiamondGain"),
            color: cc.c3b(255, 255, 255),
            size: UI_SIZE_XS
        });
        text.pushText({//push desc
            text: (curVipLevel+1),
            color: COLOR_UID_RED,
            size: UI_SIZE_XS
        });
        text.pushText({//push desc
            text: translate(engine.game.language, "uiChargeDiamondVIPLevel"),
            color: COLOR_UID_RED,
            size: UI_SIZE_XS
        });
        var textPosX = -labCont.width / 2;
        var textPosY = -11;//-labCont.height / 2;
        text.setPosition(cc.p(textPosX, textPosY));
        theLayer.owner.nodeVipNext.addChild(text);
    }
    //show now
    var sfc = cc.SpriteFrameCache.getInstance();
    if( curVipLevel > 0 ){
        //theLayer.owner.vipBgNow.setDisplayFrame(sfc.getSpriteFrame("jewel-vipbg.png"));
        theLayer.owner.vipTitleNow.setDisplayFrame(sfc.getSpriteFrame("jewel-gradebg3.png"));
        theLayer.owner.vipTxtNow.setString(vipInfo.VIP.levels[curVipLevel].desc);
        theLayer.owner.vipLvNow.removeAllChildren();
        var lv = "jewel-vip"+curVipLevel+".png";
        var spl = cc.Sprite.createWithSpriteFrame(sfc.getSpriteFrame(lv));
        theLayer.owner.vipLvNow.addChild(spl);
    }
    else{
        //theLayer.owner.vipBgNow.setDisplayFrame(sfc.getSpriteFrame("jewel-novipbg.png"));
        theLayer.owner.vipTitleNow.setDisplayFrame(sfc.getSpriteFrame("jewel-gradebg1.png"));
        theLayer.owner.vipTxtNow.setString(translate(engine.game.language, "uiChargeDiamondNotVip"));
        theLayer.owner.vipLvNow.removeAllChildren();
    }
    //show next
    if( curVipLevel != maxVipLevel ){
        //theLayer.owner.vipBgNext.setDisplayFrame(sfc.getSpriteFrame("jewel-vipbg.png"));
        theLayer.owner.vipTxtNext.setString(vipInfo.VIP.levels[curVipLevel+1].desc);
        theLayer.owner.vipLvNext.removeAllChildren();
        var lv = "jewel-vip"+(curVipLevel+1)+".png";
        var spl = cc.Sprite.createWithSpriteFrame(sfc.getSpriteFrame(lv));
        theLayer.owner.vipLvNext.addChild(spl);
    }
    else{
        //theLayer.owner.vipBgNext.setDisplayFrame(sfc.getSpriteFrame("jewel-vipbg.png"));
        theLayer.owner.vipTxtNext.setString(translate(engine.game.language, "uiChargeDiamondNoHigherLev"));
        theLayer.owner.vipLvNext.removeAllChildren();
        var lv = "jewel-vip"+(curVipLevel)+".png";
        var spl = cc.Sprite.createWithSpriteFrame(sfc.getSpriteFrame(lv));
        theLayer.owner.vipLvNext.addChild(spl);
    }
}

var interval = 0;
function update(delta){
    interval += delta;
    if( interval > 5 ){
        engine.event.sendNTFEvent(103, {sign: -1});
        interval = 0;
    }
}

function onUIAnimationCompleted(name){
    if( theMode == MODE_EXIT ){
        engine.ui.popLayer();
        if( closeCBFUNC != null ){
            closeCBFUNC.apply(closeCBOBJ);
        }
    }
    else if(theMode == MODE_NORMAL){
    }
}

function onEnter()
{
    theLayer = this;

    var mask = blackMask();
    this.addChild(mask);

    theLayer.owner = {};
    theLayer.owner.onClose = onClose;
    theLayer.owner.onCharge = onCharge;
    theLayer.owner.onMonthCard = onMonthCard;
    theLayer.theNode = ui.loadUI(theLayer, "sceneJewel.ccbi", {
       nodeTreasure: {
           ui: "UITreasure",
           id: "treasureDisplay"
       }
    });

    theLayer.addChild(theLayer.theNode);

    theMode = MODE_NORMAL;
    theLayer.theNode.animationManager.setCompletedAnimationCallback(theLayer, onUIAnimationCompleted);
    theLayer.theNode.animationManager.runAnimationsForSequenceNamed("open");

    theLayer.ui.treasureDisplay.setTreasure(engine.user.inventory.Gold, engine.user.inventory.Diamond);

    engine.ui.regMenu(theLayer.owner.menuRoot);

    updateVIP();

    this.owner.nodePurMC.setVisible(false);
    this.owner.nodeHasMC.setVisible(false);

    if (engine.user.player.MonthCardCount <= 0){
        theLayer.owner.nodePurMC.setVisible(true);
        theLayer.owner.nodeHasMC.setVisible(false);
    }
    else{
        theLayer.owner.nodePurMC.setVisible(false);
        theLayer.owner.nodeHasMC.setVisible(true);
        theLayer.owner.labLv.setString(engine.user.player.MonthCardCount);
    }

    interval = 0;
    theLayer.update = update;
    theLayer.scheduleUpdate();

    //shutdown monthcard
    // theLayer.owner.nodePurMC.setVisible(false);
    // theLayer.owner.nodeHasMC.setVisible(false);
    // theLayer.owner.btnMonthCard.setVisible(false);
}

function onClose(sender)
{
    cc.AudioEngine.getInstance().playEffect("cancel.mp3");
    theMode = MODE_EXIT;
    theLayer.theNode.animationManager.runAnimationsForSequenceNamed("close");
}

function onCharge(sender)
{
    var index = sender.getTag();

    var actorName = engine.user.actor.Name;
    var zoneId = engine.session.zoneId;
    var billNo = genBillNo(index);
    iap.makePayment(billNo, index, 1, actorName, zoneId);
    tdga.paymentRequest(billNo, payStr[index].str, payStr[index].cost, "CNY", payStr[index].dm, iap.getStoreName() );
    theLastBillNo = billNo;

    //保持连接
    engine.event.sendNTFEvent(103, {sign:-1});
}

//--- Month Card ---
var theMonthCardLayer;

function purchaseMonthCard(){
    theMonthCardLayer.owner.btnBack.setVisible(true);
    theMonthCardLayer.owner.btnBack1.setVisible(false);
    theMonthCardLayer.owner.btnPurchase.setVisible(true);
    theMonthCardLayer.owner.nodeNoMC.setVisible(true);
    theMonthCardLayer.owner.labLv.setVisible(false);
}

function hasMonthCard(){
    theMonthCardLayer.owner.btnBack.setVisible(false);
    theMonthCardLayer.owner.btnBack1.setVisible(true);
    theMonthCardLayer.owner.btnPurchase.setVisible(false);
    theMonthCardLayer.owner.labLv.setVisible(true);
    theMonthCardLayer.owner.labLv.setString(engine.user.player.MonthCardCount);
    theMonthCardLayer.owner.nodeNoMC.setVisible(false);
}

function onMonthCard(sender)
{
    showMonthCard();
}

function onBackMonthCard(sender){
    cc.AudioEngine.getInstance().playEffect("cancel.mp3");
    theMonthCardLayer.node.runAction(actionPopOut(function(){
        engine.ui.popLayer();
    }, theMonthCardLayer));
}

function onPurchaseMonthCard(sender){
    //向服务器发送购买月卡的消息
    var actorName = engine.user.actor.Name;
    var zoneId = engine.session.zoneId;
    var billNo = genBillNo(8);
    iap.makePayment(billNo, 8, 1, actorName, zoneId);
    tdga.paymentRequest(billNo, payStr[0].str, payStr[0].cost, "CNY", payStr[0].dm, iap.getStoreName() );

    //保持连接
    engine.event.sendNTFEvent(103, {sign:-1});

    theMonthCardLayer.node.runAction(actionPopOut(function(){
        engine.ui.removeLayer(theMonthCardLayer);
        theMonthCardLayer = null;
    }, theMonthCardLayer));
}

function showMonthCard()
{
    theMonthCardLayer = engine.ui.newLayer();

    var winSize = engine.game.viewSize;

    var mask = blackMask();
    theMonthCardLayer.addChild(mask);

    theMonthCardLayer.owner = {};
    theMonthCardLayer.owner.onBack = onBackMonthCard;
    theMonthCardLayer.owner.onPurchase = onPurchaseMonthCard;

    theMonthCardLayer.node = ui.loadUI(theMonthCardLayer, "ui-yk.ccbi", {});
    theMonthCardLayer.node.setPosition(cc.p(winSize.width / 2,winSize.height / 2));
    theMonthCardLayer.addChild(theMonthCardLayer.node);

    theMonthCardLayer.owner.btnBack.setVisible(false);
    theMonthCardLayer.owner.btnBack1.setVisible(false);
    theMonthCardLayer.owner.btnPurchase.setVisible(false);
    theMonthCardLayer.owner.nodeNoMC.setVisible(false);

    if (engine.user.player.MonthCardCount <= 0){
        purchaseMonthCard();
    }
    else{
        hasMonthCard();
    }

    theMonthCardLayer.node.runAction(actionPopIn());

    engine.ui.regMenu(theMonthCardLayer.owner.menuRoot);
}

function node(func, obj)
{
    closeCBFUNC = func;
    closeCBOBJ = obj;

    return engine.ui.newLayer({
        onEnter: onEnter,
        onNotify: onEvent
    });
}

exports.node = node;