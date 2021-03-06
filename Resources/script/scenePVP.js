/**
 * Created by jovidu on 14-6-17.
 */

var libUIC = loadModule("UIComposer.js");
var libTable = loadModule("table.js");
var libItem = loadModule("xitem.js");
var libUIKit = loadModule("uiKit.js");
var libRole = loadModule("role.js");

var theLayer = null;
var isFlying = false;
var TouchId = -1;

var theMode;
var MODE_EXIT = 0;
var MODE_PVP = 1;

var DAILY_TIMES_NEED = 5;
var PVP_STAGEID = 124;

var theRivalsList;
var theRival;
var myPkInfo;
var myRank;
var PKINFO_UPDATE_PERIOD = 5; // unit: s

function getPkRivals() {
    engine.event.sendRPCEvent(Request_GetPkRivals, {}, function(rsp) {
        if( rsp.RET == RET_OK ){
            theRivalsList = rsp.arg;
            loadPkRivals();
            engine.session.cacheRoleInfo(rsp.arg);
        }
        else{
            libUIKit.showErrorMessage(rsp);
        }
    }, theLayer)
}

function loadPkRivals() {
    if( theRivalsList != null ){
        for( var i=1; i<4; i++ ){
            if( theRivalsList[i-1] != null ){
                var role = new libRole.Role(theRivalsList[i-1]);
                role.fix();
                theLayer.ui["avatar"+i].setRole(role);
                theLayer.owner["labName"+i].setString(role.Name);
                theLayer.owner["labRank"+i].setString(Number(role.Rank+1));
            }
        }
    }
}

function loadMyInfo() {
    engine.session.updatePVPInfo(function() {
        myPkInfo = engine.session.PkInfo;
        myRank = myPkInfo.rnk + 1;
        if( myPkInfo != null ){
            theLayer.owner.labMyRank.setString(myRank);
            theLayer.owner.labTimes.setString(myPkInfo.cpl+"/"+myPkInfo.ttl);
            setBottomContent();
        }
    });
}

function setBottomContent() {
    if( myPkInfo.cpl >= DAILY_TIMES_NEED ){
        //can receive
        if(myPkInfo.rcv != null && myPkInfo.rcv){
            //received
            theLayer.owner.nodeBotCnt1.setVisible(false);
            theLayer.owner.nodeBotCnt2.setVisible(false);
            theLayer.owner.nodeBotCnt3.setVisible(true);
        }else{
            //not received
            theLayer.owner.nodeBotCnt1.setVisible(false);
            theLayer.owner.nodeBotCnt2.setVisible(true);
            theLayer.owner.nodeBotCnt3.setVisible(false);
            theLayer.owner.labBonusGold.setString(queryPkPrize(myRank).count);
        }
    }else{
        //cannot receive
        theLayer.owner.nodeBotCnt1.setVisible(true);
        theLayer.owner.nodeBotCnt2.setVisible(false);
        theLayer.owner.nodeBotCnt3.setVisible(false);
        var timesNeed = DAILY_TIMES_NEED - myPkInfo.cpl;
        if( timesNeed < 0 ) timesNeed = 0;
        theLayer.owner.labTimesNeed.setString(timesNeed);
    }
}

function queryPkPrize(rank){
    var pkPrizeInfo;
    for(var i=0; ; i++){
        pkPrizeInfo = libTable.queryTable(TABLE_ARENA, i);
        if( pkPrizeInfo == null ) return null;
        if( rank <= pkPrizeInfo.top ){
            for( var k in pkPrizeInfo.prize ){
                switch(pkPrizeInfo.prize[k].type){
                    case 1: {
                        return pkPrizeInfo.prize[k];
                    }
                    default: break;
                }
            }
        }
    }
}

function onRoleInfo(sender){
    cc.AudioEngine.getInstance().playEffect("card2.mp3");
    libUIKit.showRoleInfo(theRivalsList[sender.getTag()-1].nam);
}

function onStartPK(sender) {
    cc.AudioEngine.getInstance().playEffect("card2.mp3");
    TouchId = sender.getTag();
    if( myPkInfo.cpl >= myPkInfo.ttl ){
        libUIKit.showAlert(translate(engine.game.language, "scenePVPNOPKCount"));
        return;
    }
    if( theRivalsList != null && theRivalsList[TouchId-1] != null ){
        theRival = theRivalsList[TouchId-1];
    }
    if( theRival != null ){
        var libStage = loadModule("sceneStage.js");
        var stageDate = queryStage(PVP_STAGEID);
        engine.session.PkInfo.curRival = theRival;
        libStage.startStage(PVP_STAGEID, stageDate.team, stageDate.cost, theRival.nam);
    }else{
        libUIKit.showAlert(translate(engine.game.language, "scenePVPNOPlayer"));
    }

}

function onReceivePrize() {
    cc.AudioEngine.getInstance().playEffect("card2.mp3");
    libUIKit.waitRPC(Request_ReceivePrize, {typ: ReceivePkPrize}, function (rsp) {
        if( rsp.RET == RET_OK ){
            loadModule("itemInfo.js").showOpenEffect([queryPkPrize(myRank)]);
            loadMyInfo();
        }
        else{
            libUIKit.showErrorMessage(rsp);
        }
    }, theLayer);
}

function onClose(sender){
    cc.AudioEngine.getInstance().playEffect("cancel.mp3");
    theMode = MODE_EXIT;
    theLayer.node.animationManager.runAnimationsForSequenceNamed("close");
}

function onUIAnimationCompleted(name){
    isFlying = false;
    if( theMode == MODE_EXIT ){
        var main = loadModule("sceneMain.js");
        engine.ui.newScene(main.scene());
    }
    if( theMode == MODE_PVP ){

        //test code
//        return;

        getPkRivals();
    }
}

function onEnter() {
    TouchId = -1;
    theRivalsList = {};
    theLayer = this;
    myPkInfo = {};
    theRival = null;
    this.owner = {};
    this.owner.onStartPK = onStartPK;
    this.owner.onRoleInfo = onRoleInfo;
    this.owner.onReceivePrize = onReceivePrize;
    this.owner.onClose = onClose;
    var node = libUIC.loadUI(this, "sceneJjc.ccbi", {
        nodeRole1:{
            ui: "UIAvatar",
            id: "avatar1"
        },
        nodeRole2:{
            ui: "UIAvatar",
            id: "avatar2"
        },
        nodeRole3:{
            ui: "UIAvatar",
            id: "avatar3"
        }
    });
    theLayer.node = node;
    this.addChild(node);
    theMode = MODE_PVP;
    node.animationManager.setCompletedAnimationCallback(theLayer, onUIAnimationCompleted);
    node.animationManager.runAnimationsForSequenceNamed("open");
    engine.ui.regMenu(this.owner.menuRoot);

    loadMyInfo();
    this.schedule(loadMyInfo, PKINFO_UPDATE_PERIOD);
    //register broadcast
    loadModule("broadcastx.js").instance.simpleInit(this);
}

function onExit() {
    loadModule("broadcastx.js").instance.close();
}

function onNotify(ntf){
//    switch(ntf.NTF){
//    }
    return false;
}

function scene(){
    return {
        onEnter: onEnter,
        onExit: onExit,
        onNotify: onNotify
//        onActivate: onActivate
    };
}

exports.scene = scene;