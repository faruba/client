/**
 * User: hammer
 * Date: 13-7-10
 * Time: 下午10:21
 */

var libTable = loadModule("table.js");

var ItemScheme = {
    cid : "ClassId",
    sid : "ServerId",
    stc : "StackCount",
    sta : "Status",
    xp : "Xp",
    eh : "Enhance",
    ts : "TimeStamp"
};

var idItemPreview = 4;
var theClass = 0;
var theLayer = null;
var touchPosBegin;

function Item(source)
{
    this.ClassId = -1;
    this.ServerId = -1;
    this.StackCount = 1;
    this.Status = 0;
    this.Xp = 0;
    this.Enhance = [{id:null, lv:-1}];
    this.TimeStamp = null;

    if( source != null )
    {
        this.parse(source);
    }
}

Item.prototype.parse = function(source)
{
    loadModule("util.js").applyScheme(this, ItemScheme, source);
    //trans internal to interface
    if( this.Enhance != null ){
        for(var ky in this.Enhance){
            var eh = this.Enhance[ky];
            if( eh.level != null && eh.lv == null ){
                eh.lv = eh.level;
            }
        }
    }
}

//trans to public form
Item.prototype.short = function(){
    var ret = {};
    for(var short in ItemScheme){
        var long = ItemScheme[short];
        if( this[long] != null ){
            ret[short] = this[long];
        }
    }
    return ret;
}

//trans to server internal form
Item.prototype.internal = function(){
    var out = this.short();
    if( out.eh != null ){
        var neh = [];
        for(var k in out.eh ){
            var old = out.eh[k];
            neh.push({
                id: old.id,
                level: old.lv
            })
        }
        out.eh = neh;
    }
    return out;
}

Item.prototype.equipUpgradeXp = function(){
    var ItemClass = libTable.queryTable(TABLE_ITEM, this.ClassId);
    if( ItemClass.upgradeTarget != null )
    {//can upgrade
        var upgradeXp = ItemClass.upgradeXp;
        if( upgradeXp == null ){
            upgradeXp = libTable.queryTable(TABLE_UPGRADE, ItemClass.rank).xp;
        }
        return upgradeXp;
    }
    else
    {//can't upgrade
        return -1;
    }
}

Item.prototype.isAvailable = function(){
    var role = engine.user.actor;
    var ItemClass = libTable.queryTable(TABLE_ITEM, this.ClassId);
    if( ItemClass.category == ITEM_EQUIPMENT ){
        //check rank
        if( ItemClass.rank != null ){
            if( role.Level < ItemClass.rank ){
                return false;
            }
        }
        //check classLimit
        if( ItemClass.classLimit != null ){
            var fit = false;
            for( var k in ItemClass.classLimit ){
                if( ItemClass.classLimit[k] == role.ClassId ){
                    fit = true;
                    break;
                }
            }
            if( !fit ) return false;
        }
    }
    if( ItemClass.category == ITEM_RECIPE ){
        //check ingredient
        for(var k in ItemClass.recipeIngredient){
            var ing = ItemClass.recipeIngredient[k];
            if( engine.user.inventory.countItem(ing.item) < ing.count ) return false;
        }
    }
    return true;
}

Item.prototype.isUpgradable = function(){
    var ItemClass = libTable.queryTable(TABLE_ITEM, this.ClassId);
    if( ItemClass != null && ItemClass.label != null )
    {//set value
        if( ItemClass.upgradeTarget != null )
        {//can upgrade
            var upgradeXp = ItemClass.upgradeXp;
            if( upgradeXp == null ){
                upgradeXp = libTable.queryTable(TABLE_UPGRADE, ItemClass.rank).xp;
            }
            var xp = this.Xp;
            if( xp == null ) xp = 0;
            if( xp >= upgradeXp
                && ItemClass.rank != null
                && ItemClass.rank < engine.user.actor.Level ){
                return true;
            }
        }
    }
    return false;
}

Item.prototype.isEnhancable = function () {
    var ItemClass = libTable.queryTable(TABLE_ITEM, this.ClassId);
    if( ItemClass != null && ItemClass.label != null )
    {//set value
        var enhance = (this.Enhance[0] != null)? this.Enhance[0].lv : -1;
        var enhanceInfo = libTable.queryTable(TABLE_ENHANCE, ItemClass.enhanceID);
        if( enhanceInfo != null ){
            if( enhance < 8*(ItemClass.quality+1)-1 ) {
                var enhanceCost = libTable.queryTable(TABLE_COST, enhanceInfo.costList[enhance+1]);
                if( enhanceCost != null ){
                    for( var k in enhanceCost.material){
                        switch(enhanceCost.material[k].type){
                            case 0: {
                                var EnhanceStoneLevel = libTable.queryTable(TABLE_ITEM, enhanceCost.material[k].value).quality;
                                var EnhanceStoneCost = enhanceCost.material[k].count;
                                var EnhanceStoneCid = loadModule("sceneForge.js").getEnhanceStoneCid(EnhanceStoneLevel);
                                var stoneCount = engine.user.inventory.countItem(EnhanceStoneCid);
                                if (stoneCount >= EnhanceStoneCost) {
                                    return true;
                                }
                            }break;
                            default: break;
                        }
                    }
                }
            }
        }
    }
    return false;
}

Item.prototype.isForgable = function () {
    var ItemClass = libTable.queryTable(TABLE_ITEM, this.ClassId);
    if( ItemClass != null && ItemClass.label != null )
    {//set value
        if( ItemClass.forgeTarget != null )
        {//can forge
            var forgeCost = libTable.queryTable(TABLE_COST, ItemClass.forgeID);
            if (forgeCost != null) {
                for (var k in forgeCost.material) {
                    switch (forgeCost.material[k].type) {
                        case 0:{
                            var mtrlClass = libTable.queryTable(TABLE_ITEM, forgeCost.material[k].value);
                            var mtrlCount = engine.user.inventory.countItem(mtrlClass.classId);
                            var mtrlCost = forgeCost.material[k].count;
                            if ( mtrlCount < mtrlCost ) {
                                return false;
                            }
                        }break;
                        default: break;
                    }
                }
                return true;
            }
        }
    }
    return false;
}

//--- query functions ---
Item.prototype.getMaxEnhanceLevel = function(){

}

function Inventory()
{
    this.Items = [];
    this.Capacity = 30;
    this.Gold = 0;
    this.Diamond = 0;
    this.Count = 0;
}

Inventory.prototype.update = function(event)
{
    var vibrate = true;
    var updateTreasure = false;
    var updateItems = false;
    var updateCapacity = false;

    if( event.arg.clr ){
        this.Items = [];
        this.Capacity = 30;
        this.Gold = 0;
        this.Diamond = 0;
        this.Count = 0;
        vibrate = false;
    }
    if( event.arg.dim != null ){
        this.Diamond = event.arg.dim;
        updateTreasure = true;
    }
    if( event.arg.god != null ){
        this.Gold = event.arg.god;
        updateTreasure = true;
    }
    if( event.arg.cap != null ){
        this.Capacity = event.arg.cap;
        updateCapacity = true;
    }
    if( event.arg.itm != null ){
        for(var k in event.arg.itm){
            var item = new Item(event.arg.itm[k]);
            var exist = this.queryItem(item.ServerId);
            if( exist >= 0 )
            {//fix the item
                item = this.Items[exist];
                item.parse(event.arg.itm[k]);
            }
            else if( item.ClassId < 0 ) continue;//添加道具/却没有ClassId，错误指令，废弃

            var itemData = libTable.queryTable(TABLE_ITEM, item.ClassId);
            if( itemData == null ){
                error("Inventory.update: no such item data ("+item.ClassId+")");
                continue;
            }
            var isStoreItem = itemData.storeOnly === true ? true : false;
            if( item.StackCount > 0 )
            {//add or modify
                if( exist >= 0 )
                {//modify
                    this.Items[exist] = item;
                }
                else
                {//add
                    if( FLAG_PROTECT && item.ClassId < 0 ){
                        error("Inventory.update: invalid item: \n"+JSON.stringify(item));
                        continue;
                    }

                    this.Items.push(item);
                    if(!isStoreItem) this.Count++;
                }
                //equip item
                if( item.Status == ITEMSTATUS_EQUIPED )
                {
                    engine.user.actor.setArmor(item);
                }
            }
            else
            {//remove
                if( exist >= 0 )
                {
                    if( item.Status == ITEMSTATUS_EQUIPED ){
                        //unequip first
                        var ItemClass = libTable.queryTable(TABLE_ITEM, item.ClassId);
                        engine.user.actor.removeArmor(ItemClass.subcategory);
                    }
                    this.Items.splice(exist, 1);
                    if(!isStoreItem) this.Count--;
                }
                else
                {
                    error("Inventory.update: Item not exist. SRC="+JSON.stringify(event.arg.itm[k]));
                }
            }
        }
        updateItems = true;
    }
    if( updateTreasure && vibrate ){
        engine.event.processNotification(Message_UpdateTreasure);
    }
    if( updateCapacity && vibrate ){
        engine.event.processNotification(Message_UpdateInventoryCapacity);
    }
    if( updateItems && vibrate ){
        engine.event.processNotification(Message_UpdateItem);
    }
}

//return item index
Inventory.prototype.queryItem = function(sid)
{
    for(var k in this.Items)
    {
        var item = this.Items[k];
        if( item.ServerId == sid )
        {
            return Number(k);
        }
    }
    return -1;
}

Inventory.prototype.getItem = function(sid){
    var idx = this.queryItem(sid);
    if( idx >= 0 ){
        return this.Items[idx];
    }
    return null;
}

Inventory.prototype.countItem = function(cid){
    var ret = 0;
    for(var k in this.Items){
        var item = this.Items[k];
        if( item.ClassId == cid ){
            ret += item.StackCount;
        }
    }
    return ret;
}

Inventory.prototype.getServerId = function(cid){
    for(var k in this.Items){
        var item = this.Items[k];
        if( item.ClassId == cid ){
            return item.ServerId;
        }
    }
}

Inventory.prototype.syncArmors = function(){
    engine.user.actor.Armors = [];
    for(var k in this.Items){
        var item = this.Items[k];
        if( item.Status == ITEMSTATUS_EQUIPED ){
            engine.user.actor.setArmor(item);
        }
    }
    engine.user.actor.fix();
}

Inventory.prototype.sort = function(){
    this.Items = this.Items.sort(function(a, b){
        var CA = libTable.queryTable(TABLE_ITEM, a.ClassId);
        var CB = libTable.queryTable(TABLE_ITEM, b.ClassId);
        if( CA.category != CB.category ){
            return CA.category - CB.category;
        }
        else{
            return b.ClassId - a.ClassId;
        }
    });
}

Inventory.prototype.getItems = function()
{
    return this.Items;
}

Inventory.prototype.getNormalItems = function()
{
    return this.Items.filter(function(itm){
        var itemData = libTable.queryTable(TABLE_ITEM, itm.ClassId);
        if( itemData.storeOnly === true ) return false;
        if( itemData.hide === true ) return false;
        return true;
    });
}

Inventory.prototype.getShopItems = function()
{
    return this.Items.filter(function(itm){
        var itemData = libTable.queryTable(TABLE_ITEM, itm.ClassId);
        if( itemData.hide === true ) return false;
        if( itemData.storeOnly === true ) return true;
        return false;
    });
}

var slots = [
    EquipSlot_MainHand,
    EquipSlot_SecondHand,
    EquipSlot_Chest,
    EquipSlot_Legs,
    EquipSlot_Finger,
    EquipSlot_Neck
];
Inventory.prototype.checkUpgradable = function(lst, mode){

    for(var k in slots){
        var item = engine.user.actor.queryArmor(slots[k]);
        item = syncItemData(item);
        if( ((mode == null || mode == 0) && item.isUpgradable())
            || (mode == 1 && item.isEnhancable())
            || (mode == 2 && item.isForgable()) ){
            if(lst != null){
                lst[lst.length] = slotsTransfrom(slots[k]);
            }else{
                return true;
            }
        }
    }
    return (lst != null && lst.length > 0);
}

Inventory.prototype.checkEnhancable = function(lst){
    return this.checkUpgradable(lst, 1);
}

Inventory.prototype.checkForgable = function(lst){
    return this.checkUpgradable(lst, 2);
}

function slotsTransfrom(slot) {
    switch (slot){
        case 0: return 1;
        case 1: return 2;
        case 2: return 3;
        case 3: return 5;
        case 4: return 4;
        case 5: return 6;
        default : return -1;
    }

}

//--- ui component ---

var UIItem = cc.Node.extend({
    init: function(item, flag, def){
        if( !this._super()) return false;
        //init code here
        this.DEF = def;
        this.FLAG = flag;
        if( this.DEF == null )
        {
            this.DEF = "itembg.png";
        }
        if( this.FLAG == null )
        {
            this.FLAG = false;
        }
        this.setItem(item);
        return true;
    },
    setItem: function(item, owner, isSmall, isNode)
    {
        if( isSmall === true ){
            var ITEM_SCALE = 0.77; //缩放比例
            var ITEM_DELTA_POS;
            if (isNode != null && isNode ){
                ITEM_DELTA_POS = cc.p(0, 0);
            }else{
                ITEM_DELTA_POS = cc.p(45, 45);
            }
        }
        if( owner == null ) owner = engine.user.actor;
        this.ITEM = item;
        this.removeAllChildren();
        this.icon = null;
        this.dot = null;
        this.num = null;
        this.frameAvailable = null;

        if( this.ITEM != null )
        {
            var ItemClass = libTable.queryTable(TABLE_ITEM, this.ITEM.ClassId);
            if( ItemClass != null && ItemClass.label == null ){
                var sp = cc.Sprite.create(this.DEF);
                if( isSmall === true ){
                    sp.setScale(ITEM_SCALE);
                    sp.setPosition(ITEM_DELTA_POS);
                }
                this.addChild(sp);
                return;
            }

            if( ItemClass != null )
            {
                //var tbg = cc.Sprite.create(ItemTypeImages[ItemClass.category]);
                //this.addChild(tbg);
                if( ItemClass.iconm != null && ItemClass.iconf != null )
                {
                    if( owner != null )
                    {
                        if( owner.Gender == 0 )
                        {//female icon
                            var icon = cc.Sprite.create(ItemClass.iconf);
                        }
                        else
                        {//male icon
                            var icon = cc.Sprite.create(ItemClass.iconm);
                        }
                    }
                    else
                    {//if no user, use male
                        var icon = cc.Sprite.create(ItemClass.iconm);
                    }
                }
                else
                {
                    var icon = cc.Sprite.create(ItemClass.icon);
                }
                if( icon != null ){
                    if( isSmall === true ){
                        icon.setScale(ITEM_SCALE);
                        icon.setPosition(ITEM_DELTA_POS);
                    }
                    this.addChild(icon, 0);
                }
                this.icon = icon;
                if( this.FLAG && this.ITEM.Status == ITEMSTATUS_EQUIPED &&!(isSmall === true) )
                {
                    var equipTag = cc.Sprite.createWithSpriteFrameName("bag-equipped.png");
                    equipTag.setAnchorPoint(cc.p(0.5 , 1));
                    equipTag.setPosition(cc.p(30, 50));
                    this.addChild(equipTag, 50);
                }
                this.setStackCount(this.ITEM.StackCount);
                //add quality tag
                if( ItemClass.quality != null){
                    var fileName = "itemquality"+(ItemClass.quality+1)+".png";
                    var qualityTag = cc.Sprite.create(fileName);
                    qualityTag.setAnchorPoint(cc.p(0, 0));
                    qualityTag.setPosition(cc.p(-50, -50));
                    if( isSmall === true ){
                        qualityTag.setAnchorPoint(cc.p(0.5, 0.5));
                        qualityTag.setScale(ITEM_SCALE);
                        qualityTag.setPosition(ITEM_DELTA_POS);
                    }
                    this.addChild(qualityTag, 20);
                }
                //add enhance mark
                if( this.ITEM.Enhance != null && this.ITEM.Enhance[0] != null){
                    var starLv = Math.floor((this.ITEM.Enhance[0].lv+1) / 8);
                    if( starLv >0 ){
                        var fileStar = "itemstar"+starLv+".png";
                        var enhanceMark = cc.Sprite.create(fileStar);
                        enhanceMark.setAnchorPoint(cc.p(0.5, 0));
                        enhanceMark.setPosition(cc.p(0, -44));
                        if( isSmall === true ){
                            enhanceMark.setAnchorPoint(cc.p(0.5, 0.5));
                            enhanceMark.setScale(ITEM_SCALE);
                            enhanceMark.setPosition(cc.p(ITEM_DELTA_POS.x, ITEM_DELTA_POS.y-31));
                        }
                        this.addChild(enhanceMark, 52);
                    }
                }
            }
            else
            {
//                warn("UIItem.setItem: Item Class not found.("+this.ITEM.ClassId+")");
                var sp = cc.Sprite.create("wenhao.png");
                if( isSmall === true ){
                    sp.setScale(ITEM_SCALE);
                    sp.setPosition(ITEM_DELTA_POS);
                }
                this.addChild(sp, 0);
            }
        }
        else
        {
            var sp = cc.Sprite.create(this.DEF);
            if( isSmall === true ){
                sp.setScale(ITEM_SCALE);
                sp.setPosition(ITEM_DELTA_POS);
            }
            this.addChild(sp, 0);
        }
    },
    showFrame: function()
    {
        var frame = cc.Sprite.create("skillbg.png");
        this.addChild(frame, 10);
    },
    setStackCount: function(num){
        try{

        if( num > 1 ){
            if( this.dot == null ){
                this.dot = cc.Sprite.create("cardnummask.png");
                this.dot.setAnchorPoint(cc.p(1, 0));
                this.dot.setPosition(cc.p(this.icon.getContentSize().width/2-5, -this.icon.getContentSize().height/2+5));
                this.addChild(this.dot, 30);
            }
            if( this.num == null ){
                this.num = cc.LabelBMFont.create(num, "font1.fnt");
                this.num.setAnchorPoint(cc.p(0.5, 0.5));
                this.num.setPosition(cc.p(32-5, -32+5));
                this.addChild(this.num, 40);
            }
            else{
                this.num.setString(num);
            }
            if( this.stackColor != null ){
                this.num.setColor(this.stackColor);
            }
        }
        else{
            if( this.dot != null ){
                this.removeChild(this.dot);
                delete this.dot;
            }
            if( this.num != null ){
                this.removeChild(this.num);
                delete this.num;
            }
        }

        }catch(e){
            traceError(e);
            printArray(arguments);
        }
    },
    setStackColor: function(color){
        this.stackColor = color;
        if( this.num != null ){
            this.num.setColor(this.stackColor);
        }
    },
    setAvailable: function(flag){
        if( flag ){//remove
            if( this.frameAvailable != null ){
                this.removeChild(this.frameAvailable);
                delete this.frameAvailable;
            }
        }
        else{//add
            if( this.frameAvailable == null ){
                this.frameAvailable = cc.Sprite.create("bag-unavailable.png");
                this.addChild(this.frameAvailable, 5);
            }
        }
    },
    setDefaultIcon: function(def){
        this.DEF = def;
        if( this.DEF == null )
        {
            this.DEF = "itembg.png";
        }
    },
    getItem: function()
    {
        return this.ITEM;
    }
});

UIItem.create = function(item, flag, def){
    var ret = new UIItem();
    ret.init(item, flag, def);
    return ret;
}

UIItem.make = function(thiz, args)
{
    var ret = {};
    var def = null;
    if( args.def != null )
    {
        def = args.def;
    }
    var flag = false;
    if( args.flg != null )
    {
        flag = args.flg;
    }
    ret.id = UIItem.create(null, flag, def);
    ret.node = ret.id;
    return ret;
}

//--- ItemPreviewArea

var ITEMPREVIEW_WIDTH = 130;
var ITEMPREVIEW_HEIGHT = 155;
var thePrizeNodePos = [];

function queryPrize(pit, treasureDisplayFlag){
    var ret = {
        icon: null,
        label: null
    };
    if( treasureDisplayFlag == null ){
        treasureDisplayFlag = false;
    }
    var strIcon,strLabel;
    var spQuality = null;
    var stack = 1;
    if( pit.count > 1 ){
        if( treasureDisplayFlag || pit.type == PRIZETYPE_ITEM ){
            stack = pit.count;
        }
    }
    switch(pit.type){
        case PRIZETYPE_ITEM:{//item
            var itemClass = libTable.queryTable(TABLE_ITEM, pit.value);
            if( itemClass != null ){
                strIcon = itemClass.icon;
                strLabel = itemClass.label;
                if( itemClass.iconm != null && itemClass.iconf != null )
                {
                    if( engine.user.actor != null )
                    {
                        if( engine.user.actor.Gender == 0 )
                        {//female icon
                            strIcon = itemClass.iconf;
                        }
                        else
                        {//male icon
                            strIcon = itemClass.iconm;
                        }
                    }
                    else
                    {//if no user, use male
                        strIcon = itemClass.iconm;
                    }
                }
            }
            else{
                strIcon = "wenhao.png";
                strLabel = "???";
            }
            if( itemClass.quality != null){
                var fileName = "itemquality"+(itemClass.quality+1)+".png";
                spQuality = cc.Sprite.create(fileName);
                spQuality.setAnchorPoint(cc.p(0, 0));
                spQuality.setPosition(cc.p(0, 0));
            }
        }break;
        case PRIZETYPE_GOLD:{//gold
            strIcon = "mission-coin.png";
            if( pit.count != null ){
                strLabel = pit.count+translate(engine.game.language, "xitemCoin");
            }
            else{
                strLabel = translate(engine.game.language, "xitemCoin");
            }
        }break;
        case PRIZETYPE_DIAMOND:{//diamond
            strIcon = "mission-jewel.png";
            if ( pit.count != null ){
                strLabel = pit.count /*+translate(engine.game.language, "xitemDiamond")*/;
            }
            else{
                strLabel = translate(engine.game.language, "xitemDiamond");
            }
        }break;
        case PRIZETYPE_EXP:{//exp
            strIcon = "mission-xp.png";
            if ( pit.count != null ){
                strLabel = pit.count;
            }
            else{
                strLabel = translate(engine.game.language, "xitemExp");
            }
        }break;
        case PRIZETYPE_WXP:{//wxp
            strIcon = "mission-sld.png";
            if ( pit.count != null ){
                strLabel = pit.count;
            }
            else{
                strLabel = translate(engine.game.language, "xitemProficiency");
            }
        }break;
        default : return null;
    }
    ret.label = strLabel;
    ret.icon = cc.Sprite.create(strIcon);
    if( spQuality != null ){
        ret.icon.addChild(spQuality);
    }
    if( stack > 1 ){
        var dot = cc.Sprite.create("cardnummask.png");
        dot.setAnchorPoint(cc.p(1, 0));
        dot.setPosition(cc.p(ret.icon.getContentSize().width, 0));
        ret.icon.addChild(dot, 30);

        var num = cc.LabelBMFont.create(stack, "font1.fnt");
        num.setAnchorPoint(cc.p(0.5, 0.5));
        num.setPosition(cc.p(ret.icon.getContentSize().width-18, 18));
        ret.icon.addChild(num, 40);
    }
    return ret;
}

function createPrizeItem(prz){
    var pit = queryPrize(prz);
    if( pit != null ){
        var node = cc.Node.create();
        node.icon = pit.icon;
        node.label = cc.LabelTTF.create(pit.label, UI_FONT, UI_SIZE_S);
        node.label.setDimensions(cc.size(ITEMPREVIEW_WIDTH, 60));
        node.label.setVerticalAlignment(cc.VERTICAL_TEXT_ALIGNMENT_TOP);
        node.label.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);
        //place the node
        node.icon.setPosition(cc.p(0, 0));
        node.addChild(node.icon);
        node.label.setPosition(cc.p(0, -83));
        node.addChild(node.label);
        return node;
    }
    return null;
}

var ItemPreview = cc.Layer.extend({
    init: function(){
        if( !this._super()) return false;
        //init code here
        this.DIMENSION = cc.size(0, 0);
        this.SCALE = 1;
        return true;
    },
    setDimension: function(dimension){
        this.DIMENSION = dimension;
    },
    pushPreview: function(pv){
        var pit = queryPrize(pv);
        if( pit != null ){
            //create the node
            var node = cc.Node.create();
            node.classId = pit.value;
            node.PV = pv;
            node.icon = pit.icon;
            if (pit.label.length > 5){
                pit.label = pit.label.substr(0,4);
                pit.label += "...";
            }
            node.label = cc.LabelTTF.create(pit.label, UI_FONT, UI_SIZE_S);
            node.label.setDimensions(cc.size(ITEMPREVIEW_WIDTH, 60));
            node.label.setVerticalAlignment(cc.VERTICAL_TEXT_ALIGNMENT_TOP);
            node.label.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);
            if( this.COLOR != null ){
                node.label.setColor(this.COLOR);
            }
            //place the node
            node.icon.setPosition(cc.p(ITEMPREVIEW_WIDTH/2, ITEMPREVIEW_HEIGHT-55));
            node.addChild(node.icon);
            node.label.setPosition(cc.p(ITEMPREVIEW_WIDTH/2, (ITEMPREVIEW_HEIGHT-110)/2));

            node.addChild(node.label);
            this.addChild(node);
        }
    },
    formatPreview: function(){
        thePrizeNodePos = [];
        var count = this.getChildrenCount();
        var nodes = this.getChildren();
        var scale = 1;
        if(this.SCALE != null){
            scale = this.SCALE;
        }
        if( this.DIMENSION.width == 0 ){
            var index = 0;
            for(var k in nodes){
                var nd = nodes[k];
                nd.setPosition(cc.p(index*ITEMPREVIEW_WIDTH*scale, 0));
                index++;
            }
            this.setContentSize(cc.size(ITEMPREVIEW_WIDTH*count*scale, ITEMPREVIEW_HEIGHT*scale));
        }
        else{
            var PC = Math.floor(this.DIMENSION.width/ITEMPREVIEW_WIDTH/scale);
            var LN = Math.ceil(count/PC);
            var WD = count*ITEMPREVIEW_WIDTH*scale;
            if( LN > 1 ){
                WD = PC*ITEMPREVIEW_WIDTH*scale;
            }
            var size = cc.size(WD, ITEMPREVIEW_HEIGHT*LN*scale);
            this.setContentSize(size);
            var index = 0;
            for(var k in nodes){
                var PX = Math.floor(index%PC);
                var PY = Math.floor(index/PC);
                var nd = nodes[k];
                nd.setPosition(cc.p(PX*ITEMPREVIEW_WIDTH*scale, size.height - PY*ITEMPREVIEW_HEIGHT*scale - ITEMPREVIEW_HEIGHT*scale));
                thePrizeNodePos[index] = cc.p(PX*ITEMPREVIEW_WIDTH*scale, size.height - PY*ITEMPREVIEW_HEIGHT*scale - ITEMPREVIEW_HEIGHT*scale);
                nd.setScale(scale);
                index++;
            }
        }
    },
    setPreview: function(pvs){
        //过滤职业
        var RoleClass = engine.user.actor.ClassId;
        pvs = pvs.filter(function(pv){
            if( pv.classLimit != null ){
                var fit = false;
                for( var k in pv.classLimit ){
                    if( pv.classLimit[k] == RoleClass ){
                        fit = true;
                        break;
                    }
                }
                if( !fit ) return false;
            }
            return true;
        });

        for(var k in pvs){
            this.pushPreview(pvs[k]);
        }
        this.formatPreview();
    },
    setTextColor: function(color){
        this.COLOR = color;
    },
    setNodeScale: function(scale){
        this.SCALE = scale;
    },
    setShowInfo: function(show){
        if (show == null){
            show = false;
        }
        this.setTouchEnabled(show);
    },
    shake: function(){
        var off = 0;
        var children = this.getChildren();
        for(var k in children ){
            var node = children[k];

            var hide = cc.Hide.create();
            var delay = cc.DelayTime.create(off);
            var show = cc.Show.create();
            var s1 = cc.ScaleTo.create(0, 0);
            var s2 = cc.ScaleTo.create(0.1, 1.6);
            var s3 = cc.ScaleTo.create(0.1, 1.4);
            var s4 = cc.ScaleTo.create(0.3, 1);
            var func = cc.CallFunc.create(function(){
                switch(this.type){
                    case 0:
                        var itemClass = libTable.queryTable(TABLE_ITEM, this.value);
                        if( itemClass.category == ITEM_RECIPE ){
                            cc.AudioEngine.getInstance().playEffect("prizetuzhi.mp3");
                        }
                        else if( itemClass.category == ITEM_USE ){
                            cc.AudioEngine.getInstance().playEffect("prizebaoxiang.mp3");
                        }
                        else{
                            cc.AudioEngine.getInstance().playEffect("prizeqita.mp3");
                        }
                        break;
                    case 1:
                        cc.AudioEngine.getInstance().playEffect("prizejinbi.mp3");
                        break;
                    case 2:
                        cc.AudioEngine.getInstance().playEffect("prizebaoshi.mp3");
                        break;
                }
            }, node.PV);
            var seq = cc.Sequence.create(hide, delay, show, s1, s2, s3, s4, func);
            node.runAction(seq);
            off += 0.5;
        }
    }
});

ItemPreview.createRaw = function(dimension){
    var ret = new ItemPreview();
    ret.init();
    if( dimension != null ){
        ret.setDimension(dimension);
    }
    theClass = idItemPreview;
    theLayer = ret;
    ret.onTouchBegan = onTouchBegan;
    ret.onTouchMoved = onTouchMoved;
    ret.onTouchEnded = onTouchEnded;
    ret.onTouchCancelled = onTouchCancelled;
    ret.setTouchMode(cc.TOUCH_ONE_BY_ONE);
    ret.setTouchPriority(1);
    ret.setTouchEnabled(false);
    return ret;
}

ItemPreview.create = function(pvs, dimension, color){
    var ret = new ItemPreview();
    ret.init();
    if( dimension != null ){
        ret.setDimension(dimension);
    }
    if( color != null ){
        ret.setTextColor(color);
    }
    if( pvs != null ){
        ret.setPreview(pvs);
    }
    theClass = idItemPreview;
    theLayer = ret;
    ret.onTouchBegan = onTouchBegan;
    ret.onTouchMoved = onTouchMoved;
    ret.onTouchEnded = onTouchEnded;
    ret.onTouchCancelled = onTouchCancelled;
    ret.setTouchMode(cc.TOUCH_ONE_BY_ONE);
    ret.setTouchPriority(1);
    ret.setTouchEnabled(false);
    return ret;
}

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
        if (theClass == idItemPreview && theLayer != null){
            var localPos = theLayer.convertToNodeSpace(touchPosBegin);
            var size = theLayer.getContentSize();
            var nodes = theLayer.getChildren();
            var scale = theLayer.SCALE;
            var item = {};
            if( localPos.x >0 && localPos.y >0
                && localPos.x < size.width && localPos.y < size.height ){
                //判断点击位置是何物品
                for (var k = 0;k < thePrizeNodePos.length;k++){
                    if (localPos.x > thePrizeNodePos[k].x && localPos.x < thePrizeNodePos[k].x + ITEMPREVIEW_WIDTH*scale &&
                        localPos.y > thePrizeNodePos[k].y && localPos.y < thePrizeNodePos[k].y + ITEMPREVIEW_HEIGHT*scale){
                        item = nodes[k];
                        item.ClassId = nodes[k].PV.value;
                        cc.AudioEngine.getInstance().playEffect("card2.mp3");
                        loadModule("itemInfo.js").show(item, false);
                        break;
                    }
                }
            }
        }
    }
}

function onTouchCancelled(touch, event){
    onTouchEnded(touch, event);
}

//--- getItemIcon
function getItemIcon(cid) {
    if( cid < 0 ){
        return ("wenhao.png");
    }
    var ItemClass = libTable.queryTable(TABLE_ITEM, cid);
    if( ItemClass.icon != null ){
        return ItemClass.icon;
    }else{
        return ("wenhao.png");
    }
}

exports.Item = Item;
exports.Inventory = Inventory;
exports.UIItem = UIItem;
exports.queryPrize = queryPrize;
exports.ItemPreview = ItemPreview;
exports.createPrizeItem = createPrizeItem;
exports.getItemIcon = getItemIcon;
