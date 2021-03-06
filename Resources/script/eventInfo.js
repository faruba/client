/**
 * User: hammer
 * Date: 14-1-15
 * Time: 下午4:43
 */
var libUIC = loadModule("UIComposer.js");
var libTable = loadModule("table.js");
var libUIKit = loadModule("uiKit.js");
var libItem = loadModule("xitem.js");

var theLayer;
var theListLayer;
var theDescLayer;
var theEvent;

var MODE_LIST = 0;
var MODE_DESC = 1;
var MODE_EXIT = 2;

var theMode;

var touchPosBegin;

//contants
var LINE_WIDTH = 570;
var LINE_HEIGHT = 250;

var COLOR_BLACK = cc.c3b(55,37,20);
var COLOR_RED = cc.c3b(197,16,16);

var thePrizeLayer = [];

function onTouchBegan(touch, event){
    touchPosBegin = touch.getLocation();
    return true;
}

function onTouchMoved(touch, event){

}

function onTouchEnded(touch, event){
    var pos = touch.getLocation();
    var dis = cc.pSub(pos, touchPosBegin);
    if( cc.pLengthSQ(dis) < CLICK_RANGESQ ){
        var localPos = theListLayer.convertToNodeSpace(touchPosBegin);
        var size = theListLayer.getContentSize();
        if( localPos.x >0 && localPos.y >0
            && localPos.x < size.width && localPos.y < size.height ){
            var PY = Math.floor((size.height - localPos.y)/LINE_HEIGHT);
            var line = theListLayer.getChildByTag(PY);
            loadEventDesc(line.quest);
        }
    }
}

function onTouchCancelled(touch, event){
    onTouchEnded(touch, event);
}

function onClose(sender){
    cc.AudioEngine.getInstance().playEffect("cancel.mp3");
    theMode = MODE_EXIT;
    theLayer.node.animationManager.runAnimationsForSequenceNamed("close");
}

function onBack(sender){
    cc.AudioEngine.getInstance().playEffect("cancel.mp3");
    for (var k in thePrizeLayer){
        engine.ui.unregMenu(thePrizeLayer[k]);
    }
    thePrizeLayer = [];
    loadEventList();
}

function loadEventList(){
    theMode = MODE_LIST;
    theLayer.owner.nodeList.setVisible(true);
    theLayer.owner.nodeDesc.setVisible(false);
    theListLayer.removeAllChildren();
    theListLayer.setTouchEnabled(true);
    theLayer.owner.btnBack.setVisible(false);
    theLayer.owner.labBlueTitle.setVisible(false);
    theLayer.owner.nodeConBg.setVisible(false);

    var size = cc.size(LINE_WIDTH, engine.user.activity.list.length*LINE_HEIGHT);
    theListLayer.setContentSize(size);
    if( engine.user.activity.list.length == 0 ){
        var label = cc.LabelTTF.create(translate(engine.game.language, "eventInfoNoBounty"), UI_FONT, UI_SIZE_XL);
        var viewSize = theLayer.ui.scrollList.getViewSize();
        label.setPosition(cc.p(viewSize.width/2, -viewSize.height/2));
        theListLayer.addChild(label);
    }
    else
    {
        var count = 0;
        for(var k in engine.user.activity.list ){
            var quest = engine.user.activity.list[k];
            var line = cc.Sprite.create(quest.banner);
            line.setAnchorPoint(cc.p(0, 0));
            line.setPosition(cc.p(0, size.height - count*LINE_HEIGHT - LINE_HEIGHT));
            line.quest = quest;
            line.setTag(count);
            theListLayer.addChild(line);

            count++;
        }
    }

    var curroffset = theLayer.ui.scrollList.getContentOffset();
    curroffset.y = theLayer.ui.scrollList.minContainerOffset().y;
    theLayer.ui.scrollList.setContentOffset(curroffset);
}

function loadEventDesc(quest){
    for (var k in thePrizeLayer){
        engine.ui.unregMenu(thePrizeLayer[k]);
    }
    thePrizeLayer = [];
    cc.AudioEngine.getInstance().playEffect("card2.mp3");
    theMode = MODE_DESC;
    theLayer.owner.nodeList.setVisible(false);
    theLayer.owner.nodeDesc.setVisible(true);
    theDescLayer.removeAllChildren();
    theListLayer.setTouchEnabled(false);
    theLayer.owner.btnBack.setVisible(true);
    theLayer.owner.labBlueTitle.setVisible(true);
    theLayer.owner.nodeConBg.setVisible(true);

    theEvent = quest;
    var dimension = cc.size(theLayer.owner.layerDesc.getContentSize().width, 0);

    theLayer.owner.labTitle.setString(quest.title);

    var winSize = engine.game.viewSize;
    var iphone5s = (winSize.height == 1136);
    var text = DCTextArea.create();
    var size = cc.size(0, 0);
    text.setDimension(dimension);
    if (iphone5s){
        text.pushText({text: "  "});
    }
    if( quest.desc != null ){
        text.pushMarkdown(quest.desc, true);
        size = text.getContentSize();
    }
    if( quest.date != null ){
        text.pushText({text: "  "});
        text.pushText({//push objectives
            text: translate(engine.game.language, "eventInfoBountyData"),
            color: COLOR_RED,
            size: UI_SIZE_L
        });
        if (iphone5s){
            text.pushText({text: "  "});
        }
        text.pushText({//push date
            text: /*"    "+*/quest.date,
            color: COLOR_BLACK,
            size: UI_SIZE_S
        });
        size = text.getContentSize();
    }
    if( quest.prz != null ){
        text.pushText({text: "  "});
        text.pushText({//push title
            text: translate(engine.game.language, "eventInfoBountyPrize"),
            color: COLOR_RED,
            size: UI_SIZE_L
        });
        if (iphone5s){
            text.pushText({text: "  "});
        }
        size = text.getContentSize();

        var prize = libItem.ItemPreview.createRaw(dimension);
        engine.ui.regMenu(prize);
        thePrizeLayer.push(prize);
        debug("eventInfo.js");
        prize.setTextColor(COLOR_BLACK);
        prize.setShowInfo(true);
        if (!iphone5s){
            prize.setNodeScale(0.77);
        }
        prize.setPreview(quest.prz);
        prize.setPosition(cc.p(0, 0));
        theDescLayer.addChild(prize);
        text.setPosition(cc.p(0, prize.getContentSize().height));
        theDescLayer.addChild(text);
        size.height += prize.getContentSize().height;
    }
    else{
        text.setPosition(cc.p(0, 0));
        theDescLayer.addChild(text);
    }

    theDescLayer.setContentSize(size);

    var curroffset = theLayer.ui.scrollDesc.getContentOffset();
    curroffset.y = theLayer.ui.scrollDesc.minContainerOffset().y;
    theLayer.ui.scrollDesc.setContentOffset(curroffset);
}

function onUIAnimationCompleted(name){
    if( theMode == MODE_EXIT ){
        engine.ui.popLayer();
    }
}

function onEnter(){
    theLayer = this;

    var mask = blackMask();
    this.addChild(mask);

    this.owner = {};
    this.owner.onClose = onClose;
    this.owner.onBack = onBack;

    this.node = libUIC.loadUI(this, "sceneEvent.ccbi", {
        layerList: {
            ui: "UIScrollView",
            id: "scrollList",
            dir: cc.SCROLLVIEW_DIRECTION_VERTICAL
        },
        layerDesc: {
            ui: "UIScrollView",
            id: "scrollDesc",
            dir: cc.SCROLLVIEW_DIRECTION_VERTICAL
        }
    });
    this.addChild(this.node);
    theMode = MODE_LIST;
    this.node.animationManager.setCompletedAnimationCallback(theLayer, onUIAnimationCompleted);
    this.node.animationManager.runAnimationsForSequenceNamed("open");

    this.owner.nodeList.setVisible(false);
    this.owner.nodeDesc.setVisible(false);
    this.owner.btnBack.setVisible(false);
    this.owner.labBlueTitle.setVisible(false);
    this.owner.nodeConBg.setVisible(false);

    theListLayer = cc.Layer.create();
    this.ui.scrollList.setContainer(theListLayer);
    theDescLayer = cc.Layer.create();
    this.ui.scrollDesc.setContainer(theDescLayer);

    theListLayer.onTouchBegan = onTouchBegan;
    theListLayer.onTouchMoved = onTouchMoved;
    theListLayer.onTouchEnded = onTouchEnded;
    theListLayer.onTouchCancelled = onTouchCancelled;
    theListLayer.setTouchMode(cc.TOUCH_ONE_BY_ONE);
    theListLayer.setTouchPriority(1);
    theListLayer.setTouchEnabled(false);

    engine.ui.regMenu(this.owner.menuRoot);

    loadEventList();
    
    
}

function onActivate(){
    engine.pop.resetAllFlags();
    engine.pop.setFlag("tutorial");
    engine.pop.invokePop("activity");
}

function show(){
    engine.ui.newLayer({
        onEnter: onEnter,
        onActivate: onActivate
    });
}

exports.show = show;