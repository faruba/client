/**
 * User: hammer
 * Date: 13-8-16
 * Time: 下午4:39
 */

var effect = loadModule("effect.js");
var table = loadModule("table.js");
var stage = loadModule("stage.js");
var role = loadModule("role.js");
var scroller = loadModule("scroller.js");
var ui = loadModule("UIComposer.js");
var libItem = loadModule("xitem.js");
var libUIKit = loadModule("uiKit.js");
var libUIC = loadModule("UIComposer.js");

var theLayer = null;
var theChapterClass;
var theStageClass;
var onStgTag = -1;
var theEnergyCost = 0;

var winSize;
var BIRD_HIGH = 30;
var CLOUD_HIGH = 40;

var MODE_WORLD = 0;
var MODE_STAGE = 1;

var TYPE_NORMAL = 0;
var TYPE_CHALLENGE = 1;
var theType = -1;
var SWEEP_SCROLL_CID = 871;
var PrizeList = [];
var PrizeIndex = 0;
var SweepArgs = {};
var isScheduling = false;
var SWEEP_VIP_LEVEL = 3;
var LastCantSweep = false;
var NormalGroup = [];
var SweepGroup = [];
var BAR_WIDTH = 570;
var BAR_HEIGHT = 180;
var NumMultiRows;
var LastMultiRows;
var thePrizeLayer = [];
var WORLD_STAGE_ID = 133;
var WORLD_STAGE_RESET_TIME = {
    day: "二", //Tuesday
    time: "1:00"
};

function onEvent(event)
{
    return false;
}

function onClose(sender)
{
    cc.AudioEngine.getInstance().playEffect("cancel.mp3");
    for (var k in thePrizeLayer){
        engine.ui.unregMenu(thePrizeLayer[k]);
    }
    thePrizeLayer = [];
    var main = loadModule("sceneMain.js");
    engine.ui.newScene(main.scene());
}

function onQuest(sender){
    cc.AudioEngine.getInstance().playEffect("card2.mp3");
    loadModule("questInfo.js").show();
}

function onEnter()
{
    theLayer = engine.ui.curLayer;

    if( !cc.AudioEngine.getInstance().isMusicPlaying() )
    {
        cc.AudioEngine.getInstance().playMusic("login.mp3");
    }

    var sfc = cc.SpriteFrameCache.getInstance();
    sfc.addSpriteFrames("map.plist");
    sfc.addSpriteFrames("map2.plist");

    winSize = engine.game.viewSize;

    theLayer.bgOwner = {};
    theLayer.bg = cc.BuilderReader.load("ui-map.ccbi", theLayer.bgOwner);
    theLayer.bg.setPosition(cc.p(0, 0));
    theLayer.addChild(theLayer.bg);

    {//cache calculation
        theLayer.mapsize = theLayer.bg.getContentSize();

        //calc map restriction
        theLayer.mapMinY = winSize.height - theLayer.mapsize.height;
        theLayer.mapMaxY = 0;
    }

    //add stage scene
    theLayer.owner = {};
    theLayer.owner.onClose = onClose;
    theLayer.owner.onQuest = onQuest;
    theLayer.owner.onWorldStage = onWorldStage;
    var node = cc.BuilderReader.load("sceneMap.ccbi", theLayer.owner);
    theLayer.addChild(node);

    theLayer.onTouchBegan = onTouchBegan;
    theLayer.onTouchMoved = onTouchMoved;
    theLayer.onTouchEnded = onTouchEnded;
    theLayer.onTouchCancelled = onTouchCancelled;
    theLayer.setTouchMode(cc.TOUCHES_ONE_BY_ONE);
    theLayer.setTouchEnabled(true);

    engine.ui.regMenu(theLayer);
    engine.ui.regMenu(theLayer.owner.menuRoot);

    initStage();

    loadModule("effect.js").attachEffectCCBI(theLayer.owner.nodeLight, cc.p(0,0), "effect-jjclight.ccbi", 1);

    //register broadcast
    loadModule("broadcastx.js").instance.simpleInit(this);
}

function onExit()
{
    for (var k in thePrizeLayer){
        engine.ui.unregMenu(thePrizeLayer[k]);
    }
    thePrizeLayer = [];
    loadModule("broadcastx.js").instance.close();
}

function onActivate(){
    engine.pop.setAllAndInvoke("stage");
}

function initStage()
{
    var stg = engine.user.stage;
    theLayer.chapterList = {};
    for(var k=0; k<table.getTableLength(TABLE_STAGE); ++k)
    {
        var locked = true;
        if( stg.Chapters[k] != null ){
            locked = false;
        }

        var ChClass = table.queryTable(TABLE_STAGE, k);
        if( ChClass.hidden != true ){
            //replace check
            var parent = theLayer.bgOwner.nodeList.getChildByTag(ChClass.idx);
            if( parent.CID != null ){
                if( parent.LCK == true ){
                    parent.removeAllChildren();
                    delete theLayer.chapterList[parent.CID];
                }
                else{
                    continue;
                }
            }

            var sprite = cc.Sprite.createWithSpriteFrameName(ChClass.style+".png");
            sprite.setPosition(cc.p(0, 0));
            parent.addChild(sprite);
            parent.CID = k;
            parent.LCK = locked;

            theLayer.chapterList[k] = {
                sprite: sprite,
                parent: parent,
                locked: locked
            };

            if( locked ){
                var nstyle = ChClass.style+"x.png";
                var sfc = cc.SpriteFrameCache.getInstance();
                sprite.setDisplayFrame(sfc.getSpriteFrame(nstyle));
            }
        }
    }
}

var touchRange = 100;

function chapterAtPos(pos)
{
    for(var k in theLayer.chapterList){
        var data = theLayer.chapterList[k];
        if( data.locked == false ){
            var dst = cc.pDistance(data.parent.getPosition(), pos);
            if( dst < touchRange ){
                return k;
            }
        }
    }
    return -1;
}

function onMode(sender){
    cc.AudioEngine.getInstance().playEffect("card2.mp3");
    if( theType == TYPE_NORMAL ){
        onChallenge();
    }
    else if( theType == TYPE_CHALLENGE ){
        onNormal();
    }
}

function onNormal(){
    theType = TYPE_NORMAL;
    var chInst = engine.user.stage.Chapters[theChapterClass.chapterId];
    var sfc = cc.SpriteFrameCache.getInstance();
    theLayer.stage.owner.nodeNormal.setVisible(true);
    theLayer.stage.owner.nodeChallenge.setVisible(false);

    //hide all seven stage buttons
    for(var k=1; k<=7; ++k){
        var btn = theLayer.stage.owner.menu.getChildByTag(k);
        btn.setVisible(true);
    }

    debug("chInst = \n"+JSON.stringify(chInst));
    //show the seven stage buttons
    var curStageIndex = 0;
    var foreverStage = false;
    for(var k in theChapterClass.stage)
    {
        var n = Number(k);
        var stg = theChapterClass.stage[k];

        if( stg.isInfinite ){//skip infinite
            if( chInst.Stages[k] != null && chInst.Stages[k].State >= 1 ){
                foreverStage = true;
                theLayer.INFIKEY = Number(k);
            }
            continue;
        }

        var stageKey = "spriteStage"+(n+1);
        var stageNode = theLayer.stage.owner[stageKey];

        var sta = 0;
        if( chInst.Stages[k] != null )
        {
            sta = chInst.Stages[k].State;
        }
        if( /*stg.hidden != true ||*/ sta != 0 )
        {
            stageNode.setVisible(true);
        }
        switch(sta)
        {
            case 0://未激活
                break;
            case 1://已激活
                break;
            case 2://已击穿
                stageNode.setDisplayFrame(sfc.getSpriteFrame("dungeoniconbg1.png"));
                break;
        }
        if( sta > 0 )
        {
            curStageIndex = n;
        }
    }
    selectStage(curStageIndex);
    if( foreverStage ){
        debug("FOREVER STAGE IS ENABLED");
        theLayer.stage.owner.btnMode.setEnabled(true);
    }
    else{
        debug("FOREVER STAGE IS DISABLED");
        theLayer.stage.owner.btnMode.setEnabled(false);
    }
    //set challenge button
    theLayer.stage.owner.btnMode.setNormalSpriteFrame(sfc.getSpriteFrame("map-btn-wjms1.png"));
    theLayer.stage.owner.btnMode.setSelectedSpriteFrame(sfc.getSpriteFrame("map-btn-wjms2.png"));
    theLayer.stage.owner.btnMode.setDisabledSpriteFrame(sfc.getSpriteFrame("map-btn-wjms2.png"));
    theLayer.stage.owner.btnMode.runAction(cc.MoveBy.create(0.1, cc.p(0, 64)));
}

function getInfiPrize(dungeon, level){
    var infiPrize = dungeon.infinityPrize;
    for(var k in infiPrize){
        var pl = infiPrize[k];
        if( pl.level >= level ){
            return pl;
        }
    }
    //if not found
    return {
        level: -1
    };
}

function onChallenge(){
    theType = TYPE_CHALLENGE;
    var chInst = engine.user.stage.Chapters[theChapterClass.chapterId];
    var sfc = cc.SpriteFrameCache.getInstance();
    theLayer.stage.owner.nodeNormal.setVisible(false);
    theLayer.stage.owner.nodeChallenge.setVisible(true);
    if( theLayer.stage.spriteSelect != null)
    {
        theLayer.stage.spriteSelect.setVisible(false);
    }

    //hide all seven stage buttons
    for(var k=1; k<=7; ++k){
        var btn = theLayer.stage.owner.menu.getChildByTag(k);
        btn.setVisible(false);
    }
    //set challenge button
    theLayer.stage.owner.btnMode.setNormalSpriteFrame(sfc.getSpriteFrame("map-btn-zcms1.png"));
    theLayer.stage.owner.btnMode.setSelectedSpriteFrame(sfc.getSpriteFrame("map-btn-zcms2.png"));
    theLayer.stage.owner.btnMode.setDisabledSpriteFrame(sfc.getSpriteFrame("map-btn-zcms2.png"));
    theLayer.stage.owner.btnMode.runAction(cc.MoveBy.create(0.1, cc.p(0, -64)));
    //hide sweep buttons
    theLayer.stage.owner.nodeSweepMid.setVisible(false);
    theLayer.stage.owner.btnSweep1.setVisible(false);
    theLayer.stage.owner.btnSweep2.setVisible(false);
    theLayer.stage.owner.nodeSweepFrame.setVisible(false);

    var team = 3;
    if( Math.floor(chInst.Stages[theLayer.INFIKEY].Level%10 == 0 )){
        team = 1;
    }
    else if( Math.floor(chInst.Stages[theLayer.INFIKEY].Level%5) == 0 ){
        team = 2;
    }
    theLayer.TEAM = team;
    theLayer.stage.owner.labelTeam.setString(translate(engine.game.language, "sceneStageTeamPersons", [team]));
    theLayer.stage.owner.labelTeam2.setString(translate(engine.game.language, "sceneStageTeamPersons", [team]));
    theLayer.stage.owner.labelLevel.setString(chInst.Stages[theLayer.INFIKEY].Level);

    theStageClass = theLayer.CHCLASS.stage[theLayer.INFIKEY];
    theLayer.stageSelected = theStageClass.stageId;
    theLayer.COST = theStageClass.cost;
    var dungeon = table.queryTable(TABLE_DUNGEON, theStageClass.dungeon);
    var prize = getInfiPrize(dungeon, chInst.Stages[theLayer.INFIKEY].Level);
    var preview = libItem.ItemPreview.create([prize]);
    preview.setShowInfo(true);
    theLayer.stage.owner.labNext.setString(translate(engine.game.language, "sceneStageGetExprize", [prize.level]));
    theLayer.stage.owner.nodePrize.addChild(preview);
    theLayer.stage.owner.labelEnergy.setString(translate(engine.game.language, "sceneStageCostEnergy", [theLayer.COST]));
    theLayer.stage.owner.labelEnergy2.setString(translate(engine.game.language, "sceneStageCostEnergy", [theLayer.COST]));

    theEnergyCost = theLayer.COST;
    engine.session.set("stage", theStageClass);
}

function showStages(chId)
{
    var stage = engine.ui.newLayer();
    var mask = blackMask();
    stage.addChild(mask); //weaken the map to highlight the choose-stage scene

    winSize = engine.game.viewSize;
    theLayer.stageLayer = stage;
    theLayer.stage = {};
    theLayer.stage.owner = {};
    theLayer.stage.owner.onStage = onSelectStage;
    theLayer.stage.owner.onSweep = onSweep;
    theLayer.stage.owner.onMode = onMode;
    theLayer.stage.node = cc.BuilderReader.load("ui-stage.ccbi", theLayer.stage.owner);
    theLayer.stage.node.setPosition(cc.p(winSize.width/2, winSize.height/2));
    stage.addChild(theLayer.stage.node);
    engine.ui.regMenu(theLayer.stage.owner.menu);

    //set values
    theLayer.CHID = chId;
    theLayer.CHCLASS = table.queryTable(TABLE_STAGE, chId);
    var chClass = theLayer.CHCLASS;
    theChapterClass = theLayer.CHCLASS;
    var sfc = cc.SpriteFrameCache.getInstance();
    theLayer.stage.owner.spriteIcon1.setDisplayFrame(sfc.getSpriteFrame(chClass.icon));
    theLayer.stage.owner.spriteIcon2.setDisplayFrame(sfc.getSpriteFrame(chClass.icon));
    theLayer.stage.owner.spriteTitle.setDisplayFrame(sfc.getSpriteFrame("x"+chClass.title));
    theLayer.stage.owner.labelDesc.setString(chClass.desc);
    theLayer.stage.owner.labelDesc2.setString(chClass.desc);
    var btnOK = buttonNormalL("buttontext-confirm.png", BUTTON_OFFSET, this, onBtnOK, BUTTONTYPE_DEFAULT);
    btnOK.setPosition(theLayer.stage.owner.nodeButton2.getPosition());
    theLayer.stage.owner.menu.addChild(btnOK);
    var btnCancel = buttonNormalL("buttontext-qx.png", BUTTON_OFFSET, this, onBtnCancel);
    btnCancel.setPosition(theLayer.stage.owner.nodeButton1.getPosition());
    theLayer.stage.owner.menu.addChild(btnCancel);
    var btnModePos = theLayer.stage.owner.btnMode.getPosition();
    btnModePos.y -= 64;
    theLayer.stage.owner.btnMode.setPosition(btnModePos);
    theLayer.stage.owner.nodeVip.addChild(cc.Sprite.create("vipicon"+SWEEP_VIP_LEVEL+".png"));

    LastCantSweep = false;
    NormalGroup = [
        theLayer.stage.owner.nodeNormal,
        theLayer.stage.owner.btnStage1,
        theLayer.stage.owner.btnStage2,
        theLayer.stage.owner.btnStage3,
        theLayer.stage.owner.btnStage4,
        theLayer.stage.owner.btnStage5,
        theLayer.stage.owner.btnStage6,
        theLayer.stage.owner.btnStage7,
        theLayer.stage.owner.btnMode
    ];
    SweepGroup = [
        theLayer.stage.owner.nodeSweepFrame,
        theLayer.stage.owner.nodeSweepMid,
        theLayer.stage.owner.btnSweep1,
        theLayer.stage.owner.btnSweep2
    ];

    onNormal();
    theLayer.stage.node.setScale(0);
    theLayer.stage.node.runAction(actionPopIn());
}

function hideStages()
{
    theLayer.stage.node.runAction(actionPopOut(function(){
        engine.ui.removeLayer(theLayer.stageLayer);
        delete theLayer.stageLayer;
        delete theLayer.stage;
    }));
}

function onBtnOK(sender)
{
    cc.AudioEngine.getInstance().playEffect("card2.mp3");
    hideStages();
    startStage(theLayer.stageSelected, theLayer.TEAM, theEnergyCost);
    debug("START STAGE "+theLayer.CHID+" - "+theLayer.stageSelected);
}

function onBtnCancel(sender)
{
    cc.AudioEngine.getInstance().playEffect("cancel.mp3");
    hideStages();
}

function grabLootInfo(dungeonId){
    var dData = table.queryTable(TABLE_DUNGEON, dungeonId);
    if( dData != null && dData.dropID != null ){
        var ret = [];
        for(var k in dData.dropID){
            var dIndex = dData.dropID[k];
            var dropList = table.queryTable(TABLE_DROP, dIndex);
            for(var m in dropList){
                var dropInfo = dropList[m];
                for(var n in dropInfo.prize){
                    var itemInfo = dropInfo.prize[n];
                    if( itemInfo.type == 0 ){
                        var exist = false;
                        for(var o in ret){
                            if( ret[o] == itemInfo.value ){
                                exist = true;
                                break;
                            }
                        }
                        if( !exist ){
                            ret.push(itemInfo.value);
                        }
                    }
                }
            }
        }
        if( ret.length > 0 ){
            return ret;
        }
        else{
            return null;
        }
    }
    else{
        return null;
    }
}

function selectStage(sId)
{
    onStgTag = sId;
    var num = sId+1;
    var stageKey = "spriteStage"+num;
    var stageNode = theLayer.stage.owner[stageKey];

    if( theLayer.stage.spriteSelect == null)
    {
        theLayer.stage.spriteSelect = cc.Sprite.createWithSpriteFrameName("mapicon-selected.png");
        theLayer.stage.owner["nodeNormal"].addChild(theLayer.stage.spriteSelect);
    }
    else{
        theLayer.stage.spriteSelect.setVisible(true);
    }
    theLayer.stage.spriteSelect.setPosition(stageNode.getPosition());

    var chClass = table.queryTable(TABLE_STAGE, theLayer.CHID);
    var stg = chClass.stage[sId];
    theStageClass = stg;
    theLayer.stageSelected = stg.stageId;
    theLayer.TEAM = stg.team;
    theLayer.stage.owner.labelTeam.setString(translate(engine.game.language, "sceneStageTeamPersons", [stg.team]));
    theLayer.stage.owner.labelTeam2.setString(translate(engine.game.language, "sceneStageTeamPersons", [stg.team]));
    theLayer.stage.owner.labelEnergy.setString(translate(engine.game.language, "sceneStageCostEnergy", [stg.cost]));
    theLayer.stage.owner.labelEnergy2.setString(translate(engine.game.language, "sceneStageCostEnergy", [stg.cost]));
    theEnergyCost = stg.cost;

    //set current stage data
    engine.session.set("stage", stg);

    //grab loot info
    var loot = grabLootInfo(theStageClass.dungeon);
    if( loot != null ){
        // display loot
        var lootNode = cc.Node.create();
        var offset = 0;
        for(var k_loot in loot){
            var icon = libItem.UIItem.create({
                ClassId: loot[k_loot]
            });
            icon.setPosition(cc.p(offset, 0));
            lootNode.addChild(icon);
            offset += 120;
        }
        lootNode.setScale(0.7);
        lootNode.setPosition(cc.p(0, 0));
        theLayer.stage.owner["loot"].removeAllChildren();
        theLayer.stage.owner["loot"].addChild(lootNode);
    }


    theLayer.stage.lootLayer = theLayer.stage.owner["lootLayer"];
    theLayer.stage.lootLayer.setZOrder(10);
    theLayer.stage.lootLayer.loots = loot;
    theLayer.stage.lootLayer.onTouchBegan = onLootTouchBegan;
    theLayer.stage.lootLayer.onTouchMoved = onLootTouchMoved;
    theLayer.stage.lootLayer.onTouchCancelled = onLootTouchCancelled;
    theLayer.stage.lootLayer.onTouchEnded = onLootTouchEnded;
    theLayer.stage.lootLayer.setTouchMode(cc.TOUCH_ONE_BY_ONE);
    theLayer.stage.lootLayer.setTouchPriority(1);
    theLayer.stage.lootLayer.setTouchEnabled(true);
    theLayer.stage.lootLayer.setVisible(true);
    engine.ui.regMenu(theLayer.stage.lootLayer);
    thePrizeLayer.push(theLayer.stage.lootLayer);

    //check sweep
    for( var k_SG0 in SweepGroup ) {
        SweepGroup[k_SG0].setVisible(false);
    }
    var scrollQuantity = engine.user.inventory.countItem(SWEEP_SCROLL_CID);
    theLayer.stage.owner.labSweepScroll.setString(scrollQuantity);
    var sweepPower = theStageClass.sweepPower;
    debug("stageId:" + theStageClass.stageId + "  sweepPower:"+sweepPower);
    var stgFinished = (engine.user.stage.Chapters[theChapterClass.chapterId].Stages[sId].State >= 2);
    if( sweepPower != null && stgFinished) {
        var myPower = engine.user.actor.getPower();
        theLayer.stage.owner.labPowerRequired.setString(sweepPower);
        for( var k_SG1 in SweepGroup ) {
            SweepGroup[k_SG1].setVisible(true);
        }
        if( LastCantSweep ) {
            for( var k_NG1 in NormalGroup ) {
                NormalGroup[k_NG1].runAction(cc.MoveBy.create(0.1, cc.p(0, 67)));
            }
            for( var k_SG2 in SweepGroup ) {
                SweepGroup[k_SG2].runAction(cc.FadeIn.create(0.1));
            }
            LastCantSweep = false;
        }

        if (myPower >= sweepPower) {
            theLayer.stage.owner.btnSweep1.setEnabled(true);
            theLayer.stage.owner.btnSweep2.setEnabled(true);
            theLayer.stage.owner.labPowerRequired.setColor(COLOR_LABEL_GREEN);
        } else {
            theLayer.stage.owner.btnSweep1.setEnabled(false);
            theLayer.stage.owner.btnSweep2.setEnabled(false);
            theLayer.stage.owner.labPowerRequired.setColor(COLOR_LABEL_RED);
        }
    }
    else{
        if( !LastCantSweep ) {
            for( var k_NG2 in NormalGroup ) {
                NormalGroup[k_NG2].runAction(cc.MoveBy.create(0.1, cc.p(0, -67)));
            }
            for( var k_SG2 in SweepGroup ) {
                SweepGroup[k_SG2].runAction(cc.FadeOut.create(0.1));
            }
            LastCantSweep = true;
        }
    }
}

function onLootTouchBegan(touch, event) {
    debug("onLootTouchBegan");
    var pos = touch.getLocation();
    var relPos = theLayer.stage.lootLayer.convertToNodeSpace(pos);
//    relPos.x -= theLayer.stage.lootLayer.getPosition().x;
//    relPos.y -= theLayer.stage.lootLayer.getPosition().y;
    debug(JSON.stringify(pos));
    debug(JSON.stringify(relPos));
    if( cc.rectContainsPoint(cc.rect(0, 0,
        theLayer.stage.lootLayer.getContentSize().width,
        theLayer.stage.lootLayer.getContentSize().height
    ), relPos) ){
        var itemCid = theLayer.stage.lootLayer.loots[Math.floor(relPos.x/80)];
        debug("Cid:"+itemCid);
        if( itemCid != null ){
            var item = new libItem.Item({cid:itemCid});
            loadModule("itemInfo.js").show(item);
        }
    }
}

function onLootTouchMoved(touch, event) {
    debug("onLootTouchMoved");
}

function onLootTouchCancelled(touch, event) {
    debug("onLootTouchCancelled");
}

function onLootTouchEnded(touch, event) {
    debug("onLootTouchEnded");
}

function onSelectStage(sender)
{
    var tag = sender.getTag();
    var stageKey = "spriteStage"+tag;
    var stageNode = theLayer.stage.owner[stageKey];
    if( stageNode.isVisible() )
    {
        selectStage(tag -1);
        cc.AudioEngine.getInstance().playEffect("xuanze.mp3");
    }
}

function onSweep(sender) {
    cc.AudioEngine.getInstance().playEffect("card2.mp3");
    SweepArgs = {};
    var multi = !( sender.getTag() == 0 ); //true:批量扫荡 false:单次扫荡
    if( multi && engine.user.actor.vip < SWEEP_VIP_LEVEL ){
        libUIKit.showAlert(translate(engine.game.language, "sceneStageVIPNeed3"));
        return;
    }
    theLayer.stage.owner.btnSweep2.setEnabled(engine.user.actor.vip >= SWEEP_VIP_LEVEL);
    var times = sender.getTag() * 4 + 1; // 1 or 5
    var totalEnergyCost = theEnergyCost * times;
    var scrollQuantity = Math.floor(Number(theLayer.stage.owner.labSweepScroll.getString()));
    if( scrollQuantity < times ){
        libUIKit.showAlert(translate(engine.game.language, "sceneStageNoSweepReel"));
        return;
    }
    if( engine.user.player.Energy < totalEnergyCost ){
        var need = totalEnergyCost - engine.user.player.Energy;
        var str1 = translate(engine.game.language, "sceneStageSwRecovery", [need,need]);
        var str2 = translate(engine.game.language, "sceneStageSwChargeForRecovery", [need,need]);
        libUIKit.confirmPurchase(Request_BuyFeature, {
            typ: 0,
            tar: totalEnergyCost
        }, str1, str2, totalEnergyCost, function(rsp){
            if( rsp.RET == RET_OK ){
                //统计
                tdga.itemPurchase(translate(engine.game.language, "sceneStageEnergy"), need, 1);
            }
        });
        return;
    }
    SweepArgs = {
        stg: theLayer.stageSelected,
        mul: multi
    };
    sweepStage(SweepArgs, totalEnergyCost);
}

function showSweepAnimetion() {
    var sweepLayer = engine.ui.newLayer();
    var mask = blackMask();
    sweepLayer.addChild(mask);
    theLayer.sweepLayer = sweepLayer;
    theLayer.sweep = {};
    theLayer.sweep.owner = {};
    theLayer.sweep.node = libUIC.loadUI(theLayer.sweep, "ui-sd.ccbi",{
        nodeRole:{
            ui: "UIAvatar",
            id: "avatar",
            scale: 1.5
        }
    });
    theLayer.sweep.node.setPosition(cc.p(winSize.width/2, winSize.height/2));
    sweepLayer.addChild(theLayer.sweep.node);
    theLayer.sweep.owner.nodeRole.setScaleX(-1);
    theLayer.sweep.ui.avatar.setRole(engine.user.actor);
    theLayer.sweep.ui.avatar.playAnimation("walk", true);
    theLayer.sweep.node.animationManager.setCompletedAnimationCallback(theLayer.sweep, sweepAnimeCompleted);
    theLayer.sweep.node.animationManager.runAnimationsForSequenceNamed("open");
}

function sweepAnimeCompleted() {
    theLayer.sweep.node.removeFromParent(true);
    showSweepResult();
}

function showSweepResult() {
    theLayer.sweep = {};
    theLayer.update = updateScrollView;
    theLayer.sweep.owner = {};
    theLayer.sweep.owner.onClosePrizeList = onClosePrizeList;
    theLayer.sweep.node = libUIC.loadUI(theLayer.sweep, "ui-sd2.ccbi", {
        nodeContent:{
            ui: "UIScrollView",
            id: "scroller",
            dir: cc.SCROLLVIEW_DIRECTION_VERTICAL
        }
    });
    theLayer.sweep.node.setPosition(cc.p(winSize.width/2, winSize.height/2));
    theLayer.sweepLayer.addChild(theLayer.sweep.node);
    theLayer.sweep.theListLayer = cc.Layer.create();
    loadModule("effect.js").attachEffectCCBI(theLayer.sweep.owner.nodeLight, cc.p(0,0), "effect-jjclight.ccbi", 1);
    NumMultiRows = 0;
    for( var k in PrizeList){
        if( PrizeList[k].length > 5 ){
            NumMultiRows++;
        }
    }
    var listSize = theLayer.sweep.theListLayer.getContentSize();
    listSize.height = BAR_HEIGHT*(SweepArgs.mul? 5:1) + NumMultiRows*120 + 50;
    theLayer.sweep.theListLayer.setContentSize(listSize);
    theLayer.sweep.theListLayer.setPosition(cc.p(0, winSize.height/2));
    theLayer.sweep.ui.scroller.setContainer(theLayer.sweep.theListLayer);
    var off = theLayer.sweep.ui.scroller.getContentOffset();
    off.y = theLayer.sweep.ui.scroller.minContainerOffset().y;
    theLayer.sweep.ui.scroller.setContentOffset(off);
    PrizeIndex = 0;
    LOAD_SIZE = cc.size(BAR_WIDTH, BAR_HEIGHT * (SweepArgs.mul? 5:1) + NumMultiRows*120);
    theLayer.sweep.node.animationManager.runAnimationsForSequenceNamed("open");
    LastMultiRows = 0;
    createPrizeBar();
}

function createPrizeBar() {
    if (PrizeList[PrizeIndex] != null) {
        var layer = cc.Node.create();
        layer.owner = {};
        layer.node = libUIC.loadUI(layer, "ui-sdlist.ccbi", null);
        layer.addChild(layer.node);
        layer.node.animationManager.setCompletedAnimationCallback(layer, createPrizeBar);
        layer.owner.labIndex.setString(PrizeIndex+1);

        var ITEM_SCALE = 0.77;
        var dimension = cc.size(layer.owner.layerPrize.getContentSize().width/ITEM_SCALE + 10, 0);
        var prize = libItem.ItemPreview.create(PrizeList[PrizeIndex], dimension);
        prize.setShowInfo(true);
        prize.setAnchorPoint(cc.p(0, 0));
        var posPrize = layer.owner.nodePrize.getPosition();
        posPrize.x += (layer.owner.layerPrize.getContentSize().width
            - prize.getContentSize().width * ITEM_SCALE) / 2;
        var thisMultiRows = Math.floor( (PrizeList[PrizeIndex].length-1) / 5 );
        posPrize.y -= 120 * thisMultiRows;
        prize.setPosition(posPrize);
        prize.setScale(ITEM_SCALE);
//        debug("Size:"+JSON.stringify(prize.getContentSize())+"  Position:"+JSON.stringify(prize.getPosition()));
        layer.owner.nodePrizeBar.addChild(prize);
        if( PrizeIndex == 0 ){
            layer.setPosition(cc.p(
                    theLayer.sweep.owner.nodeContent.getContentSize().width/2,
                    LOAD_SIZE.height - BAR_HEIGHT + 80));
        }else{
            layer.setPosition(cc.p(
                    theLayer.sweep.owner.nodeContent.getContentSize().width/2,
                    theLayer.sweep.theListLayer.getChildByTag(PrizeIndex-1).getPosition().y - BAR_HEIGHT - LastMultiRows*120 ));
        }
        theLayer.sweep.theListLayer.addChild(layer, null, PrizeIndex);
        if( ( PrizeIndex > 1 || (PrizeIndex == 1 && LastMultiRows+thisMultiRows > 1) ) && !isScheduling) {
            isScheduling = true;
            off1 = theLayer.sweep.ui.scroller.getContentOffset();
            off2 = cc.p(off1.x, off1.y + BAR_HEIGHT + LastMultiRows * 120 * ITEM_SCALE);
            lerpA = 0;
            theLayer.scheduleUpdate();
        }
        LastMultiRows = thisMultiRows;
        PrizeIndex++;
        layer.node.animationManager.runAnimationsForSequenceNamed("popup");
    }
    else {
        theLayer.sweep.node.animationManager.runAnimationsForSequenceNamed("button");
        theLayer.unscheduleUpdate();
        isScheduling = false;
    }
}

function onClosePrizeList() {
    theLayer.sweep.node.animationManager.setCompletedAnimationCallback(theLayer.sweep, function(){
        engine.ui.popLayer();
        theLayer.sweep.node.removeFromParent(true);
        delete theLayer.sweep;
    });
    theLayer.sweep.node.animationManager.runAnimationsForSequenceNamed("close");
    selectStage(onStgTag);

}

//--------------World Stage-----------------

var isWorldStageCompleted = false;
var isWorldStageInfoLoaded = false;

function onWorldStage(sender) {
    cc.AudioEngine.getInstance().playEffect("card2.mp3");
    isWorldStageInfoLoaded = false;
    var call1 = cc.CallFunc.create(getWorldStageInfo);
    var scale1 = cc.ScaleTo.create(0.1, 1.4);
    var scale2 = cc.ScaleTo.create(0.1, 1);
    var call2 = cc.CallFunc.create(showWorldStage);
    var sequence = cc.Sequence.create(call1, scale1, scale2, call2);
    sender.runAction(sequence);
}

function showWorldStage() {
    var wStage = engine.ui.newLayer();
    var mask = blackMask();
    wStage.addChild(mask);
    theLayer.wStageLayer = wStage;
    theLayer.wStage = {};
    theLayer.wStage.owner = {};
    theLayer.wStage.owner.onWorldStageRank = onWorldStageRank;
    theLayer.wStage.node = libUIC.loadUI(theLayer.wStage, "ui-sjfb.ccbi", {
        nodeProgress: {
            ui: "UIProgress",
            id: "progress",
            length: 470,
            begin: "index-jy1.png",
            middle: "index-jy2.png",
            end: "index-jy3.png"
        }
    });
    theLayer.wStage.node.setPosition(cc.p(winSize.width/2, winSize.height/2));
    wStage.addChild(theLayer.wStage.node);
    engine.ui.regMenu(theLayer.wStage.owner.menu);
    theLayer.wStage.ui.progress.setProgress(0);
    theLayer.wStage.node.animationManager.runAnimationsForSequenceNamed("open");
    loadWorldStageInfo();
}

function getWorldStageInfo() {
    engine.event.sendRPCEvent(Request_WorldStageInfo, {}, function (rsp) {
        if( rsp.RET == RET_OK ){
            if( rsp.arg != null ) {
                engine.session.WorldStageInfo = rsp.arg;
                if( isWorldStageInfoLoaded ){
                    loadWorldStageInfo(); // Reload Info
                }
            }
        }
    }, theLayer.wStage);
}

function loadWorldStageInfo() {
    isWorldStageInfoLoaded = true;
    var worldStageInfo = engine.session.WorldStageInfo;
    if( worldStageInfo != null ){
        if( worldStageInfo.me != null ) {
            theLayer.wStage.owner.labCount.setString(worldStageInfo.me.cnt);
            theLayer.wStage.owner.labRank.setString( (worldStageInfo.me.rnk+1) );
        }
        if( worldStageInfo.prg != null && worldStageInfo.prg.ttl > 0){
            theLayer.wStage.owner.labProgress.setString(translate(engine.game.language, "sceneStageWorldWin", [worldStageInfo.prg.cpl,worldStageInfo.prg.ttl]));
            theLayer.wStage.ui.progress.setProgress(worldStageInfo.prg.cpl/worldStageInfo.prg.ttl);
            isWorldStageCompleted = ( worldStageInfo.prg.cpl >= worldStageInfo.prg.ttl );
        }
        var stageClass = queryStage(WORLD_STAGE_ID);
        if( stageClass != null ){
            theLayer.wStage.owner.labTeam.setString(translate(engine.game.language, "sceneStageWorldPersonsLimit", [stageClass.team]));
            theLayer.wStage.owner.labEnergy.setString(translate(engine.game.language, "sceneStageCostEnergy", [stageClass.cost]));
        }
        theLayer.wStage.owner.labReset.setString(translate(engine.game.language, "sceneStageWorldReset", [WORLD_STAGE_RESET_TIME.day,WORLD_STAGE_RESET_TIME.time]));

        var btnOK = buttonNormalL("buttontext-jr.png", BUTTON_OFFSET, this, function () {
            cc.AudioEngine.getInstance().playEffect("card2.mp3");
            startStage(WORLD_STAGE_ID, stageClass.team, stageClass.cost);
        }, BUTTONTYPE_DEFAULT);
        btnOK.setPosition(theLayer.wStage.owner.nodeButton2.getPosition());
        theLayer.wStage.owner.menu.addChild(btnOK);
        var btnCancel = buttonNormalL("buttontext-back.png", BUTTON_OFFSET, this, function () {
            cc.AudioEngine.getInstance().playEffect("card2.mp3");
            theLayer.wStage.node.animationManager.setCompletedAnimationCallback(theLayer.wStage, function(){
                engine.ui.popLayer();
                theLayer.wStage.node.removeFromParent(true);
                delete theLayer.wStage;
            });
            theLayer.wStage.node.animationManager.runAnimationsForSequenceNamed("close");
        });
        btnCancel.setPosition(theLayer.wStage.owner.nodeButton1.getPosition());
        theLayer.wStage.owner.menu.addChild(btnCancel);

        if( isWorldStageCompleted ){
            btnOK.removeFromParent(true);
            btnCancel.setPosition(cc.p(winSize.width/2, theLayer.wStage.owner.nodeButton1.getPosition().y));
        }

    }
}

function onWorldStageRank() {
    cc.AudioEngine.getInstance().playEffect("card2.mp3");
    loadModule("sceneRank.js").show(RANK_WORLD);
}
//-------------------------------------

function updateScrollView(delta) {
    lerpA += 1/30;
    theLayer.sweep.ui.scroller.setContentOffset(pLerp(off1, off2, lerpA));
    if( lerpA >= 1 ){
        theLayer.unscheduleUpdate();
        isScheduling = false;
    }
}

function onTouchBegan(touch, event)
{
    var pos = touch.getLocation();
    theLayer.beginTouch = pos;
    theLayer.beginMapPos = theLayer.bg.getPosition();

    var rpos = theLayer.bg.convertTouchToNodeSpace(touch);
    var chId = chapterAtPos(rpos);
    if( chId >= 0 ){
        debug("touchBegin = "+chId);
        var data = theLayer.chapterList[chId];
        var scale1 = cc.ScaleTo.create(0.1, 1.4);
        var scale2 = cc.ScaleTo.create(0.1, 1);
        var sequence = cc.Sequence.create(scale1, scale2);
        data.sprite.runAction(sequence);
        cc.AudioEngine.getInstance().playEffect("xuanze.mp3");
    }

    return true;
}

function onTouchMoved(touch, event)
{
    var pos = touch.getLocation();
    var dis = cc.pSub(pos, theLayer.beginTouch);
    dis.x = 0;
    var np = cc.pAdd(theLayer.beginMapPos, dis);
    //check map restriction
    if( np.y < theLayer.mapMinY )
    {
        np.y = theLayer.mapMinY;
    }
    if( np.y > theLayer.mapMaxY )
    {
        np.y = theLayer.mapMaxY;
    }
    theLayer.bg.setPosition(np);
}

function onTouchEnded(touch, event)
{
    var pos = touch.getLocation();

    var dis = cc.pDistance(pos, theLayer.beginTouch);
    if( dis < CLICK_RANGE )
    {//touch
        var rpos = theLayer.bg.convertTouchToNodeSpace(touch);
        debug("TOUCH RPOS = "+JSON.stringify(rpos));
        var chId = chapterAtPos(rpos);
        if( chId > 0 )
        {
            showStages(chId);
        }
    }
}

function onTouchCancelled(touch, event)
{
    theLayer.onTouchEnded(touch, event);
}

function scene()
{
    return {
        onEnter: onEnter,
        onExit: onExit,
        onNotify: onEvent,
        onActivate: onActivate
    };
}

//-------------------

function sweepStage(args, cost) {
    debug("sweepStage("+args.stg+", "+cost+")");

    libUIKit.waitRPC(Request_SweepStage, args, function (rsp) {
        if( rsp.RET == RET_OK ){

            if( rsp.arg != null ){
                PrizeList = rsp.arg;
                showSweepAnimetion();
            }
        }else{
            libUIKit.showErrorMessage(rsp);
        }
    });

}
//exports.sweepStage = sweepStage;


function startStage(stg, team, cost, pkRival){
    debug("startStage("+stg+", "+team+", "+cost+")");
    //check energy
    if( engine.user.player.Energy < cost ){
        var need = cost - engine.user.player.Energy;
        var str1 = translate(engine.game.language, "sceneStageRecovery", [need,need]);
        var str2 = translate(engine.game.language, "sceneStageChargeForRecovery", [need]);
        libUIKit.confirmPurchase(Request_BuyFeature, {
            typ: 0,
            tar: cost
        }, str1, str2, cost, function(rsp){
            if( rsp.RET == RET_OK ){
                //统计
                tdga.itemPurchase(translate(engine.game.language, "sceneStageEnergy"), need, 1);
            }
        });
        return;
    }

    var dungeon = {};
    dungeon.stage = stg;
    dungeon.party = [];
    dungeon.team = team;
    engine.user.setData("dungeon", dungeon);

    if( dungeon.team > 1 )
    {//choose teammate
        loadModule("sceneTeam.js").show(team);
    }
    else
    {//start dungeon
        requestBattle(engine.user.dungeon.stage, [engine.user.actor], pkRival);
    }
}
exports.startStage = startStage;
exports.scene = scene;