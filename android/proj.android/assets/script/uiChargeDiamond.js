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
    {str:"6元", cost:6, dm:60 },
    {str:"18元", cost:18, dm:130 },
    {str:"30元", cost:30, dm:330 },
    {str:"68元", cost:68, dm:760 },
    {str:"128元", cost:128, dm:1460 },
    {str:"198元", cost:198, dm:2260 },
    {str:"328元", cost:328, dm:3760 },
    {str:"648元", cost:648, dm:7480 }
];

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
                                uikit.showAlert("充值成功");
                            }
                            else{
                                uikit.showAlert("充值失败");
                            }
                        }, theLayer);
                    }
                }
                    break;
                case 1://cancel
                    uikit.showAlert("充值取消");
                    break;
                case 2://failed
                    uikit.showAlert("充值失败");
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
        theLayer.owner.labVipNext.setString("您已经获得最高等级VIP");
    }
    else{
        var left = vipInfo.VIP.requirement[curVipLevel+1].rmb - spent;
        theLayer.owner.labVipNext.setString("再充值"+left+"元即可永久获得"+(curVipLevel+1)+"级VIP");
    }
    //show now
    var sfc = cc.SpriteFrameCache.getInstance();
    if( curVipLevel > 0 ){
        //theLayer.owner.vipBgNow.setDisplayFrame(sfc.getSpriteFrame("jewel-vipbg.png"));
        theLayer.owner.vipTxtNow.setString(vipInfo.VIP.levels[curVipLevel].desc);
        theLayer.owner.vipLvNow.removeAllChildren();
        var lv = "jewel-vip"+curVipLevel+".png";
        var spl = cc.Sprite.createWithSpriteFrame(sfc.getSpriteFrame(lv));
        theLayer.owner.vipLvNow.addChild(spl);
    }
    else{
        //theLayer.owner.vipBgNow.setDisplayFrame(sfc.getSpriteFrame("jewel-novipbg.png"));
        theLayer.owner.vipTxtNow.setString("您还不是VIP");
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
        theLayer.owner.vipTxtNext.setString("更高等级VIP暂未开放");
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
}

function onActivate(){
    engine.pop.resetAllFlags();
    engine.pop.setFlag("tutorial");
    engine.pop.invokePop("charge");
}

function onEnter()
{
    theLayer = this;

    var mask = blackMask();
    this.addChild(mask);

    theLayer.owner = {};
    theLayer.owner.onClose = onClose;
    theLayer.owner.onCharge = onCharge;
    theLayer.theNode = cc.BuilderReader.load("sceneJewel.ccbi", theLayer.owner);
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

    interval = 0;
    theLayer.update = update;
    theLayer.scheduleUpdate();
    
    
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

function node(func, obj)
{
    closeCBFUNC = func;
    closeCBOBJ = obj;

    return engine.ui.newLayer({
        onEnter: onEnter,
        onNotify: onEvent,
        onActivate: onActivate
    });
}

exports.node = node;