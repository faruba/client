/**
 * Created by jovidu on 14-6-17.
 */

var libUIC = loadModule("UIComposer.js");
var libTable = loadModule("table.js");
var libItem = loadModule("xitem.js");
var libUIKit = loadModule("uiKit.js");

var theLayer = null;
var isFlying = false;
var TouchId = -1;

var theMode;
var MODE_EXIT = 0;
var MODE_PVP = 1;

var theRivalsList;


function getPkRivals() {
    libUIKit.waitRPC(Request_GetPkInfo, {}, function(rsp) {
        if( rsp.RET == RET_OK ){
            theRivalsList = rsp.lst;
            loadPkRivals();
        }
        else{
            libUIKit.showErrorMessage(rsp);
        }
    }, theLayer)
}

function loadPkRivals() {
    if( theRivalsList != null ){
        for( var i=1; i<4; i++ ){
            if( theRivalsList[i] != null ){
                //todo?
                //theLayer.owner[""+i].set
            }
        }
    }
}

function loadMyInfo() {
    var pkInfo = engine.user.player.PkInfo;
    if( pkInfo != null ){
        //todo?
    }
}

function setReceiveButton() {

}

function onRival(sender) {
    cc.AudioEngine.getInstance().playEffect("card2.mp3");
    if( sender.getTag() == TouchId ){
        TouchId = -1;
    }else{
        TouchId = sender.getTag();
    }
    for( var i=1; i<4; i++){
        theLayer.owner["btnStartPK"+i].setVisible(i == TouchId);
    }

}

function onStartPK() {
    cc.AudioEngine.getInstance().playEffect("card2.mp3");
    var alert = libUIKit.alert();
    alert.setContent("确定开始挑战TA吗？");
    alert.setButton([
        {
            label: "buttontext-qx.png",
            func: onClose,
            obj: alert
        },
        {
            label: "xxxx.png",//todo?
            func: function () {
                var libStage = loadModule("sceneStage.js");
                libStage.startStage();//todo?
            },
            obj: alert,
            type: BUTTONTYPE_DEFAULT
        }
    ]);
}

function onReceivePrize() {
    cc.AudioEngine.getInstance().playEffect("card2.mp3");
    libUIKit.waitRPC(Request_ReceivePrize, {typ: ReceivePkPrize}, function (rsp) {
        if( rsp.RET == RET_OK ){
            libUIKit.showAlert("奖金领取成功！");
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
        getPkRivals();
    }
}

function onEnter() {
    TouchId = -1;
    theRivalsList = {};
    theLayer = this;
    this.owner = {};
    this.owner.onRival = onRival;
    this.owner.onStartPK = onStartPK;
    this.owner.onReceivePrize = onReceivePrize;
    this.owner.onClose = onClose;
    var node = libUIC.loadUI(this, "scenePVP.ccbi", {
        //bind todo?
    });
    theLayer.node = node;
    this.addChild(node);
    theMode = MODE_PVP;
    node.animationManager.setCompletedAnimationCallback(theLayer, onUIAnimationCompleted);
    node.animationManager.runAnimationsForSequenceNamed("open");
    loadMyInfo();
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